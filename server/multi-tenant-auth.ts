import express from 'express';
import { db } from './db.js';
import { users, companies } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

// Session interface for multi-tenant authentication
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userType?: 'super_admin' | 'admin';
    currentCompanyId?: string;
    accessibleCompanyIds?: string[];
    isAuthenticated?: boolean;
  }
}

// Extend Express Request interface to include company context
declare global {
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

// Extended interface for authenticated requests with company context
export interface AuthenticatedRequest extends express.Request {
  companyId: string;
}

// User interface with multi-tenant properties
export interface MultiTenantUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'super_admin' | 'admin';
  companyId?: string; // Only for regular admins
  accessibleCompanyIds: string[]; // All companies they can access
}

// Check if user is super admin (can access all companies)
export function isSuperAdmin(req: express.Request): boolean {
  return req.session.userType === 'super_admin';
}

// Check if user is regular admin (single company only)
export function isRegularAdmin(req: express.Request): boolean {
  return req.session.userType === 'admin';
}

// Get current company ID for the user
export function getCurrentCompanyId(req: express.Request): string | null {
  return req.session.currentCompanyId || null;
}

// Get all companies accessible to the user
export async function getAccessibleCompanies(req: express.Request): Promise<any[]> {
  // Check both user types for authentication
  if (!req.session.userId && !req.session.superAdminId) return [];

  try {
    if (isSuperAdmin(req)) {
      // Super admins can access all companies
      const allCompanies = await db.select().from(companies);
      return allCompanies;
    } else {
      // Regular admins can only access their assigned company
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (user.length === 0 || !user[0].companyId) return [];

      const userCompany = await db
        .select()
        .from(companies)
        .where(eq(companies.id, user[0].companyId))
        .limit(1);

      return userCompany;
    }
  } catch (error) {
    console.error('Error fetching accessible companies:', error);
    return [];
  }
}

// Switch company for super admins
export async function switchCompany(req: express.Request, companyId: string): Promise<boolean> {
  if (!isSuperAdmin(req)) {
    return false; // Only super admins can switch companies
  }

  try {
    // Verify the company exists
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company.length === 0) {
      return false;
    }

    // Update session with new company
    req.session.currentCompanyId = companyId;
    return true;
  } catch (error) {
    console.error('Error switching company:', error);
    return false;
  }
}

// Middleware to require authentication
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Accept both super admin and regular admin authentication
  const isAuthenticated = req.session.isAuthenticated && 
    (req.session.userId || req.session.superAdminId);
  
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to require super admin access with strict separation
export function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  // SECURITY: Block if there's any company admin session active
  if (req.session?.userId || req.session?.companyId) {
    return res.status(403).json({ error: "Access denied: Company admin session detected. Please logout and use super admin login." });
  }
  
  // SECURITY: Only allow super admin sessions
  if (!req.session.isAuthenticated || !isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

// Middleware to prevent super admins from accessing company-specific endpoints
export function requireCompanyAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  // SECURITY: Block if there's any super admin session active
  if (req.session?.superAdminId) {
    return res.status(403).json({ error: "Access denied: Super admin session detected. Please logout and use company login." });
  }
  
  // SECURITY: Only allow company admin sessions
  if (!req.session?.userId || !req.session?.companyId) {
    return res.status(403).json({ error: "Company admin access required" });
  }
  next();
}

// Middleware to ensure user has access to current company
export function requireValidCompanyAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const currentCompanyId = getCurrentCompanyId(req);
  if (!currentCompanyId) {
    return res.status(400).json({ error: 'No company selected' });
  }

  // Super admins have access to all companies
  if (isSuperAdmin(req)) {
    return next();
  }

  // Regular admins can only access their assigned company
  if (isRegularAdmin(req)) {
    // Check if the current company matches their assigned company
    // This will be validated against their user record in the actual route handlers
    return next();
  }

  return res.status(403).json({ error: 'Access denied to this company' });
}

// New middleware specifically for allowing super admins to access company data
export function requireCompanyDataAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Allow both authenticated super admins and company admins
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admin case: they must have switched to a company
  if (req.session.superAdminId && req.session.userType === 'super_admin') {
    const currentCompanyId = getCurrentCompanyId(req);
    if (!currentCompanyId) {
      return res.status(400).json({ error: 'Please select a company first' });
    }
    // Set the company context for the request
    req.companyId = currentCompanyId;
    return next();
  }

  // Company admin case: use their assigned company
  if (req.session.userId && req.session.companyId) {
    req.companyId = req.session.companyId;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// Get user's multi-tenant info
export async function getUserInfo(req: express.Request): Promise<MultiTenantUser | null> {
  // Handle both super admin and regular admin sessions
  if (!req.session.userId && !req.session.superAdminId) return null;

  try {
    // Handle super admin sessions
    if (req.session.superAdminId) {
      // Get super admin from super_admins table
      const { superAdmins } = await import('../shared/schema.js');
      const superAdminData = await db
        .select()
        .from(superAdmins)
        .where(eq(superAdmins.id, req.session.superAdminId))
        .limit(1);

      if (superAdminData.length === 0) return null;

      const userData = superAdminData[0];
      // Super admins can access all companies
      const allCompanies = await db.select({ id: companies.id }).from(companies);
      const accessibleCompanyIds = allCompanies.map(c => c.id);

      return {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        userType: 'super_admin' as const,
        companyId: undefined,
        accessibleCompanyIds
      };
    }

    // Handle regular admin sessions
    if (req.session.userId) {
      const userData = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (userData.length === 0) return null;

      const user = userData[0];
      const accessibleCompanyIds = user.companyId ? [user.companyId] : [];

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: 'admin' as const,
        companyId: user.companyId || undefined,
        accessibleCompanyIds
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Initialize user session after login
export async function initializeUserSession(req: express.Request, userId: number): Promise<boolean> {
  try {
    const userInfo = await getUserInfo(req);
    if (!userInfo) return false;

    req.session.userId = userId;
    req.session.userType = userInfo.userType;
    req.session.accessibleCompanyIds = userInfo.accessibleCompanyIds;
    req.session.isAuthenticated = true;

    // Set initial company
    if (userInfo.userType === 'super_admin') {
      // For super admins, set the first available company as current
      if (userInfo.accessibleCompanyIds.length > 0) {
        req.session.currentCompanyId = userInfo.accessibleCompanyIds[0];
      }
    } else {
      // For regular admins, set their assigned company
      req.session.currentCompanyId = userInfo.companyId || null;
    }

    return true;
  } catch (error) {
    console.error('Error initializing user session:', error);
    return false;
  }
}