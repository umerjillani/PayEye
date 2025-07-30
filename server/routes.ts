import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { hmrcRTIService } from "./hmrc-api";
import { nanoid } from "nanoid";
import multer from "multer";
import path from "path";
import fs from "fs";

// Extend session interface to support both super admin and company admin sessions
declare module "express-session" {
  interface SessionData {
    // Super admin session properties
    superAdminId?: number;
    // Company admin session properties (from auth.ts)
    userId?: number;
    companyId?: string;
    // Common properties
    userType?: 'super_admin' | 'company_admin' | 'admin';
    isAuthenticated?: boolean;
    // Multi-tenant properties
    currentCompanyId?: string;
    accessibleCompanyIds?: string[];
  }
}
// Import pdf-parse dynamically to avoid initialization issues
// import pdf from "pdf-parse";
import { 
  insertAgencySchema, insertCandidateSchema, insertTimesheetSchema, 
  insertInvoiceSchema, insertPayslipSchema, insertPaymentSchema 
} from "../shared/schema.js";
import { ZodError } from "zod";
import { processRemittanceDocument, processTimesheetDocument, processBulkEmployeeDocument, processBulkAgencyDocument } from "./ocr-service";
import { 
  requireAuth, 
  requireSuperAdmin, 
  requireCompanyAdmin,
  requireValidCompanyAccess,
  requireCompanyDataAccess,
  isSuperAdmin,
  getCurrentCompanyId,
  getAccessibleCompanies,
  switchCompany,
  getUserInfo,
  initializeUserSession
} from "./multi-tenant-auth";

