import express from "express";
import session from "express-session";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminType?: 'super' | 'organization';
    organizationId?: string;
    permissions?: string[];
    isAuthenticated?: boolean;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      userType: 'super' | 'organization';
      organizationId?: string;
      permissions?: string[];
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}

// Password hashing utilities
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const suppliedHash = (await scrypt(supplied, salt, 64)) as Buffer;
  return hash === suppliedHash.toString("hex");
}

// Session configuration
function getSessionConfig() {
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });
}

// Authentication middleware for super admins
export function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session?.isAuthenticated || req.session?.adminType !== 'super') {
    return res.status(401).json({ message: "Super admin access required" });
  }
  next();
}

// Authentication middleware for organization admins
export function requireOrganizationAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session?.isAuthenticated || req.session?.adminType !== 'organization') {
    return res.status(401).json({ message: "Organization admin access required" });
  }
  next();
}

// Authentication middleware for any authenticated user
export function requireAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session?.isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Permission-based authorization middleware
export function requirePermission(permission: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session?.isAuthenticated) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Super admins have all permissions
    if (req.session.adminType === 'super') {
      return next();
    }
    
    // Check if organization admin has the required permission
    const userPermissions = req.session.permissions || [];
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
}

// Organization scope middleware - ensures user can only access their organization's data
export function requireOrganizationScope(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session?.isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Super admins can access any organization
  if (req.session.adminType === 'super') {
    return next();
  }
  
  // Organization admins can only access their own organization
  if (req.session.adminType === 'organization' && req.session.organizationId) {
    // Add organizationId to request for use in route handlers
    req.params.organizationId = req.session.organizationId;
    return next();
  }
  
  return res.status(403).json({ message: "Organization access denied" });
}

// Setup authentication for the app
export function setupMultiTenantAuth(app: express.Application) {
  // Configure session middleware
  app.use(getSessionConfig());
  
  // Add user data to request object for authenticated requests
  app.use((req, res, next) => {
    if (req.session?.isAuthenticated && req.session.adminId) {
      req.user = {
        id: req.session.adminId,
        userType: req.session.adminType!,
        organizationId: req.session.organizationId,
        permissions: req.session.permissions,
        firstName: '', // Will be populated from database
        lastName: '',
        email: '',
      };
    }
    next();
  });
}

// Utility functions for password operations
export { hashPassword, comparePasswords };

// Default permissions for different roles
export const DEFAULT_PERMISSIONS = {
  admin: [
    'agencies:create', 'agencies:read', 'agencies:update', 'agencies:delete',
    'employees:create', 'employees:read', 'employees:update', 'employees:delete',
    'timesheets:create', 'timesheets:read', 'timesheets:update', 'timesheets:delete',
    'invoices:create', 'invoices:read', 'invoices:update', 'invoices:delete',
    'payroll:create', 'payroll:read', 'payroll:update', 'payroll:delete',
    'reports:read', 'settings:update', 'users:create', 'users:read', 'users:update', 'users:delete'
  ],
  manager: [
    'agencies:read', 'agencies:update',
    'employees:create', 'employees:read', 'employees:update',
    'timesheets:create', 'timesheets:read', 'timesheets:update',
    'invoices:read', 'invoices:update',
    'payroll:read', 'payroll:update',
    'reports:read'
  ],
  accountant: [
    'agencies:read',
    'employees:read',
    'timesheets:read',
    'invoices:create', 'invoices:read', 'invoices:update',
    'payroll:create', 'payroll:read', 'payroll:update',
    'reports:read'
  ],
  viewer: [
    'agencies:read',
    'employees:read',
    'timesheets:read',
    'invoices:read',
    'payroll:read',
    'reports:read'
  ]
};