import OpenAI from "openai";
import fs from "fs";
import path from "path";
import * as XLSX from 'xlsx';
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

// Employee-specific AI extraction function (agency extraction handled separately)
2. Remove any commas from numeric values (e.g., "1250.00" not "1,250.00")
3. Use consistent decimal formatting for monetary values

REQUIRED OUTPUT FORMAT:
{
  "records": [
    {
      "agencyName": "string (required)",
      "contactPerson": "string or null",
      "email": "string or null",
      "emails": ["string array for multiple emails"],
      "phone": "string or null", 
      "address": "string or null",
      "codaRef": "string or null",
      "status": "active, inactive, or pending",
      "payRateType": "UmbrellaNG or Sub-Contractor",
      "payRateFixed": "decimal number for UmbrellaNG (e.g., 25.00)",
      "payRatePercentage": "decimal number for Sub-Contractor (e.g., 8.25)",
      "currency": "GBP, EUR, USD, etc.",
      "paymentTerms": "number (payment days, e.g., 30)",
      "vatTable": "boolean",
      "accountInvoiceRequired": "boolean",
      "vatNumber": "string or null",
      "bankDetails": {
        "bankName": "string or null",
        "accountNumber": "string or null", 
        "sortCode": "string or null",
        "iban": "string or null",
        "swiftCode": "string or null",
        "accountHolder": "string or null"
      },
      "notes": "string or null"
    }
  ]
}

FIELD MAPPING GUIDANCE:
- payRateType: Map "umbrella", "PAYE", "payroll" → "UmbrellaNG"; "limited", "contractor", "self-employed" → "Sub-Contractor"
- status: Map "yes", "true", "1", "active" → "active"; "no", "false", "0", "inactive" → "inactive"
- vatTable: Map "yes", "true", "registered", "VAT" → true; "no", "false", "not registered" → false
- accountInvoiceRequired: Default to true for Sub-Contractor, false for UmbrellaNG
- currency: Default to "GBP" if not specified
- paymentTerms: Extract number of days (e.g., "30 days" → 30)

INPUT TEXT:
${text}

