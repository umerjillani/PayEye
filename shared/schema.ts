import { pgTable, text, serial, integer, boolean, decimal, timestamp, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// LEGACY SCHEMA - GRADUALLY MIGRATING TO MULTI-TENANT
// ========================================

// Users table - will be replaced by superAdmins and organizationAdmins
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("admin"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Super Admin table - only for software creators/maintainers
export const superAdmins = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  lastLogin: timestamp("last_login"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Organizations table - customers who buy the software
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  organizationName: text("organization_name").notNull(),
  subdomainSlug: text("subdomain_slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0078D4"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address"),
  planTier: text("plan_tier").default("professional"),
  subscriptionStatus: text("subscription_status").default("active"), // active, suspended, cancelled
  billingContact: text("billing_contact"),
  technicalContact: text("technical_contact"),
  maxUsers: integer("max_users").default(50),
  maxAgencies: integer("max_agencies").default(100),
  maxEmployees: integer("max_employees").default(1000),
  active: boolean("active").default(true),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").notNull(), // super admin who created this org
});

// Organization Admins table - admins within each organization
export const organizationAdmins = pgTable("organization_admins", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(), // admin, manager, accountant, viewer
  permissions: json("permissions").$type<string[]>().default([]), // granular permissions
  lastLogin: timestamp("last_login"),
  firstTimeLogin: boolean("first_time_login").default(true),
  status: text("status").default("active"),
  invitedBy: integer("invited_by"), // super admin or org admin who invited
  inviteToken: text("invite_token"),
  inviteExpiry: timestamp("invite_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies table - for backward compatibility and multi-company support within orgs
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"), // Made optional for backward compatibility
  companyName: text("company_name").notNull(),
  subdomainSlug: text("subdomain_slug"), // Added for backward compatibility
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0078D4"),
  contactEmail: text("contact_email").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agencies table
export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"), // Made optional for backward compatibility
  companyId: text("company_id").notNull(),
  agencyName: text("agency_name").notNull(),
  accountInvoiceRequired: boolean("account_invoice_required").default(false),
  vatTable: boolean("vat_table").default(false),
  codaRef: text("coda_ref"),
  contactPerson: text("contact_person"),
  emails: json("emails").$type<string[]>().default([]), // Multiple emails
  phone: text("phone"),
  address: text("address"),
  paymentTerms: integer("payment_terms").default(30),
  notes: text("notes"),
  status: text("status").default("active"),
  // Bank details for agency payments
  bankDetails: json("bank_details").$type<{
    bankName: string;
    accountNumber: string;
    sortCode: string;
    iban?: string;
    swiftCode?: string;
    accountHolderName: string;
  }>(),
  // Pay rate configuration
  payRateType: text("pay_rate_type").$type<"UmbrellaNG" | "Sub-Contractor">().default("UmbrellaNG"),
  payRateValue: decimal("pay_rate_value"), // Fixed amount for UmbrellaNG
  payRatePercentage: decimal("pay_rate_percentage"), // Percentage for Sub-Contractor
  currency: text("currency").default("GBP"), // GBP, EUR, USD, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidates/Employees table
export const candidates = pgTable("candidates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"), // Made optional for backward compatibility
  companyId: text("company_id").notNull(),
  agencyIds: json("agency_ids").$type<string[]>().default([]), // Multiple agencies per employee
  title: text("title"), // Title field (Mr, Mrs, Dr, etc.)
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  supplierCode: text("supplier_code"),
  employmentType: text("employment_type").notNull(), // subcontractor (Limited Company), umbrellaNg (PAYE or Umbrella)
  
  // PAYE-specific fields
  taxCode: text("tax_code"), // Required for PAYE
  nationalInsuranceNumber: text("national_insurance_number"), // Required for PAYE
  emergencyTaxCode: boolean("emergency_tax_code").default(false),
  
  // Limited Company-specific fields
  companyName: text("company_name"), // Required for LTD
  companyRegistrationNumber: text("company_registration_number"), // Required for LTD
  vatNumber: text("vat_number"), // Optional for LTD
  corporationTaxReference: text("corporation_tax_reference"), // Optional for LTD
  
  // Common fields
  referenceNumber: text("reference_number"), // Employee reference number for linking
  percentageCap: decimal("percentage_cap"),
  margin: decimal("margin"),
  codaRef: text("coda_ref"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  sortCode: text("sort_code"),
  status: text("status").default("active"),
  remittanceStatus: text("remittance_status").default("pending"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  payRate: decimal("pay_rate"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Timesheets table
export const timesheets = pgTable("timesheets", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  candidateId: text("candidate_id"),
  agencyId: text("agency_id"),
  shiftType: text("shift_type"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  timesheetNumber: text("timesheet_number"),
  hoursCharged: decimal("hours_charged").notNull(),
  payRate: decimal("pay_rate").notNull(),
  grossPay: decimal("gross_pay").notNull(),
  vat: decimal("vat"),
  totalReceived: decimal("total_received"),
  customerCode: text("customer_code"),
  supplierCode: text("supplier_code"),
  shiftDetails: text("shift_details"),
  remittanceNumber: text("remittance_number"),
  remittanceDate: timestamp("remittance_date"),
  status: text("status").default("pending"), // pending, approved, rejected
  remittanceStatus: text("remittance_status").default("pending"),
  primoStatus: text("primo_status"),
  invoiceRequired: boolean("invoice_required").default(true),
  vatAble: boolean("vat_able").default(false),
  invoiceStatus: text("invoice_status").default("pending"),
  originalDocumentUrl: text("original_document_url"),
  extractedData: json("extracted_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  agencyId: text("agency_id").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  vat: decimal("vat"),
  netAmount: decimal("net_amount").notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").default("outstanding"), // outstanding, paid, overdue
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payslips table
export const payslips = pgTable("payslips", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  timesheetId: text("timesheet_id").notNull(),
  payPeriodStart: timestamp("pay_period_start").notNull(),
  payPeriodEnd: timestamp("pay_period_end").notNull(),
  grossPay: decimal("gross_pay").notNull(),
  deductions: json("deductions"),
  netPay: decimal("net_pay").notNull(),
  employmentType: text("employment_type").notNull(),
  adminFee: decimal("admin_fee"),
  taxDetails: json("tax_details"),
  pensionContribution: decimal("pension_contribution"),
  pdfUrl: text("pdf_url"),
  status: text("status").default("generated"),
  paymentStatus: text("payment_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  amount: decimal("amount").notNull(),
  bankAccountNumber: text("bank_account_number").notNull(),
  sortCode: text("sort_code").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  status: text("status").default("pending"), // pending, processed, failed
  batchId: text("batch_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Batches table
export const paymentBatches = pgTable("payment_batches", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  processedBy: text("processed_by").notNull(),
  status: text("status").default("pending"), // pending, processed, failed
  bankFileUrl: text("bank_file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // create, update, delete
  oldData: json("old_data"),
  newData: json("new_data"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// HMRC OAuth tokens for companies
export const hmrcTokens = pgTable("hmrc_tokens", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type").notNull(),
  expiresIn: integer("expires_in").notNull(),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// HMRC RTI submissions (FPS/EPS)
export const hmrcSubmissions = pgTable("hmrc_submissions", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  submissionType: text("submission_type").notNull(), // 'FPS' or 'EPS'
  submissionId: text("submission_id"), // HMRC's submission ID
  acknowledgementReference: text("acknowledgement_reference"),
  status: text("status").notNull().default("PENDING"), // PENDING, ACCEPTED, REJECTED
  employerRef: text("employer_ref").notNull(),
  payPeriodStart: date("pay_period_start").notNull(),
  payPeriodEnd: date("pay_period_end").notNull(),
  employeeCount: integer("employee_count"),
  totalGrossPay: decimal("total_gross_pay", { precision: 10, scale: 2 }),
  totalTax: decimal("total_tax", { precision: 10, scale: 2 }),
  totalNI: decimal("total_ni", { precision: 10, scale: 2 }),
  submissionData: json("submission_data"), // Full JSON payload sent to HMRC
  responseData: json("response_data"), // Full JSON response from HMRC
  errors: json("errors"), // Any errors from HMRC
  submittedBy: integer("submitted_by"), // User who submitted
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// HMRC submission details for each employee in FPS
export const hmrcSubmissionEmployees = pgTable("hmrc_submission_employees", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  candidateId: text("candidate_id"), // Links to candidates table
  nino: text("nino").notNull(),
  employeeName: text("employee_name").notNull(),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  ni: decimal("ni", { precision: 10, scale: 2 }).notNull(),
  studentLoan: decimal("student_loan", { precision: 10, scale: 2 }),
  paymentDate: date("payment_date").notNull(),
  timesheetIds: json("timesheet_ids").$type<string[]>(), // Links to timesheets
  createdAt: timestamp("created_at").defaultNow(),
});

// RTI Employment Records
export const rtiEmploymentRecords = pgTable("rti_employment_records", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  nino: text("nino").notNull(),
  employerName: text("employer_name"),
  taxCode: text("tax_code"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  payFrequency: text("pay_frequency"),
  employerPayeReference: text("employer_paye_reference"),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payroll Batches
export const payrollBatches = pgTable("payroll_batches", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  batchName: text("batch_name").notNull(),
  taxWeek: integer("tax_week").notNull(),
  taxYear: text("tax_year").notNull(),
  dateFrom: text("date_from").notNull(),
  dateTo: text("date_to").notNull(),
  status: text("status").notNull(),
  totalEmployees: integer("total_employees").default(0),
  totalGrossPay: text("total_gross_pay").default("0"),
  totalTax: text("total_tax").default("0"),
  totalNI: text("total_ni").default("0"),
  processedAt: timestamp("processed_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payroll Batch Items
export const payrollBatchItems = pgTable("payroll_batch_items", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  agencyId: text("agency_id"),
  hoursWorked: text("hours_worked").notNull(),
  hourlyRate: text("hourly_rate").notNull(),
  grossPay: text("gross_pay").notNull(),
  taxCode: text("tax_code"),
  taxDeduction: text("tax_deduction").default("0"),
  niDeduction: text("ni_deduction").default("0"),
  cisDeduction: text("cis_deduction").default("0"),
  netPay: text("net_pay").notNull(),
  materials: text("materials").default("0"),
  margin: text("margin").default("0"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Additional payroll tables continue here...

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  createdAt: true,
});

export const insertAgencySchema = createInsertSchema(agencies).omit({
  createdAt: true,
}).extend({
  emails: z.array(z.string().email()).min(1, "At least one email is required"),
  bankDetails: z.object({
    bankName: z.string(),
    accountNumber: z.string(),
    sortCode: z.string(),
    iban: z.string().optional(),
    swiftCode: z.string().optional(),
    accountHolderName: z.string(),
  }).optional(),
  payRateType: z.enum(["UmbrellaNG", "Sub-Contractor"]).default("UmbrellaNG"),
  currency: z.string().default("GBP"),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  createdAt: true,
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  createdAt: true,
});

export const insertPayslipSchema = createInsertSchema(payslips).omit({
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  createdAt: true,
});

export const insertPaymentBatchSchema = createInsertSchema(paymentBatches).omit({
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs);

export const insertHmrcTokenSchema = createInsertSchema(hmrcTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHmrcSubmissionSchema = createInsertSchema(hmrcSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertHmrcSubmissionEmployeeSchema = createInsertSchema(hmrcSubmissionEmployees).omit({
  id: true,
  createdAt: true,
});

export const insertRTIEmploymentRecordSchema = createInsertSchema(rtiEmploymentRecords).omit({
  id: true,
  retrievedAt: true,
  createdAt: true,
});

export const insertPayrollBatchSchema = createInsertSchema(payrollBatches).omit({
  id: true,
  createdAt: true,
});

export const insertPayrollBatchItemSchema = createInsertSchema(payrollBatchItems).omit({
  id: true,
  createdAt: true,
});

export const insertHMRCSubmissionSchema = createInsertSchema(hmrcSubmissions).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PaymentBatch = typeof paymentBatches.$inferSelect;
export type InsertPaymentBatch = z.infer<typeof insertPaymentBatchSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type RTIEmploymentRecord = typeof rtiEmploymentRecords.$inferSelect;
export type InsertRTIEmploymentRecord = z.infer<typeof insertRTIEmploymentRecordSchema>;
export type PayrollBatch = typeof payrollBatches.$inferSelect;
export type InsertPayrollBatch = z.infer<typeof insertPayrollBatchSchema>;
export type PayrollBatchItem = typeof payrollBatchItems.$inferSelect;
export type InsertPayrollBatchItem = z.infer<typeof insertPayrollBatchItemSchema>;
export type HMRCSubmission = typeof hmrcSubmissions.$inferSelect;
export type InsertHMRCSubmission = z.infer<typeof insertHMRCSubmissionSchema>;
export type HMRCToken = typeof hmrcTokens.$inferSelect;
export type InsertHMRCToken = z.infer<typeof insertHmrcTokenSchema>;
export type HMRCSubmissionEmployee = typeof hmrcSubmissionEmployees.$inferSelect;
export type InsertHMRCSubmissionEmployee = z.infer<typeof insertHmrcSubmissionEmployeeSchema>;
