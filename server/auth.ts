import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "../shared/schema.js";
import { initializeUserSession } from "./multi-tenant-auth.js";
// import { sendOTPEmail, generateOTP } from "./email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
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
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "payeye-session-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const { username, email, password, firstName, lastName } = req.body;
    
    const existingUserByUsername = await storage.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingUserByEmail = await storage.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Get or create a default company for new users
    let companies = await storage.getCompanies();
    if (companies.length === 0) {
      await storage.createCompany({
        id: "acme-001",
        companyName: "Acme Payroll Solutions",
        subdomainSlug: "acme",
        contactEmail: "admin@acme-payroll.com",
        logoUrl: null,
        primaryColor: null,
        planTier: "professional",
        active: true
      });
      
      companies = await storage.getCompanies();
    }

    // Simplified registration - direct login without email verification
    try {
      const user = await storage.createUser({
        username,
        email,
        password: await hashPassword(password),
        firstName,
        lastName,
        role: "admin",
        companyId: companies[0].id,
        firstTimeLogin: true,
        status: "active",
        isEmailVerified: true, // Set to true for simplified flow
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Initialize multi-tenant session
        await initializeUserSession(req, user.id);
        
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    // Initialize multi-tenant session for logged in user
    const user = req.user!;
    
    // Set session data directly for regular company login
    req.session.userId = user.id;
    req.session.companyId = user.companyId;
    req.session.userType = 'admin';
    req.session.isAuthenticated = true;
    
    console.log("Login successful. Session set:", {
      userId: req.session.userId,
      companyId: req.session.companyId,
      userType: req.session.userType
    });
    
    res.status(200).json(user);
  });

  app.post("/api/logout", (req, res, next) => {
    // SECURITY: Complete session destruction for all user types
    const sessionDestroy = () => {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({ message: "Successfully logged out" });
      });
    };

    // Handle both passport and custom session logout
    if (req.logout && typeof req.logout === 'function') {
      req.logout((err) => {
        if (err) {
          console.error("Passport logout error:", err);
        }
        sessionDestroy();
      });
    } else {
      sessionDestroy();
    }
  });

  // NOTE: This endpoint is now handled in routes.ts to support both super admin and company admin sessions
  // app.get("/api/user", (req, res) => {
  //   if (!req.isAuthenticated()) return res.sendStatus(401);
  //   res.json(req.user);
  // });
}
