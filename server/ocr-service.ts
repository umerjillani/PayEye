import OpenAI from "openai";
import fs from "fs";
import path from "path";
import XLSX from 'xlsx';
import { createWorker } from "tesseract.js";
import { fromPath } from "pdf2pic";

// the newest AI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Exact required keys from Python script (24 fields)
const REQUIRED_KEYS = [
  "Agency", "Person Name", "Shift details", "Start data", "Time sheet number", "Hours charged",
  "Pay Rate", "Gross Pay", "Employe type (LTD/PAYE)", "Total Received", "Customer Code",
  "Suplier Code", "Shift", "Remittance number", "Remittance Data", "Status", "Remittance Status",
  "Primo Status", "Shift Data", "Invoice Status", "Coda Agency Reference", "Code Reference",
  "Invoice Description", "PP Reference"
];

// Exact implementation of Python normalize_key function
function normalizeKey(key: string): string {
  return key.replace(/\W+/g, '').toLowerCase();
}

// Exact implementation of Python search_key function
function searchKey(keyToSearch: string, jsonData: any): any[] {
  const normalizedTarget = normalizeKey(keyToSearch);
  const results: any[] = [];
  
  function recursiveSearch(data: any) {
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        for (const item of data) {
          recursiveSearch(item);
        }
      } else {
        for (const [k, v] of Object.entries(data)) {
          if (normalizeKey(k) === normalizedTarget) {
            results.push(v);
          }
          recursiveSearch(v);
        }
      }
    }
  }
  
  recursiveSearch(jsonData);
  return results;
}

