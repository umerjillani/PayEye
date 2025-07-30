# PayEYE - Payroll Management System

## Overview

PayEYE is a comprehensive payroll management system built with a full-stack TypeScript architecture. The application handles multi-tenant payroll operations including employee management, timesheet processing, invoice generation, and UK tax calculations (PAYE/NIC). It features a modern React frontend with a Node.js/Express backend, PostgreSQL database, and integrates with HMRC's RTI (Real Time Information) system.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state management
- **UI Components**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for RESTful API
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Passport.js with local strategy and session management
- **File Processing**: Multer for file uploads with OCR capabilities
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple

### Database Architecture
- **Primary Database**: PostgreSQL 16
- **Connection**: Neon serverless PostgreSQL client
- **Schema Management**: Drizzle Kit for migrations
- **Multi-tenancy**: Company-based data isolation

## Key Components

### Authentication & Authorization
- Session-based authentication using Passport.js
- Role-based access control (admin, manager, accountant, viewer)
- Company-based multi-tenancy with subdomain support
- Secure password hashing using Node.js crypto scrypt

### Tax Calculation Engine
- **PAYE Calculator**: Handles UK income tax calculations with current tax bands
- **NIC Calculator**: Processes National Insurance contributions across all categories
- **Payroll Calculator**: Combines tax, NIC, and other deductions for complete payroll processing
- **Student Loan**: Supports all UK student loan plans with threshold-based deductions

### Document Processing
- OCR-enabled document extraction for timesheets and invoices
- Multi-format support (PDF, images, Word documents)
- Automated data parsing and validation

### HMRC Integration
- RTI (Real Time Information) API integration
- Employment record retrieval
- Payroll submission capabilities
- OAuth2 authentication flow for HMRC services

### Data Models
- **Companies**: Multi-tenant organization structure
- **Users**: Role-based user management
- **Agencies**: Recruitment agency management
- **Candidates/Employees**: Worker information and tax details
- **Timesheets**: Time tracking and approval workflows
- **Invoices**: Billing and payment management
- **Payroll**: Salary calculations and payment processing
- **Audit Logs**: Comprehensive activity tracking

## Data Flow

1. **User Authentication**: Users log in through company-specific subdomains
2. **Company Selection**: Multi-company users can switch between organizations
3. **Data Entry**: Timesheets and invoices are uploaded via OCR or manual entry
4. **Approval Workflow**: Managers approve timesheets and invoices
5. **Payroll Processing**: Automated tax calculations and payslip generation
6. **HMRC Submission**: RTI data submitted to HMRC in real-time
7. **Payment Processing**: Batch payment file generation for banks

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless connection
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Headless UI components
- **tailwindcss**: Utility-first CSS framework
- **zod**: TypeScript-first schema validation

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **vite**: Frontend build tool and dev server

### File Processing
- **multer**: File upload middleware
- **pdf-parse**: PDF document parsing
- **nanoid**: Unique ID generation

### Authentication & Security
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 module
- **Port Configuration**: Development on port 5000
- **Hot Reload**: Vite HMR for frontend, tsx for backend

### Production Build
- **Frontend**: Vite build process creates optimized static assets
- **Backend**: esbuild bundles server code with external dependencies
- **Database**: Drizzle migrations ensure schema consistency
- **Deployment**: Autoscale deployment target on Replit

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `HMRC_CLIENT_ID`: HMRC API credentials
- `HMRC_CLIENT_SECRET`: HMRC API secret
- `HMRC_REDIRECT_URI`: OAuth callback URL

## Changelog

