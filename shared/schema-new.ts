import { pgTable, text, serial, integer, boolean, decimal, timestamp, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// MULTI-TENANT SAAS ARCHITECTURE SCHEMA
// ========================================

// 1. Super Admin table - only for software creators/maintainers
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

// 2. Organizations table - customers who buy the software
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

// 3. Organization Admins table - admins within each organization
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

// 4. Companies table - for multi-company support within organizations
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  companyName: text("company_name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0078D4"),
  contactEmail: text("contact_email").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Agencies table
export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 6. Candidates/Employees table
export const candidates = pgTable("candidates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 7. Timesheets table
export const timesheets = pgTable("timesheets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 8. Invoices table
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 9. Payslips table
export const payslips = pgTable("payslips", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 10. Payments table
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
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

// 11. Payment Batches table
export const paymentBatches = pgTable("payment_batches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  companyId: text("company_id").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  processedBy: text("processed_by").notNull(),
  status: text("status").default("pending"), // pending, processed, failed
  bankFileUrl: text("bank_file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 12. Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  companyId: text("company_id").notNull(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // create, update, delete
  oldData: json("old_data"),
  newData: json("new_data"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ========================================
// INSERT SCHEMAS AND TYPES
// ========================================

// Super Admin schemas
export const insertSuperAdminSchema = createInsertSchema(superAdmins).omit({
  id: true,
  createdAt: true,
});

// Organization schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  createdAt: true,
});

// Organization Admin schemas
export const insertOrganizationAdminSchema = createInsertSchema(organizationAdmins).omit({
  id: true,
  createdAt: true,
});

// Company schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  createdAt: true,
});

// Agency schemas
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

// Candidate/Employee schemas
export const insertCandidateSchema = createInsertSchema(candidates).omit({
  createdAt: true,
});

// Timesheet schemas
export const insertTimesheetSchema = createInsertSchema(timesheets).omit({
  createdAt: true,
});

// Invoice schemas
export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  createdAt: true,
});

// Payslip schemas
export const insertPayslipSchema = createInsertSchema(payslips).omit({
  createdAt: true,
});

// Payment schemas
export const insertPaymentSchema = createInsertSchema(payments).omit({
  createdAt: true,
});

// Payment Batch schemas
export const insertPaymentBatchSchema = createInsertSchema(paymentBatches).omit({
  createdAt: true,
});

// Audit Log schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs);

// ========================================
// TYPES
// ========================================

// Super Admin types
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type InsertSuperAdmin = z.infer<typeof insertSuperAdminSchema>;

// Organization types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Organization Admin types
export type OrganizationAdmin = typeof organizationAdmins.$inferSelect;
export type InsertOrganizationAdmin = z.infer<typeof insertOrganizationAdminSchema>;

// Company types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// Agency types
export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;

// Candidate/Employee types
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

// Timesheet types
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;

// Invoice types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Payslip types
export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;

// Payment types
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Payment Batch types
export type PaymentBatch = typeof paymentBatches.$inferSelect;
export type InsertPaymentBatch = z.infer<typeof insertPaymentBatchSchema>;

// Audit Log types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// ========================================
// AUTHENTICATION HELPER TYPES
// ========================================

// Union type for all admin types
export type AdminUser = SuperAdmin | OrganizationAdmin;

// Admin with context type
export type AdminWithContext = {
  user: AdminUser;
  userType: 'super' | 'organization';
  organizationId?: string;
  permissions?: string[];
};