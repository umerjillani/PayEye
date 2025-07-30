import { 
  users, companies, agencies, candidates, timesheets, invoices, payslips, payments, paymentBatches, auditLogs,
  rtiEmploymentRecords, payrollBatches, payrollBatchItems, hmrcSubmissions, superAdmins,
  type User, type InsertUser, type Company, type InsertCompany, type Agency, type InsertAgency,
  type Candidate, type InsertCandidate, type Timesheet, type InsertTimesheet, type Invoice, type InsertInvoice,
  type Payslip, type InsertPayslip, type Payment, type InsertPayment, type PaymentBatch, type InsertPaymentBatch,
  type AuditLog, type InsertAuditLog, type RTIEmploymentRecord, type InsertRTIEmploymentRecord,
  type PayrollBatch, type InsertPayrollBatch, type PayrollBatchItem, type InsertPayrollBatchItem,
  type HMRCSubmission, type InsertHMRCSubmission
} from "../shared/schema.js";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { nanoid } from "nanoid";
import { db, pool } from "./db";
import { eq, and } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(supplied: string, stored: string): Promise<boolean>;

  // Company methods
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;

  // Agency methods
  getAgencies(companyId: string): Promise<Agency[]>;
  getAgency(id: string): Promise<Agency | undefined>;
  getAgencyByName(companyId: string, agencyName: string): Promise<Agency | undefined>;
  createAgency(agency: InsertAgency): Promise<Agency>;
  updateAgency(id: string, agency: Partial<InsertAgency>): Promise<Agency | undefined>;
  deleteAgency(id: string): Promise<boolean>;

  // Candidate methods
  getCandidates(companyId: string): Promise<Candidate[]>;
  getCandidatesByAgency(agencyId: string): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByName(companyId: string, fullName: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, candidate: Partial<InsertCandidate>): Promise<Candidate | undefined>;
  deleteCandidate(id: string): Promise<boolean>;

  // Timesheet methods
  getTimesheets(companyId: string): Promise<Timesheet[]>;
  getTimesheetsByStatus(companyId: string, status: string): Promise<Timesheet[]>;
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  createTimesheet(timesheet: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  deleteTimesheet(id: string): Promise<boolean>;

  // Invoice methods
  getInvoices(companyId: string): Promise<Invoice[]>;
  getInvoicesByStatus(companyId: string, status: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Payslip methods
  getPayslips(companyId: string): Promise<Payslip[]>;
  getPayslip(id: string): Promise<Payslip | undefined>;
  createPayslip(payslip: InsertPayslip): Promise<Payslip>;

  // Payment methods
  getPayments(companyId: string): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;

  // Payment Batch methods
  getPaymentBatches(companyId: string): Promise<PaymentBatch[]>;
  getPaymentBatch(id: string): Promise<PaymentBatch | undefined>;
  createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch>;

  // Audit Log methods
  getAuditLogs(companyId: string): Promise<AuditLog[]>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;

  // RTI Employment Record methods
  getRTIEmploymentRecords(candidateId: string): Promise<RTIEmploymentRecord[]>;
  getLatestRTIRecord(candidateId: string): Promise<RTIEmploymentRecord | undefined>;
  createRTIEmploymentRecord(record: InsertRTIEmploymentRecord): Promise<RTIEmploymentRecord>;

  // Payroll Batch methods
  getPayrollBatches(companyId: string): Promise<PayrollBatch[]>;
  getPayrollBatch(id: string): Promise<PayrollBatch | undefined>;
  createPayrollBatch(batch: InsertPayrollBatch): Promise<PayrollBatch>;
  updatePayrollBatch(id: string, updates: Partial<InsertPayrollBatch>): Promise<PayrollBatch | undefined>;

  // Payroll Batch Item methods
  getPayrollBatchItems(batchId: string): Promise<PayrollBatchItem[]>;
  getPayrollBatchItem(id: string): Promise<PayrollBatchItem | undefined>;
  createPayrollBatchItem(item: InsertPayrollBatchItem): Promise<PayrollBatchItem>;
  updatePayrollBatchItem(id: string, updates: Partial<InsertPayrollBatchItem>): Promise<PayrollBatchItem | undefined>;

  // HMRC Submission methods
  getHMRCSubmissions(batchId: string): Promise<HMRCSubmission[]>;
  createHMRCSubmission(submission: InsertHMRCSubmission): Promise<HMRCSubmission>;

  // Super Admin methods
  getSuperAdminByUsername(username: string): Promise<any | undefined>;
  createSuperAdmin(admin: any): Promise<any>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
  getAllCompaniesForSuperAdmin(): Promise<any[]>;
  createCompanyBySuperAdmin(company: any): Promise<any>;
  createCompanyAdmin(admin: any): Promise<any>;
  updateCompany(id: string, updates: any): Promise<any>;
  updateCompanyAdminByCompanyId(companyId: string, updates: any): Promise<void>;
  deleteCompanyAdminByCompanyId(companyId: string): Promise<void>;
  deleteCompany(id: string): Promise<void>;

  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private companies: Map<string, Company>;
  private agencies: Map<string, Agency>;
  private candidates: Map<string, Candidate>;
  private timesheets: Map<string, Timesheet>;
  private invoices: Map<string, Invoice>;
  private payslips: Map<string, Payslip>;
  private payments: Map<string, Payment>;
  private paymentBatches: Map<string, PaymentBatch>;
  private auditLogs: Map<string, AuditLog>;
  private rtiEmploymentRecords: Map<string, RTIEmploymentRecord>;
  private payrollBatches: Map<string, PayrollBatch>;
  private payrollBatchItems: Map<string, PayrollBatchItem>;
  private hmrcSubmissions: Map<string, HMRCSubmission>;
  private currentUserId: number;
  sessionStore: any;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.agencies = new Map();
    this.candidates = new Map();
    this.timesheets = new Map();
    this.invoices = new Map();
    this.payslips = new Map();
    this.payments = new Map();
    this.paymentBatches = new Map();
    this.auditLogs = new Map();
    this.rtiEmploymentRecords = new Map();
    this.payrollBatches = new Map();
    this.payrollBatchItems = new Map();
    this.hmrcSubmissions = new Map();
    this.currentUserId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create sample companies
    const acmeCompany: Company = {
      id: "acme-001",
      companyName: "Acme Payroll Ltd",
      subdomainSlug: "acme",
      logoUrl: "",
      primaryColor: "#0078D4",
      contactEmail: "admin@acme-payroll.com",
      organizationId: null,
      active: true,
      createdAt: new Date(),
    };

    const globalCompany: Company = {
      id: "global-001",
      companyName: "Global Payroll Services",
      subdomainSlug: "global",
      logoUrl: "",
      primaryColor: "#6264A7",
      contactEmail: "admin@global-payroll.com",
      organizationId: null,
      active: true,
      createdAt: new Date(),
    };

    const smartCompany: Company = {
      id: "smart-001",
      companyName: "Smart Payroll Solutions",
      subdomainSlug: "smart",
      logoUrl: "",
      primaryColor: "#22C55E",
      contactEmail: "admin@smart-payroll.com",
      organizationId: null,
      active: true,
      createdAt: new Date(),
    };

    this.companies.set(acmeCompany.id, acmeCompany);
    this.companies.set(globalCompany.id, globalCompany);
    this.companies.set(smartCompany.id, smartCompany);

    // Create sample agencies for Acme
    const agencies = [
      {
        id: "agency-001",
        companyId: "acme-001",
        agencyName: "Healthcare Plus Agency",
        accountInvoiceRequired: true,
        vatTable: true,
        contactPerson: "Sarah Johnson",
        email: "sarah@healthcareplus.com",
        phone: "+44 20 1234 5678",
        address: "123 Healthcare Street, London, UK",
        paymentTerms: 30,
        status: "active",
        createdAt: new Date(),
      },
      {
        id: "agency-002",
        companyId: "acme-001",
        agencyName: "TechStaff Solutions",
        accountInvoiceRequired: true,
        vatTable: true,
        contactPerson: "Michael Brown",
        email: "michael@techstaff.com",
        phone: "+44 20 2345 6789",
        address: "456 Tech Avenue, Manchester, UK",
        paymentTerms: 30,
        status: "active",
        createdAt: new Date(),
      },
      {
        id: "agency-003",
        companyId: "acme-001",
        agencyName: "Care Partners Ltd",
        accountInvoiceRequired: false,
        vatTable: false,
        contactPerson: "Emma Davis",
        email: "emma@carepartners.com",
        phone: "+44 20 3456 7890",
        address: "789 Care Road, Birmingham, UK",
        paymentTerms: 14,
        status: "active",
        createdAt: new Date(),
      },
    ];

    agencies.forEach(agency => this.agencies.set(agency.id, agency as Agency));

    // Create sample candidates
    const candidates = [
      {
        id: "candidate-001",
        companyId: "acme-001",
        agencyId: "agency-001",
        firstName: "Michael",
        lastName: "Brown",
        supplierCode: "SUP001",
        employmentType: "PAYE",
        margin: "15.00",
        bankName: "Barclays Bank",
        accountNumber: "12345678",
        sortCode: "20-12-34",
        taxCode: "1257L",
        status: "active",
        remittanceStatus: "pending",
        phone: "+44 7123 456789",
        email: "michael.brown@example.com",
        address: "10 Worker Street, London, UK",
        payRate: "18.50",
        createdAt: new Date(),
      },
      {
        id: "candidate-002",
        companyId: "acme-001",
        agencyId: "agency-002",
        firstName: "Alice",
        lastName: "Davis",
        supplierCode: "SUP002",
        employmentType: "Umbrella",
        margin: "12.50",
        bankName: "HSBC",
        accountNumber: "23456789",
        sortCode: "40-12-34",
        taxCode: "1257L",
        status: "active",
        remittanceStatus: "pending",
        phone: "+44 7234 567890",
        email: "alice.davis@example.com",
        address: "20 Tech Lane, Manchester, UK",
        payRate: "22.00",
        createdAt: new Date(),
      },
      {
        id: "candidate-003",
        companyId: "acme-001",
        agencyId: "agency-003",
        firstName: "James",
        lastName: "Wilson",
        supplierCode: "SUP003",
        employmentType: "PAYE",
        margin: "18.00",
        bankName: "Lloyds Bank",
        accountNumber: "34567890",
        sortCode: "30-12-34",
        taxCode: "1257L",
        status: "active",
        remittanceStatus: "pending",
        phone: "+44 7345 678901",
        email: "james.wilson@example.com",
        address: "30 Care Close, Birmingham, UK",
        payRate: "16.75",
        createdAt: new Date(),
      },
    ];

    candidates.forEach(candidate => this.candidates.set(candidate.id, candidate as Candidate));

    // Create sample timesheets
    const timesheets = [
      {
        id: "timesheet-001",
        companyId: "acme-001",
        candidateId: "candidate-001",
        agencyId: "agency-001",
        shiftType: "Day Shift",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-01-21"),
        timesheetNumber: "TS-2024-001",
        hoursCharged: "37.5",
        payRate: "18.50",
        grossPay: "693.75",
        vat: "138.75",
        totalReceived: "832.50",
        shiftDetails: "Healthcare support worker",
        status: "pending",
        remittanceStatus: "pending",
        invoiceRequired: true,
        vatAble: true,
        invoiceStatus: "pending",
        createdAt: new Date(),
      },
      {
        id: "timesheet-002",
        companyId: "acme-001",
        candidateId: "candidate-002",
        agencyId: "agency-002",
        shiftType: "Standard",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-01-21"),
        timesheetNumber: "TS-2024-002",
        hoursCharged: "40.0",
        payRate: "22.00",
        grossPay: "880.00",
        vat: "176.00",
        totalReceived: "1056.00",
        shiftDetails: "Software developer",
        status: "pending",
        remittanceStatus: "pending",
        invoiceRequired: true,
        vatAble: true,
        invoiceStatus: "pending",
        createdAt: new Date(),
      },
      {
        id: "timesheet-003",
        companyId: "acme-001",
        candidateId: "candidate-003",
        agencyId: "agency-003",
        shiftType: "Day Shift",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-01-21"),
        timesheetNumber: "TS-2024-003",
        hoursCharged: "32.5",
        payRate: "16.75",
        grossPay: "544.38",
        vat: "108.88",
        totalReceived: "653.26",
        shiftDetails: "Care assistant",
        status: "pending",
        remittanceStatus: "pending",
        invoiceRequired: true,
        vatAble: true,
        invoiceStatus: "pending",
        createdAt: new Date(),
      },
    ];

    timesheets.forEach(timesheet => this.timesheets.set(timesheet.id, timesheet as Timesheet));

    // Create sample invoices
    const invoices = [
      {
        id: "invoice-001",
        companyId: "acme-001",
        invoiceNumber: "INV-2024-0152",
        agencyId: "agency-001",
        totalAmount: "12450.00",
        vat: "2075.00",
        netAmount: "10375.00",
        invoiceDate: new Date("2024-01-01"),
        dueDate: new Date("2024-01-15"),
        status: "overdue",
        createdAt: new Date(),
      },
      {
        id: "invoice-002",
        companyId: "acme-001",
        invoiceNumber: "INV-2024-0149",
        agencyId: "agency-002",
        totalAmount: "8750.00",
        vat: "1458.33",
        netAmount: "7291.67",
        invoiceDate: new Date("2024-01-08"),
        dueDate: new Date("2024-01-22"),
        status: "outstanding",
        createdAt: new Date(),
      },
      {
        id: "invoice-003",
        companyId: "acme-001",
        invoiceNumber: "INV-2024-0147",
        agencyId: "agency-003",
        totalAmount: "15230.00",
        vat: "2538.33",
        netAmount: "12691.67",
        invoiceDate: new Date("2024-01-15"),
        dueDate: new Date("2024-01-28"),
        status: "outstanding",
        createdAt: new Date(),
      },
    ];

    invoices.forEach(invoice => this.invoices.set(invoice.id, invoice as Invoice));
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, createdAt: new Date(), lastLogin: null };
    this.users.set(id, user);
    return user;
  }

  // Company methods
  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    return Array.from(this.companies.values()).find(
      (company) => company.subdomainSlug === slug,
    );
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const newCompany: Company = { ...company, createdAt: new Date() };
    this.companies.set(company.id, newCompany);
    return newCompany;
  }

  // Agency methods
  async getAgencies(companyId: string): Promise<Agency[]> {
    return Array.from(this.agencies.values()).filter(
      (agency) => agency.companyId === companyId,
    );
  }

  async getAgency(id: string): Promise<Agency | undefined> {
    return this.agencies.get(id);
  }

  async getAgencyByName(companyId: string, agencyName: string): Promise<Agency | undefined> {
    return Array.from(this.agencies.values()).find(
      agency => agency.companyId === companyId && 
                agency.agencyName.toLowerCase() === agencyName.toLowerCase()
    );
  }

  async createAgency(agency: InsertAgency): Promise<Agency> {
    const newAgency: Agency = { ...agency, createdAt: new Date() };
    this.agencies.set(agency.id, newAgency);
    return newAgency;
  }

  async updateAgency(id: string, agency: Partial<InsertAgency>): Promise<Agency | undefined> {
    const existingAgency = this.agencies.get(id);
    if (!existingAgency) return undefined;
    
    const updatedAgency = { ...existingAgency, ...agency };
    this.agencies.set(id, updatedAgency);
    return updatedAgency;
  }

  async deleteAgency(id: string): Promise<boolean> {
    return this.agencies.delete(id);
  }

  // Candidate methods
  async getCandidates(companyId: string): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).filter(
      (candidate) => candidate.companyId === companyId,
    );
  }

  async getCandidatesByAgency(agencyId: string): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).filter(
      (candidate) => candidate.agencyId === agencyId,
    );
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }

  async getCandidateByName(companyId: string, fullName: string): Promise<Candidate | undefined> {
    return Array.from(this.candidates.values()).find(
      candidate => candidate.companyId === companyId && 
                   `${candidate.firstName} ${candidate.lastName}`.toLowerCase() === fullName.toLowerCase()
    );
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const newCandidate: Candidate = { ...candidate, createdAt: new Date() };
    this.candidates.set(candidate.id, newCandidate);
    return newCandidate;
  }

  async updateCandidate(id: string, candidate: Partial<InsertCandidate>): Promise<Candidate | undefined> {
    const existingCandidate = this.candidates.get(id);
    if (!existingCandidate) return undefined;
    
    const updatedCandidate = { ...existingCandidate, ...candidate };
    this.candidates.set(id, updatedCandidate);
    return updatedCandidate;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    return this.candidates.delete(id);
  }

  // Timesheet methods
  async getTimesheets(companyId: string): Promise<Timesheet[]> {
    return Array.from(this.timesheets.values()).filter(
      (timesheet) => timesheet.companyId === companyId,
    );
  }

  async getTimesheetsByStatus(companyId: string, status: string): Promise<Timesheet[]> {
    return Array.from(this.timesheets.values()).filter(
      (timesheet) => timesheet.companyId === companyId && timesheet.status === status,
    );
  }

  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    return this.timesheets.get(id);
  }

  async createTimesheet(timesheet: InsertTimesheet): Promise<Timesheet> {
    const newTimesheet: Timesheet = { ...timesheet, createdAt: new Date() };
    this.timesheets.set(timesheet.id, newTimesheet);
    return newTimesheet;
  }

  async updateTimesheet(id: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const existingTimesheet = this.timesheets.get(id);
    if (!existingTimesheet) return undefined;
    
    const updatedTimesheet = { ...existingTimesheet, ...timesheet };
    this.timesheets.set(id, updatedTimesheet);
    return updatedTimesheet;
  }

  async deleteTimesheet(id: string): Promise<boolean> {
    return this.timesheets.delete(id);
  }

  // Invoice methods
  async getInvoices(companyId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.companyId === companyId,
    );
  }

  async getInvoicesByStatus(companyId: string, status: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.companyId === companyId && invoice.status === status,
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const newInvoice: Invoice = { ...invoice, createdAt: new Date() };
    this.invoices.set(invoice.id, newInvoice);
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const existingInvoice = this.invoices.get(id);
    if (!existingInvoice) return undefined;
    
    const updatedInvoice = { ...existingInvoice, ...invoice };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Payslip methods
  async getPayslips(companyId: string): Promise<Payslip[]> {
    return Array.from(this.payslips.values()).filter(
      (payslip) => payslip.companyId === companyId,
    );
  }

  async getPayslip(id: string): Promise<Payslip | undefined> {
    return this.payslips.get(id);
  }

  async createPayslip(payslip: InsertPayslip): Promise<Payslip> {
    const newPayslip: Payslip = { ...payslip, createdAt: new Date() };
    this.payslips.set(payslip.id, newPayslip);
    return newPayslip;
  }

  // Payment methods
  async getPayments(companyId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      (payment) => payment.companyId === companyId,
    );
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const newPayment: Payment = { ...payment, createdAt: new Date() };
    this.payments.set(payment.id, newPayment);
    return newPayment;
  }

  // Payment Batch methods
  async getPaymentBatches(companyId: string): Promise<PaymentBatch[]> {
    return Array.from(this.paymentBatches.values()).filter(
      (batch) => batch.companyId === companyId,
    );
  }

  async getPaymentBatch(id: string): Promise<PaymentBatch | undefined> {
    return this.paymentBatches.get(id);
  }

  async createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch> {
    const newBatch: PaymentBatch = { ...batch, createdAt: new Date() };
    this.paymentBatches.set(batch.id, newBatch);
    return newBatch;
  }

  // Audit Log methods
  async getAuditLogs(companyId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).filter(
      (log) => log.companyId === companyId,
    );
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const newLog: AuditLog = { ...auditLog, timestamp: new Date() };
    this.auditLogs.set(auditLog.id, newLog);
    return newLog;
  }

  // RTI Employment Record methods
  async getRTIEmploymentRecords(candidateId: string): Promise<RTIEmploymentRecord[]> {
    return Array.from(this.rtiEmploymentRecords.values()).filter(
      (record) => record.candidateId === candidateId,
    );
  }

  async getLatestRTIRecord(candidateId: string): Promise<RTIEmploymentRecord | undefined> {
    const records = Array.from(this.rtiEmploymentRecords.values())
      .filter((record) => record.candidateId === candidateId)
      .sort((a, b) => new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime());
    return records[0];
  }

  async createRTIEmploymentRecord(record: InsertRTIEmploymentRecord): Promise<RTIEmploymentRecord> {
    const newRecord: RTIEmploymentRecord = { 
      ...record, 
      id: nanoid(),
      retrievedAt: new Date(),
      createdAt: new Date() 
    };
    this.rtiEmploymentRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  // Payroll Batch methods
  async getPayrollBatches(companyId: string): Promise<PayrollBatch[]> {
    return Array.from(this.payrollBatches.values()).filter(
      (batch) => batch.companyId === companyId,
    );
  }

  async getPayrollBatch(id: string): Promise<PayrollBatch | undefined> {
    return this.payrollBatches.get(id);
  }

  async createPayrollBatch(batch: InsertPayrollBatch): Promise<PayrollBatch> {
    const newBatch: PayrollBatch = { 
      ...batch, 
      id: nanoid(),
      createdAt: new Date() 
    };
    this.payrollBatches.set(newBatch.id, newBatch);
    return newBatch;
  }

  async updatePayrollBatch(id: string, updates: Partial<InsertPayrollBatch>): Promise<PayrollBatch | undefined> {
    const batch = this.payrollBatches.get(id);
    if (!batch) return undefined;
    
    const updatedBatch = { ...batch, ...updates };
    this.payrollBatches.set(id, updatedBatch);
    return updatedBatch;
  }

  // Payroll Batch Item methods
  async getPayrollBatchItems(batchId: string): Promise<PayrollBatchItem[]> {
    return Array.from(this.payrollBatchItems.values()).filter(
      (item) => item.batchId === batchId,
    );
  }

  async getPayrollBatchItem(id: string): Promise<PayrollBatchItem | undefined> {
    return this.payrollBatchItems.get(id);
  }

  async createPayrollBatchItem(item: InsertPayrollBatchItem): Promise<PayrollBatchItem> {
    const newItem: PayrollBatchItem = { 
      ...item, 
      id: nanoid(),
      createdAt: new Date() 
    };
    this.payrollBatchItems.set(newItem.id, newItem);
    return newItem;
  }

  async updatePayrollBatchItem(id: string, updates: Partial<InsertPayrollBatchItem>): Promise<PayrollBatchItem | undefined> {
    const item = this.payrollBatchItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...updates };
    this.payrollBatchItems.set(id, updatedItem);
    return updatedItem;
  }

  // HMRC Submission methods
  async getHMRCSubmissions(batchId: string): Promise<HMRCSubmission[]> {
    return Array.from(this.hmrcSubmissions.values()).filter(
      (submission) => submission.batchId === batchId,
    );
  }

  async createHMRCSubmission(submission: InsertHMRCSubmission): Promise<HMRCSubmission> {
    const newSubmission: HMRCSubmission = { 
      ...submission, 
      id: nanoid(),
      createdAt: new Date() 
    };
    this.hmrcSubmissions.set(newSubmission.id, newSubmission);
    return newSubmission;
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async verifyPassword(supplied: string, stored: string): Promise<boolean> {
    if (!stored) {
      console.error("No stored password provided");
      return false;
    }
    
    // Support both dot and colon separators for backward compatibility
    let separator = ".";
    if (stored.includes(":") && !stored.includes(".")) {
      separator = ":";
    } else if (!stored.includes(".") && !stored.includes(":")) {
      console.error("Invalid stored password format - no separator found:", stored);
      return false;
    }
    
    const [hashed, salt] = stored.split(separator);
    if (!hashed || !salt) {
      console.error("Missing hash or salt in stored password");
      return false;
    }
    
    try {
      const { scrypt, timingSafeEqual } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      console.error("Error comparing passwords:", error);
      return false;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async updateUserEmailVerification(id: number, verified: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        isEmailVerified: verified,
        emailVerificationToken: null,
        emailVerificationExpiry: null
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async setUserEmailVerificationToken(id: number, token: string, expiry: Date): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        emailVerificationToken: token,
        emailVerificationExpiry: expiry
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.subdomainSlug, slug));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db
      .insert(companies)
      .values(company)
      .returning();
    return newCompany;
  }

  async getAgencies(companyId: string): Promise<Agency[]> {
    return await db.select().from(agencies).where(eq(agencies.companyId, companyId));
  }

  async getAgency(id: string): Promise<Agency | undefined> {
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
    return agency || undefined;
  }

  async getAgencyByName(companyId: string, agencyName: string): Promise<Agency | undefined> {
    const [agency] = await db.select().from(agencies).where(
      and(
        eq(agencies.companyId, companyId),
        eq(agencies.agencyName, agencyName)
      )
    );
    return agency || undefined;
  }

  async createAgency(agency: InsertAgency): Promise<Agency> {
    const [newAgency] = await db
      .insert(agencies)
      .values({
        ...agency,
        emails: agency.emails || [],
        bankDetails: agency.bankDetails || null,
        payRateType: agency.payRateType || "UmbrellaNG",
        currency: agency.currency || "GBP",
      })
      .returning();
    return newAgency;
  }

  async updateAgency(id: string, agency: Partial<InsertAgency>): Promise<Agency | undefined> {
    try {
      console.log("Storage updateAgency - Input data:", JSON.stringify(agency, null, 2));
      
      // Clean numeric fields - convert empty strings to null
      const cleanedAgency = {
        ...agency,
        payRateValue: agency.payRateValue === "" ? null : agency.payRateValue,
        payRatePercentage: agency.payRatePercentage === "" ? null : agency.payRatePercentage,
        emails: agency.emails || undefined,
        bankDetails: agency.bankDetails || undefined,
        payRateType: agency.payRateType || undefined,
        currency: agency.currency || undefined,
      };
      
      const [updatedAgency] = await db
        .update(agencies)
        .set(cleanedAgency)
        .where(eq(agencies.id, id))
        .returning();
      
      console.log("Storage updateAgency - Result:", updatedAgency);
      return updatedAgency || undefined;
    } catch (error) {
      console.error("Storage updateAgency - Database error:", error);
      throw error;
    }
  }

  async deleteAgency(id: string): Promise<boolean> {
    const result = await db.delete(agencies).where(eq(agencies.id, id));
    return result.rowCount > 0;
  }

  async getCandidates(companyId: string): Promise<Candidate[]> {
    return await db.select().from(candidates).where(eq(candidates.companyId, companyId));
  }

  async getCandidatesByAgency(agencyId: string): Promise<Candidate[]> {
    return await db.select().from(candidates).where(eq(candidates.agencyId, agencyId));
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async getCandidateByName(companyId: string, fullName: string): Promise<Candidate | undefined> {
    const [firstName, ...lastNameParts] = fullName.trim().split(' ');
    const lastName = lastNameParts.join(' ');
    
    const [candidate] = await db.select().from(candidates).where(
      and(
        eq(candidates.companyId, companyId),
        eq(candidates.firstName, firstName),
        eq(candidates.lastName, lastName)
      )
    );
    return candidate || undefined;
  }

  // Get candidate with all related data
  async getCandidateWithDetails(candidateId: string): Promise<{
    candidate: Candidate | undefined;
    agency: Agency | undefined;
    payments: Payment[];
    timesheets: Timesheet[];
    payslips: Payslip[];
    rtiRecords: RTIEmploymentRecord[];
  }> {
    const candidate = await this.getCandidate(candidateId);
    if (!candidate) {
      return {
        candidate: undefined,
        agency: undefined,
        payments: [],
        timesheets: [],
        payslips: [],
        rtiRecords: []
      };
    }

    // Get agency information
    const agency = candidate.agencyId ? await this.getAgency(candidate.agencyId) : undefined;

    // Get all payments for this candidate
    const candidatePayments = await db.select().from(payments).where(
      eq(payments.candidateId, candidateId)
    );

    // Get all timesheets for this candidate
    const candidateTimesheets = await db.select().from(timesheets).where(
      eq(timesheets.candidateId, candidateId)
    );

    // Get all payslips for this candidate
    const candidatePayslips = await db.select().from(payslips).where(
      eq(payslips.candidateId, candidateId)
    );

    // Get RTI employment records
    const candidateRTIRecords = await db.select().from(rtiEmploymentRecords).where(
      eq(rtiEmploymentRecords.candidateId, candidateId)
    );

    return {
      candidate,
      agency,
      payments: candidatePayments,
      timesheets: candidateTimesheets,
      payslips: candidatePayslips,
      rtiRecords: candidateRTIRecords
    };
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const [newCandidate] = await db
      .insert(candidates)
      .values(candidate)
      .returning();
    return newCandidate;
  }

  async updateCandidate(id: string, candidate: Partial<InsertCandidate>): Promise<Candidate | undefined> {
    // Clean up the candidate data before updating
    const cleanedCandidate = { ...candidate };
    
    // Handle agencyIds conversion - ensure it's a proper array or null
    if (cleanedCandidate.agencyIds) {
      if (Array.isArray(cleanedCandidate.agencyIds)) {
        cleanedCandidate.agencyIds = cleanedCandidate.agencyIds;
      } else {
        // Convert object to array if needed
        cleanedCandidate.agencyIds = Object.values(cleanedCandidate.agencyIds as any).filter(Boolean);
      }
    }
    
    // Fields that should be numeric - convert empty strings to null
    const numericFields = ['payRate', 'margin', 'percentageCap'];
    numericFields.forEach(field => {
      if (cleanedCandidate[field as keyof typeof cleanedCandidate] === '') {
        (cleanedCandidate as any)[field] = null;
      }
    });
    
    // Convert undefined values to null for database compatibility
    Object.keys(cleanedCandidate).forEach(key => {
      if (cleanedCandidate[key as keyof typeof cleanedCandidate] === undefined) {
        (cleanedCandidate as any)[key] = null;
      }
    });
    
    const [updatedCandidate] = await db
      .update(candidates)
      .set(cleanedCandidate)
      .where(eq(candidates.id, id))
      .returning();
    return updatedCandidate || undefined;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    console.log(`Attempting to delete candidate with ID: ${id}`);
    const result = await db.delete(candidates).where(eq(candidates.id, id));
    console.log(`Delete result:`, result);
    const deleted = result.rowCount > 0;
    console.log(`Candidate deleted: ${deleted}`);
    return deleted;
  }

  async getTimesheets(companyId: string): Promise<Timesheet[]> {
    return await db.select().from(timesheets).where(eq(timesheets.companyId, companyId));
  }

  async getTimesheetsByStatus(companyId: string, status: string): Promise<Timesheet[]> {
    return await db.select().from(timesheets).where(and(eq(timesheets.companyId, companyId), eq(timesheets.status, status)));
  }

  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return timesheet || undefined;
  }

  async createTimesheet(timesheet: InsertTimesheet): Promise<Timesheet> {
    const [newTimesheet] = await db
      .insert(timesheets)
      .values(timesheet)
      .returning();
    return newTimesheet;
  }

  async updateTimesheet(id: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const [updatedTimesheet] = await db
      .update(timesheets)
      .set(timesheet)
      .where(eq(timesheets.id, id))
      .returning();
    return updatedTimesheet || undefined;
  }

  async deleteTimesheet(id: string): Promise<boolean> {
    const result = await db.delete(timesheets).where(eq(timesheets.id, id));
    return result.rowCount > 0;
  }

  async getInvoices(companyId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.companyId, companyId));
  }

  async getInvoicesByStatus(companyId: string, status: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.companyId, companyId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db
      .insert(invoices)
      .values(invoice)
      .returning();
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice || undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return result.rowCount > 0;
  }

  async getPayslips(companyId: string): Promise<Payslip[]> {
    return await db.select().from(payslips).where(eq(payslips.companyId, companyId));
  }

  async getPayslip(id: string): Promise<Payslip | undefined> {
    const [payslip] = await db.select().from(payslips).where(eq(payslips.id, id));
    return payslip || undefined;
  }

  async createPayslip(payslip: InsertPayslip): Promise<Payslip> {
    const [newPayslip] = await db
      .insert(payslips)
      .values(payslip)
      .returning();
    return newPayslip;
  }

  async getPayments(companyId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.companyId, companyId));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values(payment)
      .returning();
    return newPayment;
  }

  async getPaymentBatches(companyId: string): Promise<PaymentBatch[]> {
    return await db.select().from(paymentBatches).where(eq(paymentBatches.companyId, companyId));
  }

  async getPaymentBatch(id: string): Promise<PaymentBatch | undefined> {
    const [batch] = await db.select().from(paymentBatches).where(eq(paymentBatches.id, id));
    return batch || undefined;
  }

  async createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch> {
    const [newBatch] = await db
      .insert(paymentBatches)
      .values(batch)
      .returning();
    return newBatch;
  }

  async getAuditLogs(companyId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId));
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(auditLog)
      .returning();
    return newLog;
  }

  // RTI Employment Record methods
  async getRTIEmploymentRecords(candidateId: string): Promise<RTIEmploymentRecord[]> {
    return await db.select().from(rtiEmploymentRecords).where(eq(rtiEmploymentRecords.candidateId, candidateId));
  }

  async getLatestRTIRecord(candidateId: string): Promise<RTIEmploymentRecord | undefined> {
    const [record] = await db
      .select()
      .from(rtiEmploymentRecords)
      .where(eq(rtiEmploymentRecords.candidateId, candidateId))
      .orderBy(rtiEmploymentRecords.retrievedAt)
      .limit(1);
    return record || undefined;
  }

  async createRTIEmploymentRecord(record: InsertRTIEmploymentRecord): Promise<RTIEmploymentRecord> {
    const recordWithId = {
      ...record,
      id: nanoid(),
    };
    const [newRecord] = await db
      .insert(rtiEmploymentRecords)
      .values(recordWithId)
      .returning();
    return newRecord;
  }

  // Payroll Batch methods
  async getPayrollBatches(companyId: string): Promise<PayrollBatch[]> {
    return await db.select().from(payrollBatches).where(eq(payrollBatches.companyId, companyId));
  }

  async getPayrollBatch(id: string): Promise<PayrollBatch | undefined> {
    const [batch] = await db.select().from(payrollBatches).where(eq(payrollBatches.id, id));
    return batch || undefined;
  }

  async createPayrollBatch(batch: InsertPayrollBatch): Promise<PayrollBatch> {
    const batchWithId = {
      ...batch,
      id: nanoid(),
    };
    const [newBatch] = await db
      .insert(payrollBatches)
      .values(batchWithId)
      .returning();
    return newBatch;
  }

  async updatePayrollBatch(id: string, updates: Partial<InsertPayrollBatch>): Promise<PayrollBatch | undefined> {
    const [updatedBatch] = await db
      .update(payrollBatches)
      .set(updates)
      .where(eq(payrollBatches.id, id))
      .returning();
    return updatedBatch || undefined;
  }

  // Payroll Batch Item methods
  async getPayrollBatchItems(batchId: string): Promise<PayrollBatchItem[]> {
    return await db.select().from(payrollBatchItems).where(eq(payrollBatchItems.batchId, batchId));
  }

  async getPayrollBatchItem(id: string): Promise<PayrollBatchItem | undefined> {
    const [item] = await db.select().from(payrollBatchItems).where(eq(payrollBatchItems.id, id));
    return item || undefined;
  }

  async createPayrollBatchItem(item: InsertPayrollBatchItem): Promise<PayrollBatchItem> {
    const itemWithId = {
      ...item,
      id: nanoid(),
    };
    const [newItem] = await db
      .insert(payrollBatchItems)
      .values(itemWithId)
      .returning();
    return newItem;
  }

  async updatePayrollBatchItem(id: string, updates: Partial<InsertPayrollBatchItem>): Promise<PayrollBatchItem | undefined> {
    const [updatedItem] = await db
      .update(payrollBatchItems)
      .set(updates)
      .where(eq(payrollBatchItems.id, id))
      .returning();
    return updatedItem || undefined;
  }

  // HMRC Submission methods
  async getHMRCSubmissions(batchId: string): Promise<HMRCSubmission[]> {
    return await db.select().from(hmrcSubmissions).where(eq(hmrcSubmissions.batchId, batchId));
  }

  async createHMRCSubmission(submission: InsertHMRCSubmission): Promise<HMRCSubmission> {
    const submissionWithId = {
      ...submission,
      id: nanoid(),
    };
    const [newSubmission] = await db
      .insert(hmrcSubmissions)
      .values(submissionWithId)
      .returning();
    return newSubmission;
  }

  // Super Admin methods
  async getSuperAdminByUsername(username: string): Promise<any | undefined> {
    const [admin] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.username, username));
    return admin;
  }

  async createSuperAdmin(admin: any): Promise<any> {
    const adminData = {
      username: admin.username,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName, 
      password: await this.hashPassword(admin.password),
      status: 'active',
      lastLogin: null,
      createdAt: new Date()
    };
    
    const [newAdmin] = await db
      .insert(superAdmins)
      .values(adminData)
      .returning();
    return newAdmin;
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const crypto = await import('crypto');
    return new Promise((resolve, reject) => {
      const [salt, hash] = hashedPassword.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(hash === derivedKey.toString('hex'));
      });
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const crypto = await import('crypto');
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  async getAllCompaniesForSuperAdmin(): Promise<any[]> {
    const companiesList = await db.select().from(companies);
    const result = [];
    
    for (const company of companiesList) {
      // Get company admin for each company
      const [admin] = await db
        .select()
        .from(users)
        .where(and(eq(users.companyId, company.id), eq(users.role, 'admin')));
      
      result.push({
        id: company.id,
        companyName: company.companyName,
        contactEmail: company.contactEmail,
        username: admin?.username || 'N/A',
        active: company.active,
        createdAt: company.createdAt
      });
    }
    
    return result;
  }

  async createCompanyBySuperAdmin(company: any): Promise<any> {
    const companyWithId = {
      ...company,
      id: nanoid(),
      createdAt: new Date(),
      active: true,
      subdomainSlug: company.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      organizationId: null
    };
    
    const [newCompany] = await db
      .insert(companies)
      .values(companyWithId)
      .returning();
    return newCompany;
  }

  async createCompanyAdmin(admin: any): Promise<any> {
    const adminWithId = {
      ...admin,
      createdAt: new Date(),
      lastLogin: null
    };
    
    // Hash password before storing
    const hashedPassword = await this.hashPassword(admin.password);
    adminWithId.password = hashedPassword;
    
    const [newAdmin] = await db
      .insert(users)
      .values(adminWithId)
      .returning();
    return newAdmin;
  }

  async updateCompany(id: string, updates: any): Promise<any> {
    const [updatedCompany] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }

  async updateCompanyAdminByCompanyId(companyId: string, updates: any): Promise<void> {
    if (updates.password) {
      updates.password = await this.hashPassword(updates.password);
    }
    
    await db
      .update(users)
      .set(updates)
      .where(and(eq(users.companyId, companyId), eq(users.role, 'admin')));
  }

  async deleteCompanyAdminByCompanyId(companyId: string): Promise<void> {
    await db
      .delete(users)
      .where(and(eq(users.companyId, companyId), eq(users.role, 'admin')));
  }

  async deleteCompany(id: string): Promise<void> {
    await db
      .delete(companies)
      .where(eq(companies.id, id));
  }
}

export const storage = new DatabaseStorage();
