import { db } from "./db";
import { users, companies, timesheets } from "../shared/schema";
import { eq } from "drizzle-orm";

// Test authentication and company loading
async function testAuthFlow() {
  console.log("=== Testing Authentication Flow ===\n");
  
  // 1. Check user exists
  console.log("1. Checking user 'company'...");
  const user = await db.select().from(users).where(eq(users.username, "company"));
  console.log("User found:", user.length > 0 ? "YES" : "NO");
  if (user.length > 0) {
    console.log("User details:", {
      id: user[0].id,
      username: user[0].username,
      companyId: user[0].companyId
    });
  }
  
  // 2. Check company exists
  if (user.length > 0 && user[0].companyId) {
    console.log("\n2. Checking company...");
    const company = await db.select().from(companies).where(eq(companies.id, user[0].companyId));
    console.log("Company found:", company.length > 0 ? "YES" : "NO");
    if (company.length > 0) {
      console.log("Company details:", {
        id: company[0].id,
        name: company[0].companyName,
        slug: company[0].slug
      });
    }
    
    // 3. Check timesheets for this company
    console.log("\n3. Checking timesheets for company...");
    const companyTimesheets = await db.select().from(timesheets).where(eq(timesheets.companyId, user[0].companyId)).limit(5);
    console.log("Timesheets found:", companyTimesheets.length);
    companyTimesheets.forEach((ts, index) => {
      console.log(`Timesheet ${index + 1}:`, {
        id: ts.id,
        hoursCharged: ts.hoursCharged,
        payRate: ts.payRate,
        grossPay: ts.grossPay,
        status: ts.status
      });
    });
  }
  
  // 4. Check all companies
  console.log("\n4. Checking all companies...");
  const allCompanies = await db.select().from(companies).limit(5);
  console.log("Total companies found:", allCompanies.length);
  allCompanies.forEach((company, index) => {
    console.log(`Company ${index + 1}:`, {
      id: company.id,
      name: company.companyName,
      slug: company.slug
    });
  });
}

testAuthFlow().catch(console.error).finally(() => process.exit(0));