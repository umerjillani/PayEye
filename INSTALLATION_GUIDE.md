# PayEYE - Installation Guide

## Quick Start
```bash
# Clone the project and install all dependencies
npm install

# Set up environment variables (see below)
# Push database schema
npm run db:push

# Start development server
npm run dev
```

## System Prerequisites
- **Node.js**: 20.x or higher
- **NPM**: 10.x or higher  
- **PostgreSQL**: 16+ (or use Neon serverless)

## Environment Variables
Create a `.env` file in the root directory:
```bash
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-secret-key-for-sessions
OPENAI_API_KEY=your-openai-api-key-for-ocr-processing
SENDGRID_API_KEY=your-sendgrid-api-key-for-emails
```

## Development Commands
```bash
npm run dev      # Start development server (port 5000)
npm run build    # Build for production
npm start        # Start production server
npm run check    # TypeScript type checking
npm run db:push  # Push database schema changes
```

## Core Dependencies

### Runtime Dependencies
```json
{
  "@neondatabase/serverless": "^0.10.4",
  "@tanstack/react-query": "^5.60.5",
  "drizzle-orm": "^0.39.1",
  "express": "^4.21.2",
  "react": "^18.3.1",
  "openai": "^5.8.2",
  "tesseract.js": "^6.0.1",
  "xlsx": "^0.18.5",
  "multer": "^2.0.0",
  "passport": "^0.7.0",
  "zod": "^3.24.2"
}
```

### UI Components (Radix UI)
```json
{
  "@radix-ui/react-dialog": "^1.1.7",
  "@radix-ui/react-dropdown-menu": "^2.1.7",
  "@radix-ui/react-select": "^2.1.7",
  "@radix-ui/react-toast": "^1.2.7"
}
```

### Development Dependencies
```json
{
  "vite": "^5.4.14",
  "typescript": "^5.6.3",
  "tailwindcss": "^3.4.17",
  "drizzle-kit": "^0.30.4"
}
```

## Key Features Enabled
- ✅ Multi-tenant payroll management
- ✅ AI-powered OCR document processing
- ✅ UK tax calculations (PAYE/NIC)
- ✅ Excel/PDF/CSV file processing
- ✅ Authentication & authorization
- ✅ Real-time data synchronization
- ✅ Modern React UI with shadcn/ui
- ✅ Type-safe database operations

## Project Structure
```
├── client/          # React frontend
├── server/          # Express.js backend
├── shared/          # Shared types/schemas
├── uploads/         # File storage (company-specific)
├── package.json     # Dependencies & scripts
└── drizzle.config.ts # Database configuration
```

## Installation Troubleshooting

### If `npm install` fails:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and try again
rm -rf node_modules package-lock.json
npm install
```

### If database connection fails:
1. Check `DATABASE_URL` format
2. Ensure PostgreSQL is running
3. Verify database exists and credentials are correct

### If OCR processing fails:
1. Verify `OPENAI_API_KEY` is set correctly
2. Check API key has sufficient credits
3. Ensure file upload permissions are correct

## Production Deployment
```bash
# Build the application
npm run build

# Start production server
NODE_ENV=production npm start
```

## Dependencies By Category

**Database & ORM:**
- drizzle-orm, drizzle-kit, @neondatabase/serverless

**Authentication:**
- passport, passport-local, express-session, connect-pg-simple

**File Processing:**
- multer, tesseract.js, pdf2pic, xlsx, csv-parser, sharp

**AI Integration:**
- openai (for GPT-4 document processing)

**Frontend Framework:**
- react, react-dom, react-hook-form, @tanstack/react-query

**UI Components:**
- All @radix-ui/* packages, lucide-react, framer-motion

**Build Tools:**
- vite, esbuild, typescript, tailwindcss

**Utilities:**
- zod, date-fns, clsx, nanoid