async function extractAgencyEntitiesFromText(text: string, requiredKeys: string[]): Promise<any> {
  try {
    console.log("Extracting agency entities from text with AI...");

    const prompt = `
You are an AI assistant specialized in extracting structured data from agency management documents.

Extract information for MULTIPLE AGENCIES from the following text. The text may contain information about various recruitment agencies.

Required format: Return ONLY a valid JSON object with this exact structure:
{
  "records": [
    {
      "agencyName": "Agency Name Here",
      "contactPerson": "Contact Person Name",
      "email": "primary@email.com",
      "emails": ["email1@domain.com", "email2@domain.com"],
      "phone": "Phone Number",
      "address": "Full Address",
      "codaRef": "Reference Code",
      "status": "active",
      "payRateType": "UmbrellaNG or Sub-Contractor",
      "payRateFixed": "Fixed amount for UmbrellaNG",
      "payRatePercentage": "Percentage for Sub-Contractor",
      "currency": "GBP",
      "paymentTerms": 30,
      "vatTable": true,
      "accountInvoiceRequired": false,
      "vatNumber": "VAT Number",
      "bankDetails": {
        "bankName": "Bank Name",
        "accountNumber": "Account Number",
        "sortCode": "Sort Code",
        "iban": "IBAN if available",
        "swiftCode": "SWIFT if available",
        "accountHolder": "Account Holder Name"
      },
      "notes": "Additional information"
    }
  ]
}

IMPORTANT EXTRACTION RULES:
1. Extract ALL agencies found in the document - don't limit to one
2. For employment/payment types: map "umbrella", "PAYE", "payroll" to "UmbrellaNG", map "limited company", "contractor", "freelance" to "Sub-Contractor"
3. Handle multiple email addresses - put primary email in "email" field and all emails in "emails" array
4. Numbers must be formatted as clean decimals (e.g., 8.25 not 8.25000000001)
5. Use "GBP" as default currency unless specified otherwise
6. Set paymentTerms to 30 days unless specified otherwise
7. For boolean fields (vatTable, accountInvoiceRequired), use true/false based on context
8. Extract all available banking information into bankDetails object
9. Set status to "active" unless document indicates otherwise
10. If specific field is not found, use null (not empty string)

Extract from this text:
${text}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data extraction specialist focused on recruitment agency information. Always return valid JSON with the exact structure requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0 // Exact setting for consistency
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from AI");
    }

    console.log("AI Response for agencies:", content);
    const result = JSON.parse(content);
    
    return result;

  } catch (error) {
    console.error("Error in extractAgencyEntitiesFromText:", error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractEmployeeEntitiesFromText(text: string, requiredKeys: string[]): Promise<any> {
  const keysStr = requiredKeys.map(key => `"${key}"`).join(", ");
  
  const prompt = `
You are an AI assistant specialized in extracting structured employee data from bulk employee upload documents.

EXTRACTION TASK:
Analyze the following text and extract employee information into a structured JSON format.

CRITICAL FORMATTING RULES:
1. Format ALL numbers with maximum 2 decimal places (e.g., 8.25 not 8.25000000001)
2. Remove any commas from numeric values (e.g., "1250.00" not "1,250.00")
3. Use consistent decimal formatting for monetary values
4. For employment types: map "PAYE", "umbrella", "payroll" to "umbrellaNg", map "limited", "contractor", "self-employed" to "subcontractor"

REQUIRED OUTPUT FORMAT:
{
  "records": [
    {
      "firstName": "string (required)",
      "lastName": "string (required)", 
      "email": "string or null",
      "phone": "string or null",
      "address": "string or null",
      "employmentType": "subcontractor or umbrellaNg",
      "nationalInsuranceNumber": "string or null",
      "taxCode": "string or null", 
      "emergencyTaxCode": "boolean or null",
      "payRate": "decimal number (e.g., 25.00)",
      "bankName": "string or null",
      "accountNumber": "string or null",
      "sortCode": "string or null",
      "dateOfBirth": "YYYY-MM-DD format or null",
      "startDate": "YYYY-MM-DD format or null",
      "supplierCode": "string or null",
      "status": "active, inactive, or pending",
      "title": "Mr, Mrs, Ms, Dr, etc. or null",
      "middleName": "string or null",
      "gender": "Male, Female, Other, or null",
      "nationality": "string or null",
      "maritalStatus": "Single, Married, Divorced, etc. or null",
      "nextOfKin": "string or null",
      "emergencyContact": "string or null",
      "emergencyPhone": "string or null",
      "visaStatus": "string or null",
      "passportNumber": "string or null", 
      "drivingLicense": "string or null",
      "rightToWork": "boolean or null",
      "vatNumber": "string or null"
    }
  ]
}

FIELD MAPPING GUIDANCE:
- employmentType: Map "PAYE", "umbrella", "payroll" → "umbrellaNg"; "limited", "contractor", "self-employed" → "subcontractor"
- status: Map "yes", "true", "1", "active" → "active"; "no", "false", "0", "inactive" → "inactive"
- rightToWork: Map "yes", "true", "eligible", "authorized" → true; "no", "false", "not eligible" → false
- emergencyTaxCode: Map "yes", "true", "emergency", "BR", "D0", "D1" → true; "no", "false", "standard" → false
- payRate: Extract hourly/daily rate as decimal number, remove currency symbols
- dates: Convert to YYYY-MM-DD format, handle various date formats (DD/MM/YYYY, MM-DD-YYYY, etc.)
- phone numbers: Clean format, remove spaces/dashes but keep country codes
- NINumber: Format as XX123456X (2 letters, 6 digits, 1 letter)

INPUT TEXT:
${text}

Extract all employee records found in the text. Ensure numeric formatting follows the rules above.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data extraction specialist focused on employee information. Always return valid JSON with the exact structure requested."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0 // Exact setting for consistency with Python version
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from AI");
    }

    console.log("AI Response for employees:", content);
    const result = JSON.parse(content);
    
    return result;

  } catch (error) {
    console.error("Error in extractEmployeeEntitiesFromText:", error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractEntitiesFromText(text: string, requiredKeys: string[]): Promise<any> {
  const keysStr = requiredKeys.map(key => `"${key}"`).join(", ");
  
  const prompt = `
You are an AI assistant specialized in extracting structured data from payroll and remittance documents.

EXTRACTION TASK:
Analyze the following text and extract employee payroll information into a structured JSON format.

CRITICAL FORMATTING RULES:
1. Format ALL numbers with maximum 2 decimal places (e.g., 8.25 not 8.25000000001)
2. Remove any commas from numeric values (e.g., "1250.00" not "1,250.00")
3. Use consistent decimal formatting for monetary values
4. Preserve exact agency names and employee names as they appear

REQUIRED OUTPUT FORMAT:
{
  "records": [
    {
      "Agency": "string (agency name exactly as shown)",
      "Person Name": "string (employee full name)",
      "Shift details": "string or null",
      "Start data": "date string or null", 
      "Time sheet number": "string or null",
      "Hours charged": "decimal number (e.g., 40.00)",
      "Pay Rate": "decimal number (e.g., 25.00)",
      "Gross Pay": "decimal number (e.g., 1000.00)",
      "Employe type (LTD/PAYE)": "LTD or PAYE",
      "Total Received": "decimal number or null",
      "Customer Code": "string or null",
      "Suplier Code": "string or null", 
      "Shift": "string or null",
      "Remittance number": "string or null",
      "Remittance Data": "date string or null",
      "Status": "string or null",
      "Remittance Status": "string or null",
      "Primo Status": "string or null",
      "Shift Data": "date string or null",
      "Invoice Status": "string or null",
      "Coda Agency Reference": "string or null",
      "Code Reference": "string or null",
      "Invoice Description": "string or null",
      "PP Reference": "string or null"
    }
  ]
}

FIELD MAPPING GUIDANCE:
- Agency: Extract exact agency/company names as they appear in the document
- Person Name: Extract full employee names (first + last name)
- Hours charged: Extract total hours worked as decimal (e.g., 37.5, 40.0)
- Pay Rate: Extract hourly/daily rate as decimal number, remove currency symbols
- Gross Pay: Calculate or extract total pay amount
- Employee type: Map variations like "Limited Company", "Ltd", "Contractor" → "LTD"; "PAYE", "Employee", "Permanent" → "PAYE"
- All monetary values: Remove commas, currency symbols, format to 2 decimal places
- Dates: Preserve original format or convert to standard format if clear
- Reference numbers: Extract as-is including alphanumeric codes

AVAILABLE FIELDS TO EXTRACT: ${keysStr}

INPUT TEXT:
${text}

Extract all employee records found in the text. Focus on payroll/remittance data. Ensure numeric formatting follows the rules above.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data extraction specialist focused on payroll and remittance information. Always return valid JSON with the exact structure requested."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0 // Exact setting for consistency with Python version
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from AI");
    }

    console.log("AI Response:", content);
    const result = JSON.parse(content);
    
    return result;

  } catch (error: any) {
    console.error("Error in extractEntitiesFromText:", error);
    
    // If AI extraction fails (e.g., quota exceeded), return a fallback structure with the raw text
    if (error.status === 429 || error.code === 'insufficient_quota') {
      console.log("AI quota exceeded, returning raw OCR text as fallback");
      
      // Try to extract basic information from raw text using multiple pattern approaches
      
      // Pattern 1: Look for employee names (First Last pattern at beginning of lines)
      const namePatterns = [
        // Look for names in candidate/employee sections (like "Tapiwa Mandeya 17936372")
        /(?:Candidate|Employee|Worker|Person)\s*[\s\S]*?^([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d{6,}/m,
        // Name followed by long number (timesheet/employee ID)
        /^([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d{6,}/m,
        // Name in data rows (not headers like "London" or "FROM:")
        /^(?!FROM:|TO:|VAT|Company|Invoice)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+\d+|\s*$)/m,
        // Generic name pattern but avoid common header words
        /(?:Name|Employee|Worker|Person|Candidate)[\s:]+([A-Za-z\s]+?)(?:\n|$|\d)/i
      ];
      let employeeName = "Unknown Employee";
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const candidateName = match[1].trim();
          // Skip if it looks like a header or address
          if (!candidateName.match(/^(FROM|TO|VAT|Invoice|London|Company|Date|Road|Street|House)/i)) {
            employeeName = candidateName;
            break;
          }
        }
      }
      
      // Pattern 2: Look for hours (various formats)
      const hoursPatterns = [
        /(\d+\.?\d*)\s*Hour\(s\)/i, // "19.50 Hour(s)"
        /(?:Hours|Total Hours|Hours Worked|Hours charged)[\s:]+(\d+\.?\d*)/i,
        /(\d+\.?\d*)\s*(?:hours?|hrs?)/i,
        /Standard Rate\s+(\d+\.?\d*)\s+Hour/i // From remittance format
      ];
      let hours = "0";
      for (const pattern of hoursPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          hours = match[1];
          break;
        }
      }
      
      // Pattern 3: Look for pay rate (various formats)  
      const ratePatterns = [
        /Hour\(s\)\s*@\s*£?(\d+\.?\d*)/i, // "Hour(s) @ 55.00"
        /@\s*£?(\d+\.?\d*)/i, // "@ 55.00"
        /(?:Rate|Pay Rate|Hourly Rate)[\s:]+£?(\d+\.?\d*)/i,
        /£?(\d+\.?\d*)\s*(?:per hour|\/hr|\/hour)/i
      ];
      let rate = "0";
      for (const pattern of ratePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          rate = match[1];
          break;
        }
      }
      
      // Pattern 4: Look for gross pay/total (various formats)
      const grossPatterns = [
        /(\d{1,3}(?:,\d{3})*\.?\d*)\s+\d+\.\d+\s+\d+\.\d+\s+[\d,]+\.\d+$/m, // "1,072.50 214.50 20.00 1,287.00"
        /(?:Gross Pay|Total Pay|Total|TOTAL \(GBP\))[\s:]+£?(\d{1,3}(?:,\d{3})*\.?\d*)/i,
        /Total before VAT\s+(\d{1,3}(?:,\d{3})*\.?\d*)/i,
        /(\d{1,3}(?:,\d{3})*\.?\d*)\s+(?:before VAT|excl VAT|excluding VAT)/i
      ];
      let gross = "0";
      for (const pattern of grossPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          gross = match[1].replace(/,/g, '');
          break;
        }
      }
      
      // Pattern 5: Look for agency/company names
      const agencyPatterns = [
        /TO:\s*([^\n]+)/i, // "TO: Archer Resourcing Ltd"
        /(?:Agency|Company|Client)[\s:]+([^\n]+)/i,
        /FROM:\s*([^\n]+)/i // "FROM: PayWize Limited"
      ];
      let agency = "Unknown Agency";
      for (const pattern of agencyPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          agency = match[1].trim();
          break;
        }
      }
      
      // Pattern 6: Look for dates/period
      const datePatterns = [
        /(?:Period End|PeriodEnd|Week Ending|Date)[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})/, // Any date format
        /(\d{4}-\d{2}-\d{2})/ // ISO date format
      ];
      let weekEnding = null;
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          weekEnding = match[1];
          break;
        }
      }
      
      console.log("Fallback extraction results:", {
        employeeName,
        hours,
        rate,
        gross,
        agency,
        weekEnding
      });
      
      return {
        success: true,
        fallbackMode: true,
        extractedText: text,
        records: [{
          "Person Name": employeeName,
          "Hours charged": hours,
          "Pay Rate": rate,
          "Gross Pay": gross,
          "Employee type": "PAYE",
          "Agency": agency,
          "Shift Data": weekEnding
        }],
        message: "AI extraction unavailable - using basic text parsing"
      };
    }
    
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractFromImage(imagePath: string): Promise<string> {
  console.log(`Extracting text from image: ${imagePath}`);
  
  const worker = await createWorker();
  try {
    const { data: { text } } = await worker.recognize(imagePath);
    console.log(`Image OCR completed. Text length: ${text.length}`);
    return text;
  } finally {
    await worker.terminate();
  }
}

async function extractFromPdf(pdfPath: string): Promise<string> {
  console.log(`Extracting text from PDF: ${pdfPath}`);
  
  const options = {
    density: 300,
    saveFilename: "page",
    savePath: path.dirname(pdfPath),
    format: "jpeg",
    width: 2000,
    height: 2000
  };

  try {
    console.log("Converting PDF to images...");
    const convert = fromPath(pdfPath, options);
    const pages = await convert.bulk(-1);
    console.log(`PDF converted to ${pages.length} image(s)`);
    
    let allText = "";
    const worker = await createWorker('eng');
    
    try {
      for (const page of pages) {
        console.log(`Processing page: ${page.path}`);
        const { data: { text } } = await worker.recognize(page.path);
        allText += text + "\n";
        
        // Clean up the temporary image file
        try {
          fs.unlinkSync(page.path);
        } catch (error) {
          console.warn(`Could not delete temporary file: ${page.path}`);
        }
      }
    } finally {
      await worker.terminate();
    }
    
    console.log(`PDF OCR completed. Total text length: ${allText.length}`);
    return allText;
  } catch (error) {
    console.error("Error in PDF extraction:", error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractFromExcel(excelPath: string): Promise<string> {
  console.log(`Extracting text from Excel: ${excelPath}`);
  
  try {
    const workbook = XLSX.readFile(excelPath);
    let allText = "";
    
    // Process all sheets
    workbook.SheetNames.forEach(sheetName => {
      console.log(`Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      allText += `\n=== ${sheetName} ===\n${csvText}\n`;
    });
    
    console.log(`Excel extraction completed. Text length: ${allText.length} characters`);
    return allText;
  } catch (error) {
    console.error("Error in Excel extraction:", error);
    throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractText(filePath: string): Promise<string> {
  const fileExtension = path.extname(filePath).toLowerCase();
  console.log(`Extracting text from file: ${filePath} (${fileExtension})`);
  
  switch (fileExtension) {
    case '.pdf':
      return await extractFromPdf(filePath);
    case '.xlsx':
    case '.xls':
      return await extractFromExcel(filePath);
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.bmp':
    case '.tiff':
      return await extractFromImage(filePath);
    case '.csv':
      // For CSV, read directly as text
      return fs.readFileSync(filePath, 'utf8');
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
}

function extractFloat(text: string): number | null {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // Remove currency symbols, commas, and extra spaces
  const cleaned = text.replace(/[£$€,\s]/g, '').trim();
  
  // Try to parse as float
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed)) {
    return null;
  }
  
  return parsed;
}

