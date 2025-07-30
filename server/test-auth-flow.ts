import express from 'express';
import session from 'express-session';
import { db } from "./db";
import { users, companies } from "../shared/schema";
import { eq } from "drizzle-orm";

// Create a test session to check auth flow
async function testAuthFlow() {
  console.log("=== Testing Complete Auth Flow ===\n");
  
  // 1. Get user from database
  console.log("1. Getting user from database...");
  const user = await db.select().from(users).where(eq(users.username, "company")).limit(1);
  
  if (user.length === 0) {
    console.log("ERROR: User 'company' not found!");
    return;
  }
  
  console.log("User found:", {
    id: user[0].id,
    username: user[0].username,
    companyId: user[0].companyId,
    email: user[0].email
  });
  
  // 2. Get company for user
  console.log("\n2. Getting company for user...");
  if (user[0].companyId) {
    const company = await db.select().from(companies).where(eq(companies.id, user[0].companyId)).limit(1);
    
    if (company.length > 0) {
      console.log("Company found:", {
        id: company[0].id,
        name: company[0].companyName,
        addressLine1: company[0].addressLine1
      });
    } else {
      console.log("ERROR: Company not found for ID:", user[0].companyId);
    }
  } else {
    console.log("ERROR: User has no company ID!");
  }
  
  // 3. Test session structure
  console.log("\n3. Expected session structure:");
  console.log({
    userId: user[0].id,
    companyId: user[0].companyId,
    userType: 'admin',
    isAuthenticated: true
  });
  
  // 4. Test API endpoints
  console.log("\n4. Testing API endpoints:");
  console.log("- /api/user should return user data");
  console.log("- /api/companies should return [company] array");
  console.log("- /api/timesheets should return timesheets for company");
}

testAuthFlow().catch(console.error).finally(() => process.exit(0));