Extract all agency records found in the text. Ensure numeric formatting follows the rules above.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a precise data extraction specialist. Extract agency information and format numbers correctly with maximum 2 decimal places and no commas in numeric values."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    });

    const extractedData = JSON.parse(response.choices[0].message.content || '{}');
    console.log("AI agency extraction completed");
    
    return extractedData;
    
  } catch (error) {
    console.error("Error in AI agency entity extraction:", error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
You are an expert in extracting structured employee data from Excel/CSV files for bulk employee uploads.

The following text contains employee data from a spreadsheet. Each row typically represents one employee record with their personal, employment, and financial details.

IMPORTANT GUIDELINES:
- This is structured spreadsheet data from Excel/CSV files
- Look for column headers to understand the data structure
- Each row contains employee information like: name, contact details, employment type, pay rates, tax information
- Handle various date formats (Excel dates, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
- FORMAT ALL NUMBERS WITH MAXIMUM 2 DECIMAL PLACES: use "25.50" not "25.5000000", use "8.25" not "8.25000000001"
- Extract all available employee fields, even if some are empty

REQUIRED FIELDS TO EXTRACT FOR EACH EMPLOYEE:
${keysStr}

EMPLOYMENT TYPES TO RECOGNIZE:
- "PAYE" - Regular employed workers
- "Limited Company" or "Ltd" - Self-employed through limited companies  
- "Umbrella" - Workers through umbrella companies

FIELD MAPPING EXAMPLES:
- Names: "First Name", "Forename", "Given Name" → first_name
- Contact: "Email Address", "Contact Email" → email
- Employment: "Worker Type", "Category", "Employment Status" → employment_type
- Tax: "NI Number", "National Insurance", "NINO" → national_insurance
- Pay: "Hourly Rate", "Daily Rate", "Annual Salary" → pay_rate

Return a JSON object with this structure:
{
  "records": [
    {
      "first_name": "John",
      "last_name": "Smith",
      "email": "john.smith@email.com",
      "phone": "07123456789",
      "employment_type": "PAYE",
      "pay_rate": "25.00",
      "national_insurance": "AB123456C",
      "tax_code": "1257L",
      "gender": "Male",
      "date_of_birth": "1990-05-15",
      "address": "123 Main Street, London, SW1A 1AA",
      "agency": "ABC Recruitment",
      "bank_name": "Barclays",
      "account_number": "12345678",
      "sort_code": "20-00-00",
      ...
    }
  ],
  "summary": {
    "total_employees": 5,
    "paye_employees": 3,
    "limited_company_employees": 2,
    "agencies": ["ABC Recruitment", "XYZ Staffing"]
  }
}

Employee Data:
${text}

Return only the JSON object, no additional text.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Error extracting employee entities from text:", error);
    return { records: [] };
  }
}

// Exact implementation of Python extract_entities_from_text function
async function extractEntitiesFromText(text: string, requiredKeys: string[]): Promise<any> {
  const keysStr = requiredKeys.map(key => `"${key}"`).join(", ");
  
  const prompt = `
You are an expert in extracting structured timesheet data from documents, especially Excel spreadsheets.

The following text contains timesheet data from a clean Excel file. Each row typically represents one timesheet entry for an employee. Look for standard timesheet columns and data patterns.

IMPORTANT GUIDELINES:
- This is structured spreadsheet data, not OCR text
- Each row usually contains: employee name, date, hours worked, hourly rate, total pay, client information
- Excel dates may appear as serial numbers (convert to readable dates)
- Hours may be in decimal format (e.g., 8.5 hours, 0.25 hours)
- FORMAT ALL NUMBERS WITH MAXIMUM 2 DECIMAL PLACES: use "8.25" not "8.25000000001", use "25.50" not "25.5000000"
- Pay rates and totals should be preserved as numbers but rounded to 2 decimal places
- Look for column headers to understand data structure

Your goal is to extract:

1. "records" — individual timesheet entries:
- Extract these keys for each record: ${keysStr}
- If a value is missing, set it to null
- Convert decimal hours to readable format when appropriate
- Preserve numerical accuracy for rates and pay amounts
- Handle Excel date formats properly

2. Summary information — totals, agency names, metadata

Return a JSON object with this structure:
{
  "records": [
    {
      "employee_name": "John Smith",
      "date": "2025-01-15", 
      "hours_worked": "8.5",
      "hourly_rate": "25.00",
      "total_pay": "212.50",
      "client": "ABC Corp",
      ...
    }
  ],
  "Summary": {
    "Agency": "...",
    "Total Hours": "...",
    "Total Pay": "..."
  }
}

OCR Text:
${text}

Return only the JSON object, no additional text.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Error extracting entities from text:", error);
    return { records: [] };
  }
}

// Exact implementation of Python extract_from_image function
async function extractFromImage(imagePath: string): Promise<string> {
  try {
    const worker = await createWorker();
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    return text;
  } catch (error) {
    console.error("Error extracting from image:", error);
    return "";
  }
}

// PDF extraction using pdf2pic + Tesseract OCR with improved error handling
async function extractFromPdf(pdfPath: string): Promise<string> {
  try {
    console.log("Processing PDF with pdf2pic + Tesseract OCR");
    
    // Configure pdf2pic with explicit GraphicsMagick settings
    const options = {
      density: 200,           // Lower density for better compatibility
      saveFilename: "page",
      savePath: path.join(path.dirname(pdfPath), "temp_images"),
      format: "png",
      width: 1654,
      height: 2339
    };
    
    // Create temp directory if it doesn't exist
    const tempDir = options.savePath;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`Converting PDF to images with options:`, options);
    const convert = fromPath(pdfPath, options);
    
    // Convert all pages (-1 means all pages)
    const pageImages = await convert.bulk(-1);
    console.log(`Successfully converted ${pageImages.length} PDF pages to images`);
    
    let allText = "";
    const worker = await createWorker('eng');
    
    // Process each page with OCR
    for (let i = 0; i < pageImages.length; i++) {
      const imageResult = pageImages[i];
      if (!imageResult || !imageResult.path) {
        console.log(`Skipping page ${i + 1} - no path available`);
        continue;
      }
      
      const imagePath = imageResult.path;
      console.log(`Processing page ${i + 1} with OCR: ${imagePath}`);
      
      try {
        const { data: { text } } = await worker.recognize(imagePath as string);
        allText += text + "\n\n";
        console.log(`Page ${i + 1} extracted ${text.length} characters`);
        
        // Clean up temporary image file
        if (fs.existsSync(imagePath as string)) {
          fs.unlinkSync(imagePath as string);
        }
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError);
      }
    }
    
    await worker.terminate();
    
    // Clean up temp directory
    try {
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.log("Could not remove temp directory:", cleanupError);
    }
    
    console.log(`PDF extraction completed. Total text length: ${allText.length}`);
    console.log("PDF text preview:", allText.substring(0, 500));
    
    return allText;
  } catch (error) {
    console.error("Error extracting from PDF:", error);
    console.error("PDF conversion failed, attempting alternative method...");
    
    // Fallback: Try to use Tesseract directly on PDF (will likely fail but worth trying)
    try {
      console.log("Attempting direct PDF OCR as fallback...");
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(pdfPath);
      await worker.terminate();
      
      if (text && text.length > 0) {
        console.log(`Fallback method succeeded. Text length: ${text.length}`);
        return text;
      }
    } catch (fallbackError) {
      console.error("Fallback method also failed:", fallbackError);
    }
    
    return "";
  }
}

// Enhanced Excel extraction for clean timesheet data
async function extractFromExcel(excelPath: string): Promise<string> {
  try {
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellNF: false });
    let allText = "";
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON first to better handle data types
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        raw: false, 
        dateNF: 'yyyy-mm-dd',
        defval: ''
      });
      
      // Also try with headers for better structure
      const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: ''
      });
      
      // Create structured text representation
      if (jsonWithHeaders.length > 0) {
        allText += `=== Sheet: ${sheetName} ===\n`;
        
        // Add headers if available
        const firstRow = jsonWithHeaders[0];
        if (firstRow && typeof firstRow === 'object') {
          const headers = Object.keys(firstRow);
          allText += headers.join('\t') + '\n';
          
          // Add data rows
          jsonWithHeaders.forEach((row: any) => {
            const values = headers.map(header => {
              const value = row[header];
              // Handle different data types properly
              if (value === null || value === undefined) return '';
              if (typeof value === 'number') return value.toString();
              if (value instanceof Date) return value.toISOString().split('T')[0];
              return String(value);
            });
            allText += values.join('\t') + '\n';
          });
        } else {
          // Fallback to array format
          jsonData.forEach((row: any) => {
            if (Array.isArray(row)) {
              const values = row.map(cell => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'number') return cell.toString();
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String(cell);
              });
              allText += values.join('\t') + '\n';
            }
          });
        }
        allText += '\n';
      }
    }
    
    console.log(`Excel extraction successful. Text length: ${allText.length}`);
    console.log("Excel text preview:", allText.substring(0, 500));
    return allText;
  } catch (error) {
    console.error("Error extracting from Excel:", error);
    return "";
  }
}

// Exact implementation of Python extract_text function
async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    return await extractFromImage(filePath);
  } else if (ext === '.pdf') {
    return await extractFromPdf(filePath);
  } else if (['.xls', '.xlsx'].includes(ext)) {
    return await extractFromExcel(filePath);
  }
  
  return '';
}

// Exact implementation of Python extract_float function
function extractFloat(text: string): number | null {
  // First try to match numbers with 2 decimal places (common for currency)
  let match = text.match(/\d+\.\d{2}\b/);
  if (match) {
    return parseFloat(match[0]);
  }
  
  // Then try to match any decimal number and round to 2 decimal places
  match = text.match(/\d+\.\d+/);
  if (match) {
    const value = parseFloat(match[0]);
    // Round to 2 decimal places to avoid floating point precision issues
    return Math.round(value * 100) / 100;
  }
  
  // Finally try to match whole numbers
  match = text.match(/\d+/);
  if (match) {
    return parseFloat(match[0]);
  }
  
  return null;
}

// Helper function to format numbers properly and avoid floating point precision issues
function formatNumber(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  const num = parseFloat(String(value).replace(/[,$"]/g, ''));
  if (isNaN(num)) {
    return String(value);
  }
  
  // Round to 2 decimal places to avoid floating point precision issues
  const rounded = Math.round(num * 100) / 100;
  
  // Return with 2 decimal places for currency-like values, or clean format for others
  if (rounded % 1 === 0) {
    return rounded.toString(); // "25" not "25.00" for whole numbers
  } else {
    return rounded.toFixed(2); // "25.50" for decimal numbers
  }
}

// Helper function to clean and format extracted data
function cleanExtractedData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(cleanExtractedData);
  } else if (data && typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Apply number formatting to specific fields
      if (key.toLowerCase().includes('pay') || 
          key.toLowerCase().includes('rate') || 
          key.toLowerCase().includes('hour') ||
          key.toLowerCase().includes('amount') ||
          key.toLowerCase().includes('fee') ||
          key.toLowerCase().includes('vat') ||
          key.toLowerCase().includes('total')) {
        cleaned[key] = formatNumber(value);
      } else {
        cleaned[key] = cleanExtractedData(value);
      }
    }
    return cleaned;
  }
  return data;
}

// Exact implementation of Python create_JSON function
async function createJSON(folderPath: string, requiredKeys: string[], outputDir: string): Promise<any> {
  // For single file processing, we modify this to work with text directly
  // This will be called from processRemittanceDocument with extracted text
  return {};
}

// Main processing function for timesheet documents
export async function processTimesheetDocument(filePath: string): Promise<any> {
  try {
    console.log(`Starting timesheet OCR processing for: ${filePath}`);
    
    // Step 1: Extract text from document (exact Python OCR logic)
    const extractedText = await extractText(filePath);
    console.log(`Extracted text length: ${extractedText.length}`);
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error("No meaningful text extracted from document");
    }
    
    // Step 2: Define timesheet-specific extraction keys
    const timesheetKeys = [
      'employee_name', 'candidate_name', 'worker_name', 'name',
      'week_ending', 'week_end', 'period_ending', 'date',
      'hours_worked', 'total_hours', 'regular_hours', 'overtime_hours',
      'hourly_rate', 'rate', 'pay_rate',
      'total_pay', 'gross_pay', 'total_amount',
      'client', 'client_name', 'company', 'agency',
      'project', 'job_code', 'department',
      'start_date', 'end_date', 'shift_start', 'shift_end'
    ];
    
    // Step 3: Use AI to extract structured timesheet data
    console.log("Sending timesheet text to AI for structured extraction...");
    const structuredData = await extractEntitiesFromText(extractedText, timesheetKeys);
    
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

// Main processing function that combines OCR and JSON creation
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

// Main processing function for bulk employee documents
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
      'agency_name', 'agencyName', 'name', 'company_name', 'business_name',
      'contact_person', 'contactPerson', 'contact', 'representative', 'manager',
      'email', 'email_address', 'contact_email', 'primary_email',
      'phone', 'phone_number', 'telephone', 'mobile', 'contact_number',
      'address', 'business_address', 'office_address', 'head_office',
      
      // Administrative Details
      'coda_ref', 'codaRef', 'coda_reference', 'reference', 'ref_code',
      'supplier_code', 'supplierCode', 'vendor_code', 'agency_code',
      'status', 'agency_status', 'active_status', 'operational_status',
      
      // Financial & Payment Configuration
      'pay_rate_type', 'payRateType', 'payment_type', 'rate_type',
      'pay_rate_fixed', 'payRateFixed', 'fixed_rate', 'umbrella_rate',
      'pay_rate_percentage', 'payRatePercentage', 'percentage_rate', 'margin_rate',
      'currency', 'payment_currency', 'base_currency',
      'payment_terms', 'paymentTerms', 'payment_period', 'terms',
      
      // Compliance & Tax
      'vat_table', 'vatTable', 'vat_registered', 'vat_registration',
      'account_invoice_required', 'accountInvoiceRequired', 'invoice_required',
      'vat_number', 'vatNumber', 'tax_number',
      
      // Banking Information
      'bank_name', 'bankName', 'bank',
      'account_number', 'accountNumber', 'account_no',
      'sort_code', 'sortCode', 'routing_number',
      'iban', 'swift_code', 'swiftCode', 'bic_code',
      'account_holder', 'accountHolder', 'beneficiary_name',
      
      // Multiple Contact Methods
      'emails', 'email_list', 'contact_emails', 'all_emails',
      'secondary_email', 'billing_email', 'accounts_email',
      
      // Additional Information
      'notes', 'comments', 'description', 'additional_info',
      'sector', 'industry', 'specialization', 'service_type'
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
    
    // Step 2: Define comprehensive employee extraction keys (all fields from employee form)
    const employeeKeys = [
      // Basic Information
      'first_name', 'firstName', 'first', 'fname',
      'last_name', 'lastName', 'last', 'lname', 'surname',
      'email', 'email_address', 'contact_email',
      'phone', 'phone_number', 'mobile', 'contact_number', 'telephone',
      'address', 'home_address', 'residential_address', 'street_address',
      
      // Personal Details
      'gender', 'sex',
      'date_of_birth', 'dob', 'birth_date', 'birthdate',
      'reference', 'ref_number', 'reference_number', 'employee_ref',
      
      // Employment Information
      'employment_type', 'employmentType', 'type', 'category', 'worker_type',
      'agency', 'agency_name', 'supplier', 'recruitment_agency',
      'pay_rate', 'payRate', 'hourly_rate', 'rate', 'salary', 'wage',
      'sector', 'industry', 'department',
      'payment_frequency', 'paymentFrequency', 'pay_frequency',
      'payroll_processor', 'payrollProcessor', 'processor',
      'first_pay_date', 'firstPayDate', 'start_pay_date',
      
      // Tax Information (PAYE)
      'national_insurance', 'ni_number', 'nino', 'nationalInsuranceNumber', 'ni_no',
      'tax_code', 'taxCode', 'tax_reference',
      'ni_code', 'niCode', 'ni_category',
      'emergency_tax_code', 'emergencyTaxCode', 'emergency_tax',
      
      // Limited Company Details
      'company_name', 'companyName', 'ltd_name', 'business_name',
      'registration_number', 'companyRegistrationNumber', 'reg_number', 'company_reg',
      'vat_number', 'vatNumber', 'vat_registration',
      'corporation_tax_reference', 'corporationTaxReference', 'corp_tax_ref',
      
      // Banking Information
      'bank_name', 'bankName', 'bank',
      'account_number', 'accountNumber', 'account_no',
      'sort_code', 'sortCode', 'sort_code_number',
      
      // Status and Processing
      'status', 'employee_status', 'worker_status',
      'supplier_code', 'supplierCode', 'supplier_ref',
      'percentage_cap', 'percentageCap', 'cap_percentage',
      'margin', 'margin_rate', 'fee_rate',
      'coda_ref', 'codaRef', 'coda_reference',
      'remittance_status', 'remittanceStatus', 'payment_status'
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

// Export helper functions for bulk employee processing  
export { extractText, extractEntitiesFromText };