function formatNumber(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }
  
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
  
  if (isNaN(num)) {
    return '0.00';
  }
  
  // Round to 2 decimal places and format
  return Number(num.toFixed(2)).toString();
}

function cleanExtractedData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => cleanExtractedData(item));
  }
  
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = cleanExtractedData(value);
    }
    return cleaned;
  }
  
  if (typeof data === 'string') {
    // Check if this looks like a monetary value or decimal number
    const monetaryPattern = /^[£$€]?[\d,]+\.?\d*$/;
    const decimalPattern = /^\d+\.\d+$/;
    
    if (monetaryPattern.test(data.trim()) || decimalPattern.test(data.trim())) {
      const num = extractFloat(data);
      if (num !== null) {
        return formatNumber(num);
      }
    }
  }
  
  return data;
}

async function createJSON(folderPath: string, requiredKeys: string[], outputDir: string): Promise<any> {
  // This function is kept for compatibility but not used in the main flow
  return { success: false, error: "Not implemented" };
}

export async function processTimesheetDocument(filePath: string): Promise<any> {
  try {
    console.log(`Starting timesheet processing for: ${filePath}`);
    
    // Step 1: Extract text from document (PDF, Excel, images)
    const extractedText = await extractText(filePath);
    console.log(`Extracted text length: ${extractedText.length}`);
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error("No meaningful text extracted from document");
    }
    
    // Step 2: Define timesheet-specific extraction keys
    const timesheetKeys = REQUIRED_KEYS; // Use standard keys for consistency in multi-record extraction
    
    // Step 3: Use AI to extract structured timesheet data with proper multi-record support
    console.log("Sending timesheet data to AI for structured extraction...");
    const structuredData = await extractEntitiesFromText(extractedText, timesheetKeys);
    
    // Ensure we always have a records array structure for consistent processing
    if (!structuredData.records) {
      // If AI didn't return records array, wrap the data in one
      structuredData.records = [structuredData];
    }
    
    // Check if we got a fallback response due to AI quota issues
    if (structuredData.fallbackMode) {
      console.log("AI extraction in fallback mode - using basic text parsing");
      // Return the fallback data in the expected format
      return {
        success: true,
        extractedText: extractedText,
        structuredData: structuredData,
        documentType: 'timesheet',
        fallbackMode: true,
        message: structuredData.message || "AI extraction unavailable - using basic text parsing"
      };
    }
    
    console.log("AI extraction completed for timesheet");
    
    // Step 4: Clean and format numeric data
    const cleanedData = cleanExtractedData(structuredData);
    console.log("Cleaned timesheet data:", JSON.stringify(cleanedData, null, 2));
    
    return {
      success: true,
      extractedText: extractedText,
      structuredData: cleanedData,
      documentType: 'timesheet'
    };
    
  } catch (error) {
    console.error("Error processing timesheet document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      documentType: 'timesheet'
    };
  }
}