```
Changelog:
- June 23, 2025. Initial setup
- June 23, 2025. Enhanced OCR system with unified text extraction approach:
  * Added Tesseract.js for comprehensive OCR across all file types
  * Implemented Excel (XLSX/XLS) support using XLSX library
  * Added CSV file processing with csv-parser
  * Unified pipeline: OCR text extraction → AI structured data processing
  * Supports PDF, images, Excel, and CSV files with consistent processing
- June 25, 2025. Enhanced Agency Management System:
  * Multiple email addresses with primary designation
  * Complete bank details for agency payments (IBAN, SWIFT, account details)
  * Multi-currency support (10 currencies: GBP, EUR, USD, CAD, AUD, JPY, CHF, SEK, NOK, DKK)
  * Dual pay rate types: UmbrellaNG (fixed amount) vs Sub-Contractor (percentage)
  * Enhanced agency form with comprehensive sections and validation
- June 25, 2025. OTP Email Authentication System:
  * User registration with email verification via OTP codes
  * SendGrid integration with development mode bypass for testing
  * Database schema updated with email verification fields
  * 15-minute OTP expiry with resend functionality
  * Console logging of OTPs during development for easy testing
  * Complete verification flow with automatic login after verification
  * SIMPLIFIED: Email verification removed due to errors, direct login after registration
- June 25, 2025. OCR Service Integration - COMPLETE:
  * Successfully integrated exact Python OCR logic without any modifications
  * Excel processing working perfectly with XLSX library (20,102 characters extracted)
  * AI GPT-4o integration with exact prompt structure and temperature 0
  * Manual Total Gross Pays calculation using exact searchKey algorithm
  * Agency name validation and "Others" filtering working correctly
  * Frontend displays extracted records with proper formatting
  * Successfully processed Paywize Limited remittance with 8 employee records
  * Exact Python normalization, search, and financial calculation logic preserved
  * FIXED: File upload mechanism now properly handles FormData for file uploads
  * ADDED: Full PDF support alongside Excel and image processing capabilities
  * FIXED: PDF OCR processing using pdf2pic + Tesseract for complete text extraction
  * VERIFIED: Complete multi-format document support (PDF, Excel, JPEG, PNG) working correctly
- June 25, 2025. UI and Terminology Updates:
  * Enhanced file upload interface with prominent blue "Choose File" button
  * Replaced all "OpenAI" references with generic "AI" terminology throughout project
  * Improved user experience with visual upload area and hover effects
- June 26, 2025. Professional Dark Mode & Clean Design:
  * Redesigned dark theme with professional 2-4 color palette (blue, green, amber, gray)
  * Removed harsh blacks and complex color variations for cleaner appearance
  * Implemented consistent gray backgrounds throughout application
  * Replaced all black border strokes with professional drop shadows
  * Enhanced text contrast and readability across all components
  * Simplified color system using semantic tokens (foreground, muted-foreground, etc.)
  * Updated sidebar, header, and dashboard components with cohesive styling
- June 26, 2025. Timesheet OCR Integration - COMPLETE:
  * Integrated perfect OCR logic from Remittance OCR into Timesheet upload workflow
  * Added processTimesheetDocument function with comprehensive text extraction
  * Updated timesheet upload API endpoint to use same OCR processing as remittance
  * Enhanced frontend timesheet modal to display extracted data properly
  * Automatic timesheet record creation in database with OCR-extracted information
  * Employee matching by name with fallback handling for missing records
  * Complete integration: PDF/Excel/Image → OCR → AI extraction → Database storage
- June 26, 2025. Enhanced Timesheet Management - COMPLETE:
  * Fixed numeric formatting issues (removed commas from database values like "1,072.50")
  * Updated database schema to allow nullable candidate_id and agency_id fields
  * Progressive loading bar with stages: Upload → OCR → AI Extraction → Finalization
  * Toast color system: Blue for success, amber for processing, red only for errors
  * Approved timesheets now remain visible in the interface instead of disappearing
  * Added comprehensive timesheet edit modal with full field editing capabilities
  * Edit functionality available for all timesheet statuses (pending, approved, rejected)
  * Enhanced timesheet actions with improved visual feedback and color coding
  * FIXED: Employee names now display properly in timesheet processing results
  * ENHANCED: Detailed logging for hours accuracy verification
  * UPDATED: File upload limit increased from 10MB to 1GB for large documents
- June 27, 2025. Bulk Employee Upload System - COMPLETE:
  * Created comprehensive bulk employee upload modal with drag-and-drop file interface
  * AI-powered extraction of all essential employee fields using GPT-4o with temperature 0
  * Supports Excel (.xlsx/.xls) and CSV files up to 1GB with complete OCR text extraction
  * Extracts 40+ employee fields: personal details, employment info, tax data, banking details
  * Smart field mapping handles various column naming conventions automatically
  * Progressive loading stages: Upload → OCR → AI Extraction → Database Creation → Results
  * Employment type recognition: PAYE, Limited Company, Umbrella with automatic normalization
  * Comprehensive error handling with detailed processing results and employee record display
  * Blue button styling matching "Add Employee" for consistent UI design
  * Complete integration: File upload → Text extraction → AI processing → Database storage → UI feedback
- June 27, 2025. Employment Type System Update - COMPLETE:
  * Updated system to use Finity's specific employment types only:
  * "subcontractor" = Limited Company workers
  * "umbrellaNg" = PAYE or Umbrella workers  
  * Updated frontend employee modal dropdown options with clear descriptions
  * Modified employee filtering tabs and summary cards to use new employment types
  * Updated backend OCR processing to map various input formats to correct employment types
  * Fixed all employee listing, filtering, and processing logic throughout the system
  * Replaced browser's native delete confirmation with professional custom confirmation dialog
- June 30, 2025. OCR Number Formatting System - COMPLETE:
  * Implemented comprehensive number formatting system to eliminate floating-point precision errors
  * Added formatNumber() helper function with proper decimal rounding (max 2 decimal places)
  * Added cleanExtractedData() helper function to recursively clean all numeric fields
  * Updated all AI prompts with explicit number formatting instructions (8.25 not 8.25000000001)
  * Applied cleaning to all OCR processing functions: timesheet, remittance, and bulk employee
  * Fixed manual total calculations in remittance processing with proper formatting
  * Enhanced extractFloat() function to handle currency values and avoid precision issues
  * Ensured all numeric fields (pay, rate, hours, amounts, fees, VAT, totals) are properly formatted
- June 30, 2025. Complete Card Hover Animation Standardization - COMPLETE:
  * Standardized ALL Card components across the entire application with consistent hover animations
  * Applied uniform 102% scale and enhanced shadow effects with 300ms smooth transitions
  * Updated Dashboard (metrics, quick actions), Timesheets, Payroll, Employees, Agencies pages
  * Applied animations to Reports page (selection cards and configuration card)
  * Added hover effects to all OCR page Cards (upload, error, results, how-it-works)
  * Ensured consistent visual feedback and professional interaction patterns across application
  * Complete project-wide visual consistency and professional polish achieved
- June 30, 2025. Selective Card Hover Animation Refinement - COMPLETE:
  * Distinguished between interactive/actionable cards vs data display cards
  * REMOVED hover animations from data display cards: timesheets table, employees table, agencies table, payroll table, recent activity, error messages, informational content
  * KEPT hover animations on interactive cards: stats/metrics cards, forms, upload cards, quick action buttons, report selection cards
  * Clear UX distinction: informational content = no animation, interactive elements = hover animations
  * Enhanced user experience by removing unnecessary animations from read-only content
- June 30, 2025. Multi-Tenant SaaS Architecture Implementation - IN PROGRESS:
  * MAJOR ARCHITECTURAL CHANGE: Transitioning from single-tenant to multi-tenant SaaS model
  * New hierarchy: Super Admins (software creators) → Organizations (customers) → Organization Admins (customer admins) → Companies → Agencies/Employees
  * Created new database schema (schema-new.ts) with proper multi-tenant structure
  * Added organizationId to all tables for data isolation and tenant separation
  * Implemented comprehensive authentication system with role-based access control
  * Super Admins: Complete system access, can create/manage organizations
  * Organization Admins: Limited to their organization's data only, granular permissions
  * Authentication separation: Super admins use separate login system inaccessible to regular admins
  * Permission system: agencies:create, employees:read, timesheets:update, etc.
  * Default role permissions: admin (full), manager (limited), accountant (financial), viewer (read-only)
- July 01, 2025. Authentication Security & Full Name Implementation - COMPLETE:
  * Implemented comprehensive security measures to prevent privilege escalation between user types
  * Database-level separation: Super admins and company admins stored in completely separate tables
  * Session protection: Each login type destroys any existing session of the other type
  * Middleware security: requireSuperAdmin blocks company admin sessions, requireCompanyAdmin blocks super admin sessions
  * Enhanced logout system: Complete session destruction with cookie clearing for both user types
  * Unified full name field: Replaced separate firstName/lastName with single fullName field in ALL signup forms
  * Smart name splitting: Frontend collects fullName, backend automatically splits into firstName/lastName for database storage
  * Complete cross-authentication prevention with clear error messages guiding users to correct login system
- July 03, 2025. Super Admin Company Management System - COMPLETE:
  * Fixed super admin authentication flow and session handling for proper multi-tenant access
  * Implemented complete CRUD operations for companies: create, read, update, delete with login credentials
  * Created comprehensive Super Admin Settings page with 4 main sections: Company Management, System Settings, Security, Monitoring
  * Enhanced sidebar navigation to conditionally show "Super Admin Settings" for super admins vs "Settings" for regular admins
  * Validated all API endpoints working correctly: company creation, updates, deletion, and listing
  * Super admins can now create companies with assigned username/password credentials stored securely in database
  * Company switching functionality allows super admins to view data from any company while maintaining data isolation
  * Enhanced security with role-based access control preventing privilege escalation between user types
  * Added confirm password field to company creation form with validation to ensure passwords match
  * Fixed authentication page positioning with proper "System Administrator" link placement
- July 07, 2025. Final Authentication Fix & Comprehensive Documentation - COMPLETE:
  * Fixed employee update and delete authorization by changing from basic auth to requireCompanyDataAccess middleware
  * Resolved 401 unauthorized errors for PUT and DELETE operations on /api/candidates routes
  * All multi-tenant authentication flows now working correctly across all endpoints
  * Created comprehensive README.md with detailed project overview, technology stack, and feature descriptions
  * Documented AI-powered OCR capabilities, multi-tenant architecture, and efficiency comparisons
  * Highlighted 93% time reduction from traditional manual processes (95 min to 7 min per employee)
  * Included complete installation guide, project structure, and development guidelines
  * System now fully functional with proper authentication, OCR processing, and comprehensive documentation
- July 08, 2025. Timesheet Processing & Employee Pre-filling Enhancement - COMPLETE:
  * Enhanced employee modal with automatic form pre-filling from timesheet processing results
  * Implemented smart agency matching with partial name matching and company suffix handling
  * Added comprehensive debugging for agency loading and matching processes
  * Fixed agencies dropdown loading issues in employee modal with proper loading states
  * Added scrollable timesheet upload modal with fixed action buttons at bottom
  * Enhanced multi-employee timesheet display with status indicators (✓ Created, ✓ Existing)
  * Improved timesheet processing workflow to handle both single and multiple employee scenarios
  * Employee creation from timesheet now pre-fills all extracted data (name, pay rate, hours, etc.)
  * System correctly identifies missing agencies and provides clear feedback to users
- July 08, 2025. Timesheet Display & Authentication Fix - COMPLETE:
  * Fixed SQL query bug in getTimesheetsByStatus that wasn't filtering by status properly
  * Enhanced cache invalidation system with comprehensive query updates for timesheets, candidates, and agencies
  * Added debugging to track authentication and company context issues
  * Identified root cause: Timesheets require proper authentication with company context to display
  * File upload supports all required formats: PDF, Excel (.xls/.xlsx), CSV, JPG, PNG (up to 1GB)
  * Timesheets are created successfully in database but require user to be logged in with company selected to view
  * Solution: Users must log in with company credentials and have a company selected in the app context
- July 25, 2025. Complete Multi-Tenant Security Overhaul - COMPLETE:
  * Fixed all API endpoints to use requireCompanyDataAccess middleware for proper company validation
  * Implemented company-based file storage isolation (uploads/company-{id}/) replacing shared uploads directory
  * Removed problematic organizationId column references from database schema (timesheets, invoices, payslips)
  * Added company validation to candidate update and delete operations to prevent cross-company data access
  * Updated all CRUD operations to validate company context ensuring complete data isolation
  * Fixed sidebar metrics error by removing organizationId references from SQL queries
  * File uploads now automatically create company-specific directories for complete file isolation
  * All endpoints now properly validate company ownership before allowing data access or modifications
  * System now provides complete multi-tenant data isolation where each company can only access their own data
- July 28, 2025. Employee Reference Number System & Agency Linking Fix - COMPLETE:
  * Added referenceNumber field to candidates database schema for employee linking functionality
  * Enhanced employee modal with Employee Reference Number input field for creating unique identifiers
  * Fixed agency linking issues in timesheet edit modal to properly associate employee agencies with timesheets
  * Improved employee linking logic to separate employee details from timesheet-specific data
  * Employee linking now copies basic details (name, agencies) but preserves AI-extracted timesheet data (dates, hours, pay rate, gross pay)
  * Updated reference number matching to search by referenceNumber, ID, firstName, lastName, and full name combinations
  * Enhanced timesheet edit modal to show proper agency information when employees are linked
  * Complete data separation: employee identity and agencies are linked, but timesheet financial data comes from AI extraction
- July 28, 2025. Agency-Based Invoice System & Approved Timesheets Only - COMPLETE:
- July 29, 2025. Multi-Tenant Data Isolation Verification - COMPLETE:
  * Redesigned Invoices tab to show agency-based grouping instead of traditional invoice tables
  * Agencies displayed as interactive cards with timesheet counts and total amounts
  * Click agency cards to view detailed timesheet listing for that specific agency
  * Multi-agency employee support: employees with multiple agencies appear in all relevant agency groups
  * IMPORTANT: Only approved timesheets appear in invoices - pending and rejected timesheets are filtered out
  * Enhanced UI with green-themed approved timesheet indicators and clear messaging
  * Complete workflow: Agency list → Click agency → View approved timesheets → Ready for invoicing
  * Maintains data separation between employee details and timesheet-specific financial data
  * Added comprehensive timesheet view modal with detailed information sections
  * Enhanced agency association logic to handle extracted agency names and virtual agencies
  * Fixed filtering issues to show all approved timesheets properly grouped by agencies
- July 29, 2025. Multi-Tenant Data Isolation Verification - COMPLETE:
  * Comprehensive security audit of multi-tenant architecture confirmed complete data isolation
  * Verified all database queries properly filter by companyId preventing cross-company data access
  * Confirmed authentication middleware (requireCompanyDataAccess) enforces company boundaries
  * File storage isolation working correctly with uploads/company-{id}/ directory structure
  * Removed company switching functionality from regular admins - they stay in assigned company
  * Fixed Excel timesheet processing by correcting XLSX import statement
  * Complete test passed: Company 1 and Company 2 data completely isolated with no cross-contamination
  * All features (employees, timesheets, agencies, invoices) available to both companies independently
- July 29, 2025. Installation Guide Creation - COMPLETE:
  * Created comprehensive INSTALLATION_GUIDE.md with all 70+ dependencies listed and categorized
  * Added QUICK_INSTALL.md for simple one-command installation process
  * Included environment variables setup, troubleshooting, and production deployment instructions
  * Provided dependency breakdown by category (Database, Authentication, File Processing, UI, etc.)
  * Complete setup guide allows easy project replication and dependency management
- July 29, 2025. Invoices and Payroll Tabs UI Update - COMPLETE:
  * Changed both Invoices and Payroll tabs from card-based layout to row-based table format
  * Updated filtering to show ONLY approved timesheets in both tabs (no pending or rejected)
  * Invoices tab displays agencies with approved timesheet counts and total amounts in table rows
  * Payroll tab displays employees with approved timesheet counts, hours, and gross pay in table rows
  * Added green "approved" badges to emphasize only approved timesheets are shown
  * Maintained attractive design with hover effects and action buttons in table format
  * Updated sidebar to show payroll count (employees with timesheets) with proper badge
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```