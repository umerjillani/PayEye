# PayEYE - Quick Installation

## One-Command Install
```bash
npm install
```

## Environment Setup
```bash
# Create .env file with:
DATABASE_URL=your-postgresql-connection-string
SESSION_SECRET=your-session-secret-key
OPENAI_API_KEY=your-openai-api-key
```

## Start Development
```bash
npm run db:push    # Set up database
npm run dev        # Start server on port 5000
```

## Essential Dependencies (Auto-installed)
- **Database**: drizzle-orm, @neondatabase/serverless
- **AI Processing**: openai, tesseract.js
- **File Handling**: multer, xlsx, pdf2pic
- **Authentication**: passport, express-session
- **Frontend**: react, @tanstack/react-query, @radix-ui/*
- **Build Tools**: vite, typescript, tailwindcss

## All 70+ dependencies listed in package.json will be installed automatically with `npm install`

## Troubleshooting
- Clear cache: `npm cache clean --force`
- Reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (requires 20+)