export async function processRemittanceDocument(filePath: string): Promise<any> {
  try {
    console.log(`Starting OCR processing for: ${filePath}`);
    
    // Step 1: Extract text from document (exact Python OCR logic)
    const extractedText = await extractText(filePath);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log("Extracted text preview:", extractedText.substring(0, 500));
    
    if (!extractedText || extractedText.trim().length === 0) {
      console.log("No text extracted from document");
      return {
        error: "No text could be extracted from the document",
        records: []
      };
    }
    
    // Step 2: Extract entities using exact Python prompt and logic
    const extractedData = await extractEntitiesFromText(extractedText, REQUIRED_KEYS);
    console.log("Raw extracted data:", JSON.stringify(extractedData, null, 2));
    
    if (!extractedData.records || !Array.isArray(extractedData.records)) {
      return {
        error: "No structured data could be extracted",
        records: []
      };
    }
    
    // Step 3: Apply Python filtering logic - remove "Others" agencies
    extractedData.records = extractedData.records.filter((record: any) => {
      const agency = record.Agency || record.agency || "";
      return !agency.toLowerCase().includes("others");
    });
    
    console.log(`After filtering: ${extractedData.records.length} records remain`);
    
    // Step 4: Calculate Manual Total Gross Pays using exact Python searchKey logic
    const grossPayResults = searchKey("Gross Pay", extractedData);
    let manualTotalGrossPays = 0;
    
    grossPayResults.forEach(value => {
      const floatValue = extractFloat(String(value));
      if (floatValue !== null) {
        manualTotalGrossPays += floatValue;
      }
    });
    
    // Format the manual total properly
    const formattedManualTotal = formatNumber(manualTotalGrossPays);
    console.log(`Manual Total Gross Pays calculated: ${formattedManualTotal}`);
    
    // Step 5: Add Manual Total Gross Pays to the first agency section (exact Python behavior)
    const agencyKeys = Object.keys(extractedData).filter(key => key !== 'records');
    if (agencyKeys.length > 0) {
      if (!extractedData[agencyKeys[0]]) {
        extractedData[agencyKeys[0]] = {};
      }
      extractedData[agencyKeys[0]]["Manual Total Gross Pays"] = formattedManualTotal;
    }
    
    // Step 6: Clean and format all numeric data in the extracted records
    const cleanedData = cleanExtractedData(extractedData);
    
    console.log(`OCR processing completed. Found ${cleanedData.records.length} records`);
    return cleanedData;
    
  } catch (error) {
    console.error("Error in processRemittanceDocument:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error occurred",
      records: []
    };
  }
}