// Configure multer for file uploads with company-based isolation
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    // For authenticated requests, use company-specific directory
    const companyId = req.session?.companyId || 'temp';
    const uploadDir = path.join('./uploads', companyId);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  fileFilter: (req, file, cb) => {
    console.log(`File upload attempt: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xlsx|xls|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/octet-stream' // Sometimes Excel files come as this
    ];
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (mimetype || extname) {
      console.log(`File accepted: ${file.originalname}`);
      return cb(null, true);
    } else {
      console.log(`File rejected: ${file.originalname}, mimetype: ${file.mimetype}`);
      cb(new Error('Only Excel, images, PDFs, and CSV files are allowed'));
    }
  },
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// OCR Processing function
async function extractDataFromDocument(filePath: string, documentType: 'timesheet' | 'invoice' | 'payroll') {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    let extractedText = '';
    
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      // Dynamic import to avoid initialization issues
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(fileBuffer);
      extractedText = data.text;
    }
    
    // Parse extracted text based on document type
    const extractedData = parseDocumentData(extractedText, documentType);
    return extractedData;
  } catch (error) {
    console.error('Error extracting data from document:', error);
    return null;
  }
}

// Document data parsing function
function parseDocumentData(text: string, documentType: 'timesheet' | 'invoice' | 'payroll') {
  const data: any = {};
  
  if (documentType === 'timesheet') {
    // Extract timesheet data
    const patterns = {
      candidateName: /(?:candidate|employee|worker)[\s:]+([^\n]+)/i,
      hoursWorked: /(?:hours|hrs)[\s:]+(\d+\.?\d*)/i,
      payRate: /(?:rate|pay)[\s:]+£?(\d+\.?\d*)/i,
      startDate: /(?:start|from)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      endDate: /(?:end|to)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      agencyName: /(?:agency|client)[\s:]+([^\n]+)/i
    };
    
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match) data[key] = match[1].trim();
    });
  }
  
  if (documentType === 'invoice') {
    // Extract invoice data
    const patterns = {
      invoiceNumber: /(?:invoice|inv)[\s#:]+([A-Z0-9\-]+)/i,
      totalAmount: /(?:total|amount)[\s:]+£?(\d+\.?\d*)/i,
      agencyName: /(?:bill to|client)[\s:]+([^\n]+)/i,
      invoiceDate: /(?:date|issued)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      dueDate: /(?:due)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    };
    
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match) data[key] = match[1].trim();
    });
  }
  
  if (documentType === 'payroll') {
    // Extract payroll data
    const patterns = {
      employeeName: /(?:employee|worker)[\s:]+([^\n]+)/i,
      grossPay: /(?:gross|total)[\s:]+£?(\d+\.?\d*)/i,
      taxCode: /(?:tax code)[\s:]+([A-Z0-9]+)/i,
      niNumber: /(?:ni|national insurance)[\s:]+([A-Z]{2}\d{6}[A-Z])/i,
      payPeriod: /(?:period|week ending)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    };
    
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match) data[key] = match[1].trim();
    });
  }
  
  return data;
}

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Multi-tenant authentication routes
  
  // Get current user info with multi-tenant context
  app.get("/api/user/info", requireAuth, async (req, res) => {
    try {
      const userInfo = await getUserInfo(req);
      if (!userInfo) {
        return res.status(404).json({ error: "User not found" });
      }

      const accessibleCompanies = await getAccessibleCompanies(req);
      const currentCompanyId = getCurrentCompanyId(req);

      res.json({
        ...userInfo,
        currentCompanyId,
        accessibleCompanies,
        isSuperAdmin: isSuperAdmin(req)
      });
    } catch (error) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });

  // Switch company for super admins
  app.post("/api/user/switch-company", requireSuperAdmin, async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const success = await switchCompany(req, companyId);
      if (!success) {
        return res.status(400).json({ error: "Invalid company ID or access denied" });
      }

      res.json({ success: true, currentCompanyId: companyId });
    } catch (error) {
      console.error("Error switching company:", error);
      res.status(500).json({ error: "Failed to switch company" });
    }
  });

  // Get accessible companies for current user
  app.get("/api/user/companies", requireAuth, async (req, res) => {
    try {
      const companies = await getAccessibleCompanies(req);
      res.json({ companies, isSuperAdmin: isSuperAdmin(req) });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  // RTI and HMRC API Routes
  app.get("/api/hmrc/auth-url", (req, res) => {
    try {
      const state = Math.random().toString(36).substring(7);
      const authUrl = hmrcRTIService.generateAuthUrl(state);
      res.json({ authUrl, state });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.post("/api/hmrc/callback", async (req, res) => {
    try {
      const { code } = req.body;
      const tokenData = await hmrcRTIService.exchangeCodeForToken(code);
      res.json({ success: true, tokenData });
    } catch (error) {
      res.status(400).json({ error: "Failed to exchange authorization code" });
    }
  });

  app.post("/api/candidates/:candidateId/rti-fetch", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const candidate = await storage.getCandidate(candidateId);
      
      if (!candidate || !candidate.nationalInsuranceNumber) {
        return res.status(400).json({ error: "Candidate not found or missing NINO" });
      }

      const rtiData = await hmrcRTIService.getEmploymentInfo(
        candidate.nationalInsuranceNumber,
        req.body.fromDate || "2024-04-06",
        req.body.toDate || "2025-04-05"
      );

      // Store RTI data in database
      if (rtiData.employments.length > 0) {
        for (const employment of rtiData.employments) {
          await storage.createRTIEmploymentRecord({
            candidateId,
            nino: rtiData.nino,
            employerName: employment.employerName,
            taxCode: employment.taxCode,
            startDate: employment.startDate,
            endDate: employment.endDate,
            payFrequency: employment.payFrequency,
            employerPayeReference: employment.employerPayeReference,
            status: rtiData.status,
            errorMessage: rtiData.errorMessage,
          });
        }
      }

      res.json(rtiData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RTI data" });
    }
  });

  // Remittance OCR upload endpoint
  app.post("/api/upload-remittance", upload.single("file"), requireCompanyDataAccess, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`Processing remittance file: ${req.file.filename}`);
      console.log(`File path: ${req.file.path}`);
      console.log(`File size: ${req.file.size} bytes`);
      
      // Process the document with OCR using exact Python logic
      const ocrResult = await processRemittanceDocument(req.file.path);
      console.log("Raw OCR Result:", JSON.stringify(ocrResult, null, 2));
      
      if (ocrResult.error) {
        // Clean up file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          error: "OCR processing failed",
          details: ocrResult.error
        });
      }
      
      // Extract agency name from result (exact Python logic)
      const agencyNames = Object.keys(ocrResult).filter(key => key !== 'records');
      const agencyName = agencyNames[0] || "Unknown Agency";
      
      console.log(`Found agency: ${agencyName}`);
      console.log(`Found ${ocrResult.records?.length || 0} records`);
      
      if (!agencyName) {
        return res.status(400).json({ error: "No agency found in document" });
      }

      const companyId = req.companyId;
      
      // For now, just return the OCR results without database operations to test OCR first
      // Clean up file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.json({
        success: true,
        message: `Successfully processed OCR for ${ocrResult.records.length} records`,
        agency: agencyName,
        paymentsCreated: 0, // Will implement database saving after OCR is confirmed working
        totalRecords: ocrResult.records.length,
        ocrData: ocrResult, // Return raw OCR data for debugging
        payments: []
      });

    } catch (error) {
      console.error("Error processing remittance OCR:", error);
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: "Failed to process remittance document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/payroll/batch", async (req, res) => {
    try {
      const batchData = {
        ...req.body,
        id: `batch_${Date.now()}`,
        status: 'draft'
      };
      
      const batch = await storage.createPayrollBatch(batchData);
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payroll batch" });
    }
  });

  app.get("/api/payroll/batches", async (req, res) => {
    try {
      const batches = await storage.getPayrollBatches(req.query.companyId as string);
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll batches" });
    }
  });

  app.post("/api/payroll/batch/:batchId/process", async (req, res) => {
    try {
      const { batchId } = req.params;
      const batch = await storage.getPayrollBatch(batchId);
      
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }

      // Process batch items with tax calculations
      const items = await storage.getPayrollBatchItems(batchId);
      
      for (const item of items) {
        // Calculate tax deductions based on current tax codes
        const candidate = await storage.getCandidate(item.candidateId);
        const rtiRecord = await storage.getLatestRTIRecord(item.candidateId);
        
        if (rtiRecord && rtiRecord.taxCode) {
          // Use actual tax code from RTI data for calculations
          await storage.updatePayrollBatchItem(item.id, {
            taxCode: rtiRecord.taxCode,
            status: 'calculated'
          });
        }
      }

      await storage.updatePayrollBatch(batchId, {
        status: 'processed',
        processedAt: new Date()
      });

      res.json({ success: true, message: "Batch processed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to process batch" });
    }
  });

  // Companies routes
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      console.log("Companies API called - session:", {
        userId: req.session?.userId,
        companyId: req.session?.companyId,
        userType: req.session?.userType
      });
      
      // For regular company admins, return only their company
      if (req.session.userId && req.session.companyId) {
        const company = await storage.getCompany(req.session.companyId);
        console.log("Company found:", company);
        if (company) {
          res.json([company]); // Return as array for consistency
        } else {
          res.json([]);
        }
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:slug", async (req, res) => {
    try {
      const company = await storage.getCompanyBySlug(req.params.slug);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  // Agencies routes
  app.get("/api/agencies", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const agencies = await storage.getAgencies(companyId!);
      res.json(agencies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agencies" });
    }
  });

  app.post("/api/agencies", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      console.log("Received agency data:", req.body);
      
      // Transform email objects to array of strings and handle empty numeric values
      const processedData = { ...req.body };
      if (processedData.emails && Array.isArray(processedData.emails)) {
        processedData.emails = processedData.emails.map((emailObj: any) => 
          typeof emailObj === 'string' ? emailObj : emailObj.email
        ).filter(Boolean);
      }
      
      // Handle empty numeric values - convert empty strings to null
      if (processedData.payRateValue === '') {
        processedData.payRateValue = null;
      }
      if (processedData.payRatePercentage === '') {
        processedData.payRatePercentage = null;
      }
      
      const agencyData = insertAgencySchema.parse({
        ...processedData,
        id: nanoid(),
        companyId,
      });
      
      const agency = await storage.createAgency(agencyData);
      res.status(201).json(agency);
    } catch (error: any) {
      console.error("Error creating agency:", error);
      
      if (error instanceof ZodError) {
        const missingFields = error.issues.map((issue: any) => {
          const fieldPath = issue.path.join('.');
          return `${fieldPath}: ${issue.message}`;
        });
        
        return res.status(400).json({ 
          error: "Please add the required details",
          details: missingFields,
          message: `Missing or invalid fields: ${missingFields.join(', ')}`
        });
      }
      
      res.status(400).json({ 
        error: "Please add the required details",
        message: "Some required information is missing or invalid"
      });
    }
  });

  app.put("/api/agencies/:id", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      console.log(`Updating agency ${req.params.id} with data:`, JSON.stringify(req.body, null, 2));
      const agency = await storage.updateAgency(req.params.id, req.body);
      if (!agency) {
        return res.status(404).json({ error: "Agency not found" });
      }
      res.json(agency);
    } catch (error) {
      console.error("Agency update error:", error);
      res.status(500).json({ error: "Failed to update agency", details: error.message });
    }
  });

  app.delete("/api/agencies/:id", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      // Verify the agency belongs to the company before deleting
      const agency = await storage.getAgency(req.params.id);
      if (!agency || agency.companyId !== companyId) {
        return res.status(404).json({ error: "Agency not found" });
      }
      
      const deleted = await storage.deleteAgency(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Agency not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete agency" });
    }
  });

  // Candidates/Employees routes
  app.get("/api/candidates", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const candidates = await storage.getCandidates(companyId!);
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch candidates" });
    }
  });

  // Get candidate with all related data
  app.get("/api/candidates/:id/details", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    
    try {
      const candidateDetails = await storage.getCandidateWithDetails(req.params.id);
      
      if (!candidateDetails.candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      res.json(candidateDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch candidate details" });
    }
  });

  app.post("/api/candidates", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      // Clean up numeric fields - convert empty strings to null
      const cleanedData = { ...req.body };
      const numericFields = ['margin', 'payRate', 'percentageCap'];
      numericFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        }
      });
      
      // Clean up optional text fields
      const optionalFields = ['agencyIds', 'bankName', 'accountNumber', 'sortCode', 'address', 'nationalInsuranceNumber'];
      optionalFields.forEach(field => {
        if (cleanedData[field] === '') {
          cleanedData[field] = null;
        }
      });

      const candidateData = insertCandidateSchema.parse({
        ...cleanedData,
        id: nanoid(),
        companyId,
      });
      
      const candidate = await storage.createCandidate(candidateData);
      res.status(201).json(candidate);
    } catch (error) {
      console.error("Error creating candidate:", error);
      if (error instanceof Error) {
        console.error("Validation error details:", error.message);
      }
      res.status(400).json({ error: "Invalid candidate data" });
    }
  });

  app.put("/api/candidates/:id", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      // Verify candidate belongs to the company
      const existingCandidate = await storage.getCandidate(req.params.id);
      if (!existingCandidate || existingCandidate.companyId !== companyId) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      console.log(`Updating candidate ${req.params.id} with data:`, req.body);
      const candidate = await storage.updateCandidate(req.params.id, req.body);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      console.error("Error updating candidate:", error);
      res.status(500).json({ error: "Failed to update candidate", details: error.message });
    }
  });

  app.delete("/api/candidates/:id", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      // Verify candidate belongs to the company
      const existingCandidate = await storage.getCandidate(req.params.id);
      if (!existingCandidate || existingCandidate.companyId !== companyId) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const deleted = await storage.deleteCandidate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      res.status(200).json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Error deleting candidate:", error);
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // Timesheets routes
  app.get("/api/timesheets", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    const status = req.query.status as string;

    try {
      console.log(`Fetching timesheets - session data:`, {
        superAdminId: req.session?.superAdminId,
        userId: req.session?.userId,
        sessionCompanyId: req.session?.companyId,
        requestCompanyId: companyId,
        currentCompanyId: req.session?.currentCompanyId,
        status
      });
      
      // Extra validation to ensure we have a company ID
      if (!companyId) {
        console.error("No company ID in request context");
        return res.status(400).json({ error: "Company ID required" });
      }
      
      let timesheets;
      if (status) {
        timesheets = await storage.getTimesheetsByStatus(companyId, status);
      } else {
        timesheets = await storage.getTimesheets(companyId);
      }
      console.log(`Found ${timesheets.length} timesheets for company ${companyId}`);
      
      // Log first timesheet for debugging
      if (timesheets.length > 0) {
        console.log("First timesheet:", timesheets[0]);
      }
      
      res.json(timesheets);
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      res.status(500).json({ error: "Failed to fetch timesheets" });
    }
  });

  app.post("/api/timesheets", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const timesheetData = insertTimesheetSchema.parse({
        ...req.body,
        id: nanoid(),
        companyId: companyId, // Ensure company ID is set from session
      });
      
      const timesheet = await storage.createTimesheet(timesheetData);
      res.status(201).json(timesheet);
    } catch (error) {
      res.status(400).json({ error: "Invalid timesheet data" });
    }
  });

  app.put("/api/timesheets/:id", requireCompanyDataAccess, async (req, res) => {

    try {
      // Clean and validate the update data
      const updateData = { ...req.body };
      
      // Handle numeric fields - remove commas and ensure proper formatting
      const numericFields = ['hoursCharged', 'payRate', 'grossPay'];
      numericFields.forEach(field => {
        if (updateData[field]) {
          updateData[field] = updateData[field].toString().replace(/[,$]/g, '');
        }
      });

      // Handle date fields
      if (updateData.startDate && typeof updateData.startDate === 'string') {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate && typeof updateData.endDate === 'string') {
        updateData.endDate = new Date(updateData.endDate);
      }

      // Handle empty agency
      if (updateData.agencyIds === "none" || updateData.agencyIds === "") {
        updateData.agencyIds = [];
      }

      console.log("Updating timesheet with data:", updateData);
      
      const timesheet = await storage.updateTimesheet(req.params.id, updateData);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }

      // Auto-create invoice when timesheet is approved
      if (updateData.status === "approved" && timesheet.agencyId) {
        try {
          const agency = await storage.getAgency(timesheet.agencyId);
          if (agency) {
            const invoiceData = {
              id: nanoid(),
              companyId: timesheet.companyId,
              agencyId: agency.id,
              invoiceNumber: `INV-${Date.now()}-${timesheet.id.substring(0, 8)}`,
              totalAmount: timesheet.grossPay,
              netAmount: (parseFloat(timesheet.grossPay) * 0.8).toString(),
              invoiceDate: new Date(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: "pending"
            };
            
            await storage.createInvoice(invoiceData);
            console.log(`Auto-created invoice ${invoiceData.invoiceNumber} for approved timesheet ${timesheet.id}`);
          }
        } catch (invoiceError) {
          console.error("Error auto-creating invoice for approved timesheet:", invoiceError);
          // Don't fail the timesheet update if invoice creation fails
        }
      }

      res.json(timesheet);
    } catch (error) {
      console.error("Timesheet update error:", error);
      res.status(500).json({ error: "Failed to update timesheet" });
    }
  });

  // Manual timesheet creation for when employee doesn't exist
  app.post("/api/timesheets/manual", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const { employeeName, hoursWorked, payRate, totalPay, clientName, weekEnding, originalFile } = req.body;
      
      const timesheetData = {
        id: nanoid(),
        organizationId: null,
        companyId,
        candidateId: null, // No employee linked
        agencyId: "", 
        startDate: weekEnding ? new Date(weekEnding) : new Date(),
        endDate: weekEnding ? new Date(weekEnding) : new Date(),
        hoursCharged: hoursWorked || "0",
        payRate: payRate || "0",
        grossPay: totalPay || "0",
        originalDocumentUrl: originalFile || "",
        extractedData: {
          employeeName,
          clientName,
          originalExtraction: true
        },
        status: "pending"
      };

      const timesheet = await storage.createTimesheet(timesheetData);
      
      res.json({
        success: true,
        timesheet,
        message: "Manual timesheet created successfully"
      });
    } catch (error) {
      console.error("Error creating manual timesheet:", error);
      res.status(500).json({ error: "Failed to create manual timesheet" });
    }
  });

  // Invoices routes
  app.get("/api/invoices", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    const status = req.query.status as string;

    try {
      let invoices;
      if (status) {
        invoices = await storage.getInvoicesByStatus(companyId!, status);
      } else {
        invoices = await storage.getInvoices(companyId!);
      }
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const invoiceData = insertInvoiceSchema.parse({
        ...req.body,
        id: nanoid(),
        companyId, // Ensure invoice is created for the correct company
      });
      
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice data" });
    }
  });

  // Dashboard metrics endpoint
  app.get("/api/dashboard/metrics", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const [pendingTimesheets, outstandingInvoices, overdueInvoices, candidates, approvedTimesheets, agencies] = await Promise.all([
        storage.getTimesheetsByStatus(companyId!, "pending"),
        storage.getInvoicesByStatus(companyId!, "outstanding"),
        storage.getInvoicesByStatus(companyId!, "overdue"),
        storage.getCandidates(companyId!),
        storage.getTimesheetsByStatus(companyId!, "approved"),
        storage.getAgencies(companyId!),
      ]);

      const allOutstandingInvoices = [...outstandingInvoices, ...overdueInvoices];

      const totalOutstanding = allOutstandingInvoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.totalAmount || "0"), 0
      );

      // Calculate monthly revenue from approved timesheets only
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const monthlyApprovedTimesheets = approvedTimesheets.filter(timesheet => {
        const timesheetDate = new Date(timesheet.createdAt || timesheet.startDate);
        return timesheetDate.getMonth() === currentMonth && timesheetDate.getFullYear() === currentYear;
      });

      const monthlyRevenue = monthlyApprovedTimesheets.reduce((sum, timesheet) => 
        sum + parseFloat(timesheet.grossPay || "0"), 0
      );

      const metrics = {
        pendingTimesheets: pendingTimesheets.length,
        outstandingInvoices: `£${totalOutstanding.toLocaleString()}`,
        monthlyRevenue: `£${monthlyRevenue.toLocaleString()}`,
        activeEmployees: candidates.filter(c => c.status === "active").length,
        totalAgencies: agencies.length,
        overdueInvoices: overdueInvoices.length,
      };

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Sidebar metrics for navigation badges
  app.get("/api/sidebar/metrics", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      const [timesheets, invoices, candidates, agencies] = await Promise.all([
        storage.getTimesheets(companyId!),
        storage.getInvoices(companyId!), 
        storage.getCandidates(companyId!),
        storage.getAgencies(companyId!)
      ]);

      // Count agencies with approved timesheets for invoice count
      const approvedTimesheets = timesheets.filter(t => t.status === 'approved');
      const agenciesWithApprovedTimesheets = new Set<string>();
      
      // Count direct agency assignments
      approvedTimesheets.forEach(timesheet => {
        if (timesheet.agencyId) {
          agenciesWithApprovedTimesheets.add(timesheet.agencyId);
        }
      });
      
      // Count agencies from employee multi-agency assignments
      approvedTimesheets.forEach(timesheet => {
        if (timesheet.candidateId) {
          const candidate = candidates.find(c => c.id === timesheet.candidateId);
          if (candidate?.agencyIds) {
            candidate.agencyIds.forEach(agencyId => agenciesWithApprovedTimesheets.add(agencyId));
          }
        }
      });
      
      // Count unique extracted agency names (virtual agencies)
      const extractedAgencies = new Set<string>();
      approvedTimesheets.forEach(timesheet => {
        if (timesheet.extractedData && typeof timesheet.extractedData === 'object') {
          const agencyName = (timesheet.extractedData as any)?.Agency || 
                            (timesheet.extractedData as any)?.agency;
          if (agencyName) {
            // Check if this extracted agency name matches any real agency
            const matchesRealAgency = agencies.some(agency => 
              agency.agencyName.toLowerCase().trim() === agencyName.toLowerCase().trim()
            );
            if (!matchesRealAgency) {
              extractedAgencies.add(agencyName);
            }
          }
        }
      });

      // Count employees with timesheets for payroll
      const employeesWithTimesheets = new Set<string>();
      timesheets.forEach(ts => {
        if (ts.candidateId) {
          employeesWithTimesheets.add(ts.candidateId);
        }
      });
      
      // Also count virtual employees (from extracted names)
      const extractedEmployees = new Set<string>();
      timesheets.forEach(ts => {
        if (!ts.candidateId && ts.extractedData && typeof ts.extractedData === 'object') {
          const employeeName = (ts.extractedData as any)?.employeeName;
          if (employeeName) {
            extractedEmployees.add(employeeName);
          }
        }
      });

      res.json({
        agencies: agencies.length,
        employees: candidates.length,
        timesheets: timesheets.length,
        pendingTimesheets: timesheets.filter(t => t.status === 'pending').length,
        invoices: agenciesWithApprovedTimesheets.size + extractedAgencies.size, // Agencies with approved timesheets
        pendingInvoices: invoices.filter(i => i.status === 'pending').length,
        payroll: employeesWithTimesheets.size + extractedEmployees.size // Employees with timesheets
      });
    } catch (error) {
      console.error("Error fetching sidebar metrics:", error);
      res.status(500).json({ error: "Failed to fetch sidebar metrics" });
    }
  });

  // Recent activity endpoint
  app.get("/api/dashboard/activity", requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;

    try {
      // Mock recent activity data - in a real app this would come from audit logs
      const activities = [
        {
          id: "1",
          type: "timesheet_approved",
          user: "Sarah Johnson",
          employee: "Michael Brown",
          timestamp: "2 minutes ago",
          icon: "check",
          color: "success"
        },
        {
          id: "2",
          type: "invoice_generated",
          agency: "Healthcare Plus Agency",
          invoiceNumber: "INV-2024-0156",
          timestamp: "15 minutes ago",
          icon: "file-invoice-dollar",
          color: "primary"
        },
        {
          id: "3",
          type: "timesheet_uploaded",
          user: "David Wilson",
          timestamp: "1 hour ago",
          icon: "upload",
          color: "warning"
        },
        {
          id: "4",
          type: "employee_added",
          employee: "Emma Davis",
          agency: "TechStaff Solutions",
          timestamp: "3 hours ago",
          icon: "user-plus",
          color: "purple"
        },
      ];

      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });

  // Document Upload Routes
  
  // Upload timesheet document
  app.post("/api/upload/timesheet", upload.single('document'), requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`Processing timesheet upload: ${req.file.originalname}`);
      
      // Use the same perfect OCR logic as remittance processing
      const ocrResult = await processTimesheetDocument(req.file.path);
      
      if (!ocrResult.success) {
        return res.status(400).json({ 
          error: ocrResult.error,
          message: "Failed to extract data from timesheet document"
        });
      }

      const extractedData = ocrResult.structuredData;
      console.log("Timesheet OCR extracted data:", extractedData);

      // Helper function to convert Excel date serial numbers to proper dates
      const convertExcelDate = (dateValue: string | number) => {
        if (!dateValue) return new Date();
        
        // If it's already a proper date string, parse it normally
        if (typeof dateValue === 'string' && (dateValue.includes('-') || dateValue.includes('/'))) {
          return new Date(dateValue);
        }
        
        // If it's an Excel serial number (like 45784)
        const serialNumber = typeof dateValue === 'string' ? parseInt(dateValue) : dateValue;
        if (serialNumber && serialNumber > 1 && serialNumber < 100000) {
          // Excel epoch starts from January 1, 1900 (but Excel treats 1900 as leap year)
          const excelEpoch = new Date(1900, 0, 1);
          const daysOffset = serialNumber - 2; // Adjust for Excel's leap year bug
          return new Date(excelEpoch.getTime() + (daysOffset * 24 * 60 * 60 * 1000));
        }
        
        return new Date();
      };

      // Process all records instead of just the first one
      const processedTimesheets = [];
      const records = extractedData.records && extractedData.records.length > 0 ? extractedData.records : [extractedData];
      
      // Get all candidates once
      const candidates = await storage.getCandidates(companyId);
      
      for (const record of records) {
        console.log("Processing record:", JSON.stringify(record, null, 2));
        
        // Extract key timesheet information from AI-processed data with detailed logging
        const employeeName = record["Person Name"] || record.employee_name || record.candidate_name || record.worker_name || record.name;
        const hoursWorked = record["Hours charged"] || record.hours_worked || record.total_hours || record.regular_hours;
        const payRate = (record["Pay Rate"] || record.hourly_rate || record.rate || record.pay_rate || "").toString().replace(/,/g, '');
        const totalPay = (record["Gross Pay"] || record.total_pay || record.gross_pay || record.total_amount || "").toString().replace(/,/g, '');
        const clientName = record.Agency || record.client || record.client_name || record.company || record.agency;
        const weekEnding = record["Shift Data"] || record.week_ending || record.week_end || record.period_ending || record.date;
        
        console.log("Raw extraction fields:");
        console.log("- Person Name:", record["Person Name"]);
        console.log("- Hours charged:", record["Hours charged"]);
        console.log("- Pay Rate:", record["Pay Rate"]);
        console.log("- Gross Pay:", record["Gross Pay"]);
        console.log("- Agency:", record.Agency);
        console.log("- Shift Data:", record["Shift Data"]);
        console.log("- Time sheet number:", record["Time sheet number"]);
        
        console.log("Final extracted values:", { 
          employeeName, 
          hoursWorked: `"${hoursWorked}"`, 
          payRate: `"${payRate}"`, 
          totalPay: `"${totalPay}"`, 
          clientName, 
          weekEnding 
        });

        // Skip if missing essential data
        if (!employeeName || !hoursWorked) {
          console.log("Skipping record - missing essential data");
          continue;
        }

        // Find candidate by name
        let candidate = candidates.find(c => {
          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
          const searchName = employeeName.toLowerCase();
          return fullName.includes(searchName) || searchName.includes(fullName);
        });

        // Create timesheet for ALL employees (regardless of whether they exist in database or not)
        try {
          // Calculate gross pay if not provided, ensuring clean numeric values
          const cleanTotalPay = totalPay ? totalPay.replace(/[,$]/g, '') : '';
          const cleanPayRate = payRate ? payRate.replace(/[,$]/g, '') : (candidate?.payRate || "0");
          const calculatedGrossPay = cleanTotalPay || 
            (parseFloat(hoursWorked || "0") * parseFloat(cleanPayRate)).toString();

          const timesheetData = {
            id: nanoid(),
            companyId,
            candidateId: candidate?.id || null, // null if employee doesn't exist in database
            agencyId: candidate?.agencyIds?.[0] || "", // Use first agency or empty
            startDate: convertExcelDate(weekEnding),
            endDate: convertExcelDate(weekEnding),
            hoursCharged: hoursWorked,
            payRate: cleanPayRate,
            grossPay: calculatedGrossPay,
            originalDocumentUrl: req.file.originalname || req.file.path,
            extractedData: {
              ...record,
              employeeName: employeeName, // Store extracted employee name for display
              clientName: clientName,
              originalExtraction: true
            },
            status: "pending"
          };

          const timesheet = await storage.createTimesheet(timesheetData);
          processedTimesheets.push(timesheet);
          
          // Auto-generate invoice for agency (only if candidate exists and has agency)
          if (timesheet && candidate && candidate.agencyIds && candidate.agencyIds.length > 0) {
            const agency = await storage.getAgency(candidate.agencyIds[0]);
            if (agency) {
                const invoiceData = {
                  id: nanoid(),
                  companyId,
                  agencyId: agency.id,
                  invoiceNumber: `INV-${Date.now()}-${processedTimesheets.length}`,
                  totalAmount: timesheetData.grossPay,
                  netAmount: (parseFloat(timesheetData.grossPay) * 0.8).toString(),
                  invoiceDate: new Date(),
                  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  status: "draft"
                };
                
                await storage.createInvoice(invoiceData);
              }
            }

          console.log(`Timesheet created successfully: ${timesheet.id} for ${employeeName}${candidate ? ' (employee found in database)' : ' (employee not in database)'}`);
        } catch (timesheetError) {
          console.error(`Error creating timesheet for ${employeeName}:`, timesheetError);
        }
      }

      // Return success with count of processed timesheets
      if (processedTimesheets.length > 0) {
        const firstTimesheet = processedTimesheets[0];
          
        // Get candidate names for the processed timesheets
        const processedWithNames = await Promise.all(
          processedTimesheets.map(async (t) => {
            let candidate = null;
            if (t.candidateId) {
              try {
                candidate = await storage.getCandidate(t.candidateId);
              } catch (error) {
                console.error(`Error fetching candidate ${t.candidateId}:`, error);
              }
            }
            return {
              id: t.id,
              candidateId: t.candidateId,
              candidateName: candidate 
                ? `${candidate.firstName} ${candidate.lastName}` 
                : (t.extractedData && typeof t.extractedData === 'object') 
                  ? (t.extractedData as any).employeeName || 'Unknown Employee'
                  : 'Unknown Employee',
              hoursCharged: t.hoursCharged,
              payRate: t.payRate,
              grossPay: t.grossPay,
              startDate: t.startDate,
              endDate: t.endDate,
              status: t.candidateId ? 'created' : 'extracted' // Show different status
            };
          })
        );

        return res.json({ 
          success: true, 
          timesheet: firstTimesheet,
          message: `Successfully processed ${processedTimesheets.length} timesheet record(s)`,
          extractedData: {
            totalRecords: processedTimesheets.length,
            processedTimesheets: processedWithNames,
            rawExtraction: ocrResult.structuredData
          }
        });
      } else {
        // Even if no employee was found, format the extracted data for frontend display
        const firstRecord = extractedData.records && extractedData.records.length > 0 ? extractedData.records[0] : extractedData;
        const formattedExtractedData = {
          employeeName: firstRecord['Person Name'] || firstRecord.employee_name || firstRecord.candidate_name || firstRecord.worker_name || firstRecord.name || 'Not detected',
          hoursWorked: firstRecord['Hours charged'] || firstRecord.hours_worked || firstRecord.total_hours || firstRecord.regular_hours || 'Not detected',
          payRate: (firstRecord['Pay Rate'] || firstRecord.hourly_rate || firstRecord.rate || firstRecord.pay_rate || 'Not detected').toString().replace(/[,$"]/g, ''),
          totalPay: (firstRecord['Gross Pay'] || firstRecord.total_pay || firstRecord.gross_pay || firstRecord.total_amount || 'Not calculated').toString().replace(/[,$"]/g, ''),
          clientName: firstRecord['Agency'] || firstRecord.client || firstRecord.client_name || firstRecord.company || firstRecord.agency || extractedData.Summary?.Agency || 'Not detected',
          weekEnding: firstRecord['Shift Data'] || firstRecord.week_ending || firstRecord.week_end || firstRecord.period_ending || firstRecord.date || 'Not detected'
        };
        
        return res.json({ 
          success: false, 
          message: "No timesheet records could be processed from the uploaded document. The employee may not exist in the system.",
          extractedData: formattedExtractedData
        });
      }
    } catch (error) {
      console.error("Error processing timesheet upload:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // Upload invoice document
  app.post("/api/upload/invoice", upload.single('document'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const extractedData = await extractDataFromDocument(req.file.path, 'invoice');
      
      if (extractedData && extractedData.agencyName && extractedData.totalAmount) {
        // Find agency
        const agencies = await storage.getAgencies(companyId);
        const agency = agencies.find(a => 
          a.agencyName.toLowerCase().includes(extractedData.agencyName.toLowerCase())
        );

        if (agency) {
          const invoiceData = {
            id: nanoid(),
            companyId,
            agencyId: agency.id,
            invoiceNumber: extractedData.invoiceNumber || `INV-${Date.now()}`,
            totalAmount: extractedData.totalAmount,
            netAmount: (parseFloat(extractedData.totalAmount) * 0.8).toString(),
            invoiceDate: extractedData.invoiceDate ? new Date(extractedData.invoiceDate) : new Date(),
            dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            pdfUrl: req.file.path,
            status: "sent"
          };

          const invoice = await storage.createInvoice(invoiceData);
          
          res.json({ 
            success: true, 
            invoice: invoice,
            extractedData: extractedData,
            message: `Invoice created for ${agency.agencyName}`
          });
        } else {
          res.json({ 
            success: false, 
            extractedData: extractedData,
            message: "Agency not found. Please create agency first."
          });
        }
      } else {
        res.json({ 
          success: false, 
          extractedData: extractedData,
          message: "Could not extract sufficient data from document"
        });
      }
    } catch (error) {
      console.error("Error processing invoice upload:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // Upload payroll document
  app.post("/api/upload/payroll", upload.single('document'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const extractedData = await extractDataFromDocument(req.file.path, 'payroll');
      
      if (extractedData && extractedData.employeeName && extractedData.grossPay) {
        // Find employee
        const candidates = await storage.getCandidates(companyId);
        const candidate = candidates.find(c => 
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(extractedData.employeeName.toLowerCase())
        );

        if (candidate) {
          // Create payslip
          const payslipData = {
            id: nanoid(),
            companyId,
            candidateId: candidate.id,
            grossPay: extractedData.grossPay,
            timesheetId: "",
            payPeriodStart: extractedData.payPeriod ? new Date(extractedData.payPeriod) : new Date(),
            payPeriodEnd: extractedData.payPeriod ? new Date(extractedData.payPeriod) : new Date(),
            employmentType: candidate.employmentType,
            taxDeducted: (parseFloat(extractedData.grossPay) * 0.2).toString(),
            niDeducted: (parseFloat(extractedData.grossPay) * 0.12).toString(),
            netPay: (parseFloat(extractedData.grossPay) * 0.68).toString(),
            status: "processed",
            pdfUrl: req.file.path
          };

          const payslip = await storage.createPayslip(payslipData);
          
          // Create payment record
          if (payslip && candidate.bankName && candidate.accountNumber) {
            const paymentData = {
              id: nanoid(),
              companyId,
              candidateId: candidate.id,
              amount: payslipData.netPay,
              bankAccountNumber: candidate.accountNumber,
              sortCode: candidate.sortCode || "000000",
              paymentDate: new Date(),
              status: "pending"
            };

            await storage.createPayment(paymentData);
          }

          res.json({ 
            success: true, 
            payslip: payslip,
            extractedData: extractedData,
            message: `Payslip created for ${candidate.firstName} ${candidate.lastName}`
          });
        } else {
          res.json({ 
            success: false, 
            extractedData: extractedData,
            message: "Employee not found. Please create employee first."
          });
        }
      } else {
        res.json({ 
          success: false, 
          extractedData: extractedData,
          message: "Could not extract sufficient data from document"
        });
      }
    } catch (error) {
      console.error("Error processing payroll upload:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // Bulk employee upload endpoint
  app.post("/api/upload/bulk-employees", upload.single('document'), requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`Processing bulk employee upload: ${req.file.originalname}`);
      
      // Process document using OCR service
      const ocrResult = await processBulkEmployeeDocument(req.file.path);
      
      if (!ocrResult.success) {
        return res.status(400).json({ 
          error: ocrResult.error || "Failed to extract employee data from document"
        });
      }

      const structuredData = ocrResult.structuredData;
      console.log("AI extraction completed for bulk employees");
      console.log("Structured employee data:", JSON.stringify(structuredData, null, 2));

      const processedEmployees = [];
      const errors = [];
      const records = structuredData.records && structuredData.records.length > 0 ? structuredData.records : [structuredData];

      for (const record of records) {
        try {
          // Extract basic information
          const firstName = record.first_name || record.firstName || record.first || record.fname;
          const lastName = record.last_name || record.lastName || record.last || record.lname || record.surname;
          const email = record.email || record.email_address || record.contact_email;
          const phone = record.phone || record.phone_number || record.mobile || record.contact_number || record.telephone;
          const address = record.address || record.home_address || record.residential_address || record.street_address;
          
          // Required fields validation
          if (!firstName || !lastName) {
            errors.push(`Missing required fields (first name or last name) for record: ${JSON.stringify(record)}`);
            continue;
          }

          // Extract personal details
          const gender = record.gender || record.sex || null;
          const dateOfBirth = record.date_of_birth || record.dob || record.birth_date || record.birthdate || null;
          const reference = record.reference || record.ref_number || record.reference_number || record.employee_ref || null;

          // Extract employment information
          const employmentType = record.employment_type || record.employmentType || record.type || record.category || record.worker_type || "PAYE";
          const agency = record.agency || record.agency_name || record.supplier || record.recruitment_agency || null;
          const payRate = record.pay_rate || record.payRate || record.hourly_rate || record.rate || record.salary || record.wage || "0";
          const sector = record.sector || record.industry || record.department || null;
          const paymentFrequency = record.payment_frequency || record.paymentFrequency || record.pay_frequency || null;
          const payrollProcessor = record.payroll_processor || record.payrollProcessor || record.processor || null;
          const firstPayDate = record.first_pay_date || record.firstPayDate || record.start_pay_date || null;

          // Extract tax information (PAYE)
          const nationalInsuranceNumber = record.national_insurance || record.ni_number || record.nino || record.nationalInsuranceNumber || record.ni_no || null;
          const taxCode = record.tax_code || record.taxCode || record.tax_reference || null;
          const niCode = record.ni_code || record.niCode || record.ni_category || null;
          const emergencyTaxCode = record.emergency_tax_code || record.emergencyTaxCode || record.emergency_tax || false;

          // Extract Limited Company details
          const companyName = record.company_name || record.companyName || record.ltd_name || record.business_name || null;
          const companyRegistrationNumber = record.registration_number || record.companyRegistrationNumber || record.reg_number || record.company_reg || null;
          const vatNumber = record.vat_number || record.vatNumber || record.vat_registration || null;
          const corporationTaxReference = record.corporation_tax_reference || record.corporationTaxReference || record.corp_tax_ref || null;

          // Extract banking information
          const bankName = record.bank_name || record.bankName || record.bank || null;
          const accountNumber = record.account_number || record.accountNumber || record.account_no || null;
          const sortCode = record.sort_code || record.sortCode || record.sort_code_number || null;

          // Extract status and processing fields
          const status = record.status || record.employee_status || record.worker_status || "active";
          const supplierCode = record.supplier_code || record.supplierCode || record.supplier_ref || null;
          const percentageCap = record.percentage_cap || record.percentageCap || record.cap_percentage || null;
          const margin = record.margin || record.margin_rate || record.fee_rate || null;
          const codaRef = record.coda_ref || record.codaRef || record.coda_reference || null;
          const remittanceStatus = record.remittance_status || record.remittanceStatus || record.payment_status || "pending";

          // Determine employment type - map to Finity's specific types
          const normalizedEmploymentType = employmentType.toLowerCase().includes("limited") || 
                                          employmentType.toLowerCase().includes("ltd") || 
                                          employmentType.toLowerCase().includes("company") || 
                                          employmentType.toLowerCase().includes("subcontractor") ? "subcontractor" : "umbrellaNg";

          // Create comprehensive employee data
          const employeeData = {
            id: nanoid(),
            companyId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email || null,
            phone: phone || null,
            address: address || null,
            gender: gender || null,
            dateOfBirth: dateOfBirth || null,
            reference: reference || null,
            employmentType: normalizedEmploymentType,
            agencyIds: [], // Will be matched with agency name later
            payRate: payRate.toString().replace(/[,$]/g, ''),
            sector: sector || null,
            paymentFrequency: paymentFrequency || null,
            payrollProcessor: payrollProcessor || null,
            firstPayDate: firstPayDate || null,
            nationalInsuranceNumber: nationalInsuranceNumber || null,
            taxCode: taxCode || null,
            niCode: niCode || null,
            emergencyTaxCode: emergencyTaxCode || false,
            companyName: normalizedEmploymentType === "subcontractor" ? companyName : null,
            companyRegistrationNumber: normalizedEmploymentType === "subcontractor" ? companyRegistrationNumber : null,
            vatNumber: normalizedEmploymentType === "subcontractor" ? vatNumber : null,
            corporationTaxReference: normalizedEmploymentType === "subcontractor" ? corporationTaxReference : null,
            bankName: bankName || null,
            accountNumber: accountNumber || null,
            sortCode: sortCode || null,
            status: status || "active",
            supplierCode: supplierCode || null,
            percentageCap: percentageCap || null,
            margin: margin || null,
            codaRef: codaRef || null,
            remittanceStatus: remittanceStatus || "pending"
          };

          console.log(`Creating employee: ${firstName} ${lastName} (${employmentType})`);
          const employee = await storage.createCandidate(employeeData);
          processedEmployees.push(employee);

        } catch (employeeError: any) {
          console.error(`Error creating employee from record:`, employeeError);
          errors.push(`Failed to create employee: ${employeeError?.message || "Unknown error"}`);
        }
      }

      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: processedEmployees.length > 0,
        processedEmployees: processedEmployees,
        failed: errors.length,
        errors: errors,
        message: `Successfully processed ${processedEmployees.length} employee record(s)`,
        rawExtraction: structuredData
      });

    } catch (error) {
      console.error("Error processing bulk employee upload:", error);
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: "Failed to process employee document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Bulk agency upload endpoint
  app.post("/api/upload/bulk-agencies", upload.single('document'), requireCompanyDataAccess, async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`Processing bulk agency upload: ${req.file.originalname}`);
      
      // Process document using OCR service
      const ocrResult = await processBulkAgencyDocument(req.file.path);
      
      if (!ocrResult.success) {
        return res.status(400).json({ 
          error: ocrResult.error || "Failed to extract agency data from document"
        });
      }

      const structuredData = ocrResult.structuredData;
      console.log("AI extraction completed for bulk agencies");
      console.log("Structured agency data:", JSON.stringify(structuredData, null, 2));

      const processedAgencies = [];
      const errors = [];
      const records = structuredData.records && structuredData.records.length > 0 ? structuredData.records : [structuredData];

      for (const record of records) {
        try {
          // Extract basic information
          const agencyName = record.agencyName || record.agency_name || record.name || record.company_name || record.business_name;
          const contactPerson = record.contactPerson || record.contact_person || record.contact || record.representative || record.manager;
          const email = record.email || record.email_address || record.contact_email || record.primary_email;
          const phone = record.phone || record.phone_number || record.telephone || record.mobile || record.contact_number;
          const address = record.address || record.business_address || record.office_address || record.head_office;
          
          // Required field validation
          if (!agencyName) {
            errors.push(`Missing required field (agency name) for record: ${JSON.stringify(record)}`);
            continue;
          }

          // Extract administrative details
          const codaRef = record.codaRef || record.coda_ref || record.coda_reference || record.reference || record.ref_code;
          const status = record.status || record.agency_status || record.active_status || record.operational_status || "active";
          
          // Extract financial & payment configuration
          const payRateType = record.payRateType || record.pay_rate_type || record.payment_type || record.rate_type || "UmbrellaNG";
          const payRateFixed = record.payRateFixed || record.pay_rate_fixed || record.fixed_rate || record.umbrella_rate || null;
          const payRatePercentage = record.payRatePercentage || record.pay_rate_percentage || record.percentage_rate || record.margin_rate || null;
          const currency = record.currency || record.payment_currency || record.base_currency || "GBP";
          const paymentTerms = record.paymentTerms || record.payment_terms || record.payment_period || record.terms || 30;
          
          // Extract compliance & tax
          const vatTable = record.vatTable || record.vat_table || record.vat_registered || record.vat_registration || false;
          const accountInvoiceRequired = record.accountInvoiceRequired || record.account_invoice_required || record.invoice_required || false;
          const vatNumber = record.vatNumber || record.vat_number || record.tax_number || null;
          
          // Extract banking information with proper typing
          const bankDetails = {
            bankName: record.bankDetails?.bankName || record.bank_name || record.bankName || record.bank || "",
            accountNumber: record.bankDetails?.accountNumber || record.account_number || record.accountNumber || record.account_no || "",
            sortCode: record.bankDetails?.sortCode || record.sort_code || record.sortCode || record.routing_number || "",
            accountHolderName: record.bankDetails?.accountHolder || record.account_holder || record.accountHolder || record.beneficiary_name || "",
            iban: record.bankDetails?.iban || record.iban || undefined,
            swiftCode: record.bankDetails?.swiftCode || record.swift_code || record.swiftCode || record.bic_code || undefined
          };

          // Handle multiple emails
          let emails = [];
          if (record.emails && Array.isArray(record.emails)) {
            emails = record.emails;
          } else if (email) {
            emails = [email];
          }
          
          // Additional information
          const notes = record.notes || record.comments || record.description || record.additional_info || null;

          // Normalize payRateType based on common variations
          const normalizedPayRateType: "UmbrellaNG" | "Sub-Contractor" = payRateType.toLowerCase().includes("umbrella") || 
                                       payRateType.toLowerCase().includes("paye") || 
                                       payRateType.toLowerCase().includes("payroll") ? "UmbrellaNG" : "Sub-Contractor";

          // Determine payRateValue based on type
          const payRateValue = normalizedPayRateType === "UmbrellaNG" 
            ? (payRateFixed ? payRateFixed.toString().replace(/[,$]/g, '') : null)
            : (payRatePercentage ? payRatePercentage.toString().replace(/[,$]/g, '') : null);

          // Create comprehensive agency data with proper typing
          const agencyData = {
            id: nanoid(),
            companyId,
            agencyName: agencyName.trim(),
            emails: emails.length > 0 ? emails : [],
            payRateType: normalizedPayRateType,
            currency: currency || "GBP",
            contactPerson: contactPerson || null,
            phone: phone || null,
            address: address || null,
            codaRef: codaRef || null,
            status: status || "active",
            payRateValue: payRateValue || null,
            payRatePercentage: normalizedPayRateType === "Sub-Contractor" ? payRateValue : null,
            paymentTerms: parseInt(paymentTerms.toString()) || 30,
            vatTable: Boolean(vatTable) || null,
            accountInvoiceRequired: Boolean(accountInvoiceRequired) || null,
            vatNumber: vatNumber || null,
            bankDetails: bankDetails,
            notes: notes || null
          };

          console.log(`Creating agency: ${agencyName} (${normalizedPayRateType})`);
          const agency = await storage.createAgency(agencyData);
          processedAgencies.push(agency);

        } catch (agencyError: any) {
          console.error(`Error creating agency from record:`, agencyError);
          errors.push(`Failed to create agency: ${agencyError?.message || "Unknown error"}`);
        }
      }

      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: processedAgencies.length > 0,
        processedAgencies: processedAgencies,
        failed: errors.length,
        errors: errors,
        message: `Successfully processed ${processedAgencies.length} agency record(s)`,
        rawExtraction: structuredData
      });

    } catch (error) {
      console.error("Error processing bulk agency upload:", error);
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: "Failed to process agency document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get uploaded file
  app.get("/api/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('./uploads', filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Super Admin API Routes
  
  // Super admin login endpoint - PROTECTED FROM REGULAR ADMINS
  app.post("/api/super-admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // SECURITY: Only check super admin table, never regular company admins
      const superAdmin = await storage.getSuperAdminByUsername(username);
      if (!superAdmin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await storage.verifyPassword(password, superAdmin.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // SECURITY: Clear any existing regular admin session to prevent privilege escalation
      if (req.session.userId || req.session.companyId) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
        });
      }

      // Create super admin session with proper privileges
      req.session.superAdminId = superAdmin.id;
      req.session.userType = 'super_admin';
      req.session.isAuthenticated = true;

      res.json({
        id: superAdmin.id,
        username: superAdmin.username,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        userType: 'super_admin'
      });
    } catch (error) {
      console.error("Super admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Super admin register endpoint
  app.post("/api/super-admin/register", async (req, res) => {
    try {
      const { username, password, email, fullName } = req.body;
      
      if (!username || !password || !email || !fullName) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Split full name into first and last name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Check if super admin already exists
      const existingSuperAdmin = await storage.getSuperAdminByUsername(username);
      if (existingSuperAdmin) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Create super admin
      const superAdmin = await storage.createSuperAdmin({
        username,
        password,
        email,
        firstName,
        lastName
      });

      // Create session
      req.session.superAdminId = superAdmin.id;
      req.session.userType = 'super_admin';
      req.session.isAuthenticated = true;

      console.log("Super admin session created:", {
        superAdminId: req.session.superAdminId,
        userType: req.session.userType,
        isAuthenticated: req.session.isAuthenticated
      });

      res.json({
        id: superAdmin.id,
        username: superAdmin.username,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        userType: 'super_admin',
        isAuthenticated: true
      });
    } catch (error) {
      console.error("Super admin registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Get all companies (super admin only)
  app.get("/api/super-admin/companies", requireSuperAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompaniesForSuperAdmin();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  // Create company (super admin only)
  app.post("/api/super-admin/companies", requireSuperAdmin, async (req, res) => {
    try {
      const { companyName, contactEmail, username, password } = req.body;
      
      if (!companyName || !contactEmail || !username || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Create company first
      const company = await storage.createCompanyBySuperAdmin({
        companyName,
        contactEmail,
        organizationId: null // For now, we don't have organizations
      });

      // Create company admin user
      const companyAdmin = await storage.createCompanyAdmin({
        username,
        password,
        email: contactEmail,
        firstName: companyName.split(' ')[0] || 'Admin',
        lastName: 'Admin',
        companyId: company.id,
        role: 'admin'
      });

      res.json({
        id: company.id,
        companyName: company.companyName,
        contactEmail: company.contactEmail,
        username: companyAdmin.username,
        active: company.active,
        createdAt: company.createdAt
      });
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Update company (super admin only)
  app.put("/api/super-admin/companies/:id", requireSuperAdmin, async (req, res) => {
    try {
      const companyId = req.params.id;
      const { companyName, contactEmail, username, password } = req.body;
      
      if (!companyName || !contactEmail || !username) {
        return res.status(400).json({ error: "Company name, contact email, and username are required" });
      }

      // Update company
      const company = await storage.updateCompany(companyId, {
        companyName,
        contactEmail
      });

      // Update company admin
      const updateData: any = {
        username,
        email: contactEmail,
        firstName: companyName.split(' ')[0] || 'Admin',
        lastName: 'Admin'
      };

      if (password) {
        updateData.password = password;
      }

      await storage.updateCompanyAdminByCompanyId(companyId, updateData);

      res.json({
        id: company.id,
        companyName: company.companyName,
        contactEmail: company.contactEmail,
        username: updateData.username,
        active: company.active,
        createdAt: company.createdAt
      });
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  // Delete company (super admin only)
  app.delete("/api/super-admin/companies/:id", requireSuperAdmin, async (req, res) => {
    try {
      const companyId = req.params.id;
      
      // Delete company admin first
      await storage.deleteCompanyAdminByCompanyId(companyId);
      
      // Delete company
      await storage.deleteCompany(companyId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // Company admin login endpoint - PROTECTED FROM SUPER ADMINS  
  app.post("/api/company/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // SECURITY: Only check company admin table, never super admins
      const user = await storage.getUserByUsername(username);
      if (!user || user.role !== 'admin') {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await storage.verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // SECURITY: Clear any existing super admin session to prevent privilege mixing
      if (req.session.superAdminId) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
        });
      }

      // Create company admin session with restricted privileges
      req.session.userId = user.id;
      req.session.userType = 'company_admin';
      req.session.companyId = user.companyId;
      req.session.isAuthenticated = true;

      // Get company details
      const company = await storage.getCompany(user.companyId);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        companyName: company?.companyName,
        userType: 'company_admin'
      });
    } catch (error) {
      console.error("Company admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Main user endpoint - handles both super admin and company admin sessions
  app.get("/api/user", async (req, res) => {
    try {
      console.log("API /user called. Session data:", {
        superAdminId: req.session.superAdminId,
        userId: req.session.userId,
        userType: req.session.userType,
        isAuthenticated: req.session.isAuthenticated
      });

      // Check for super admin session
      if (req.session.superAdminId && req.session.userType === 'super_admin') {
        console.log("Super admin session detected, returning response");
        
        // For now, return what we have in the session + hardcoded response structure
        const response = {
          id: req.session.superAdminId,
          userType: 'super_admin',
          isAuthenticated: true
        };
        
        return res.json(response);
      }
      
      // Check for company admin session  
      if (req.session.userId && (req.session.userType === 'company_admin' || req.session.userType === 'admin')) {
        const user = await storage.getUserById(req.session.userId);
        if (user) {
          const company = await storage.getCompany(user.companyId);
          return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            companyId: user.companyId,
            companyName: company?.companyName,
            userType: 'admin',
            role: user.role
          });
        }
      }
      
      // No valid session found
      return res.status(401).json({ error: "Not authenticated" });
    } catch (error) {
      console.error("Error in /api/user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ========================================
  // HMRC RTI API ENDPOINTS
  // ========================================

  // HMRC OAuth authorization
  app.get("/api/hmrc/auth", requireCompanyDataAccess, async (req, res) => {
    try {
      const { HMRCService } = await import("./hmrc-service");
      const hmrcService = new HMRCService();
      const authUrl = hmrcService.generateAuthUrl(req.companyId);
      res.json({ authUrl });
    } catch (error) {
      console.error("HMRC auth URL generation error:", error);
      res.status(500).json({ error: "Failed to generate HMRC auth URL" });
    }
  });

  // HMRC OAuth callback
  app.get("/api/hmrc/callback", async (req, res) => {
    try {
      const { code, state } = req.query as { code: string; state: string };
      
      if (!code) {
        return res.status(400).json({ error: "Authorization code missing" });
      }

      const { HMRCService } = await import("./hmrc-service");
      const hmrcService = new HMRCService();
      
      // Exchange code for token
      const token = await hmrcService.exchangeCodeForToken(code);
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (token.expires_in * 1000));
      
      // Store token in database (need to implement this in storage)
      // await storage.storeHMRCToken({ ... });

      // Redirect to success page
      res.redirect("/?hmrc=connected");
    } catch (error) {
      console.error("HMRC callback error:", error);
      res.redirect("/?hmrc=error");
    }
  });

  // Check HMRC connection status
  app.get("/api/hmrc/status", requireCompanyDataAccess, async (req, res) => {
    try {
      // TODO: Implement getHMRCToken in storage
      // const token = await storage.getHMRCToken(req.companyId!);
      
      res.json({
        connected: false,
        message: "HMRC integration available - connect with credentials"
      });
    } catch (error) {
      console.error("HMRC status check error:", error);
      res.status(500).json({ error: "Failed to check HMRC status" });
    }
  });

  // Submit FPS to HMRC
  app.post("/api/hmrc/submit-fps", requireCompanyDataAccess, async (req, res) => {
    try {
      const { employerRef, payPeriodStart, payPeriodEnd, employees } = req.body;
      
      // Validate required fields
      if (!employerRef || !payPeriodStart || !payPeriodEnd || !employees) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // TODO: Get HMRC token and submit to HMRC
      // This will be implemented once storage methods are added
      
      res.json({ 
        success: true, 
        message: "FPS submission ready - HMRC credentials required" 
      });
    } catch (error) {
      console.error("FPS submission error:", error);
      res.status(500).json({ error: "Failed to submit FPS" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