export async function processBulkAgencyDocument(filePath: string): Promise<any> {
  try {
    console.log(`Starting bulk agency processing for: ${filePath}`);
    
    // Check if file is CSV - handle directly without OCR
    const fileExtension = filePath.toLowerCase().split('.').pop();
    let extractedText = "";
    
    if (fileExtension === 'csv') {
      console.log("Processing CSV file directly");
      // Read CSV file directly as it's already structured text
      extractedText = fs.readFileSync(filePath, 'utf8');
      console.log(`CSV file content length: ${extractedText.length}`);
    } else {
      // Step 1: Extract text from document (PDF, Excel, images)
      extractedText = await extractText(filePath);
      console.log(`Extracted text length: ${extractedText.length}`);
    }
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error("No meaningful text extracted from document");
    }
    
    // Step 2: Define comprehensive agency extraction keys
    const agencyKeys = [
      // Basic Information
      'agencyName', 'agency_name', 'name', 'company_name', 'business_name',
      'contactPerson', 'contact_person', 'contact', 'representative', 'manager',
      'email', 'email_address', 'contact_email', 'primary_email',
      'phone', 'phone_number', 'telephone', 'mobile', 'contact_number',
      'address', 'business_address', 'office_address', 'head_office',
      
      // Administrative details
      'codaRef', 'coda_ref', 'coda_reference', 'reference', 'ref_code',
      'status', 'agency_status', 'active_status', 'operational_status',
      
      // Financial & payment configuration
      'payRateType', 'pay_rate_type', 'payment_type', 'rate_type',
      'payRateFixed', 'pay_rate_fixed', 'fixed_rate', 'umbrella_rate',
      'payRatePercentage', 'pay_rate_percentage', 'percentage_rate', 'margin_rate',
      'currency', 'payment_currency', 'base_currency',
      'paymentTerms', 'payment_terms', 'payment_period', 'terms',
      
      // Compliance & tax
      'vatTable', 'vat_table', 'vat_registered', 'vat_registration',
      'accountInvoiceRequired', 'account_invoice_required', 'invoice_required',
      'vatNumber', 'vat_number', 'tax_number',
      
      // Banking information
      'bankName', 'bank_name', 'bank',
      'accountNumber', 'account_number', 'account_no',
      'sortCode', 'sort_code', 'routing_number',
      'iban',
      'swiftCode', 'swift_code', 'bic_code',
      'accountHolder', 'account_holder', 'beneficiary_name',
      
      // Additional information
      'emails', 'email_list', 'contact_emails',
      'notes', 'comments', 'description', 'additional_info'
    ];
    
    // Step 3: Use AI to extract structured agency data
    console.log("Sending agency data to AI for structured extraction...");
    const structuredData = await extractAgencyEntitiesFromText(extractedText, agencyKeys);
    
    console.log("AI extraction completed for bulk agencies");
    
    // Step 4: Clean and format numeric data
    const cleanedData = cleanExtractedData(structuredData);
    console.log("Cleaned agency data:", JSON.stringify(cleanedData, null, 2));
    
    return {
      success: true,
      extractedText: extractedText,
      structuredData: cleanedData,
      records: cleanedData.records || []
    };
    
  } catch (error) {
    console.error("Error processing bulk agency document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      records: []
    };
  }
}

export async function processBulkEmployeeDocument(filePath: string): Promise<any> {
  try {
    console.log(`Starting bulk employee processing for: ${filePath}`);
    
    // Check if file is CSV - handle directly without OCR
    const fileExtension = filePath.toLowerCase().split('.').pop();
    let extractedText = "";
    
    if (fileExtension === 'csv') {
      console.log("Processing CSV file directly");
      // Read CSV file directly as it's already structured text
      extractedText = fs.readFileSync(filePath, 'utf8');
      console.log(`CSV file content length: ${extractedText.length}`);
    } else {
      // Step 1: Extract text from document (PDF, Excel, images)
      extractedText = await extractText(filePath);
      console.log(`Extracted text length: ${extractedText.length}`);
    }
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error("No meaningful text extracted from document");
    }
    
    // Step 2: Define comprehensive employee extraction keys
    const employeeKeys = [
      // Personal Information
      'firstName', 'first_name', 'forename', 'given_name',
      'lastName', 'last_name', 'surname', 'family_name',
      'middleName', 'middle_name', 'middle_initial',
      'title', 'prefix', 'salutation',
      'email', 'email_address', 'contact_email',
      'phone', 'phone_number', 'mobile', 'telephone',
      'address', 'home_address', 'postal_address',
      'dateOfBirth', 'date_of_birth', 'dob', 'birth_date',
      'gender', 'sex',
      'nationality', 'country_of_birth',
      'maritalStatus', 'marital_status',
      
      // Employment Information
      'employmentType', 'employment_type', 'worker_type', 'contract_type',
      'nationalInsuranceNumber', 'ni_number', 'nino', 'national_insurance',
      'taxCode', 'tax_code', 'paye_code',
      'emergencyTaxCode', 'emergency_tax', 'emergency_code',
      'payRate', 'pay_rate', 'hourly_rate', 'daily_rate',
      'startDate', 'start_date', 'employment_start', 'join_date',
      'supplierCode', 'supplier_code', 'employee_id', 'worker_id',
      'status', 'employment_status', 'worker_status',
      
      // Banking Information
      'bankName', 'bank_name', 'bank',
      'accountNumber', 'account_number', 'account_no',
      'sortCode', 'sort_code', 'routing_number',
      
      // Additional Information
      'nextOfKin', 'next_of_kin', 'emergency_contact_name',
      'emergencyContact', 'emergency_contact', 'emergency_person',
      'emergencyPhone', 'emergency_phone', 'emergency_number',
      'visaStatus', 'visa_status', 'immigration_status',
      'passportNumber', 'passport_number', 'passport_no',
      'drivingLicense', 'driving_license', 'license_number',
      'rightToWork', 'right_to_work', 'work_authorization',
      'vatNumber', 'vat_number', 'vat_registration'
    ];
    
    // Step 3: Use AI to extract structured employee data
    console.log("Sending employee data to AI for structured extraction...");
    const structuredData = await extractEmployeeEntitiesFromText(extractedText, employeeKeys);
    
    console.log("AI extraction completed for bulk employees");
    
    // Step 4: Clean and format numeric data
    const cleanedData = cleanExtractedData(structuredData);
    console.log("Cleaned employee data:", JSON.stringify(cleanedData, null, 2));
    
    return {
      success: true,
      extractedText: extractedText,
      structuredData: cleanedData,
      records: cleanedData.records || []
    };
    
  } catch (error) {
    console.error("Error processing bulk employee document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      records: []
    };
  }
}