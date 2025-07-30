import { z } from "zod";

// HMRC OAuth Configuration
export const HMRC_CONFIG = {
  // Test environment URLs
  authBaseUrl: "https://test-accounts.service.hmrc.gov.uk",
  apiBaseUrl: "https://test-api.service.hmrc.gov.uk",
  
  // Production URLs (switch when ready for live)
  // authBaseUrl: "https://accounts.service.hmrc.gov.uk",
  // apiBaseUrl: "https://api.service.hmrc.gov.uk",
  
  scopes: "read:employment-history write:real-time-information",
};

// OAuth token response schema
export const HMRCTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

export type HMRCToken = z.infer<typeof HMRCTokenSchema>;

// FPS (Full Payment Submission) schemas
export const FPSEmployeeSchema = z.object({
  nino: z.string(),
  name: z.object({
    forename: z.string(),
    surname: z.string(),
  }),
  pay: z.object({
    gross: z.number(),
    tax: z.number(),
    ni: z.number(),
    studentLoan: z.number().optional(),
  }),
  paymentDate: z.string(),
});

export const FPSSubmissionSchema = z.object({
  employerRef: z.string(),
  employees: z.array(FPSEmployeeSchema),
  payPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }),
});

export type FPSEmployee = z.infer<typeof FPSEmployeeSchema>;
export type FPSSubmission = z.infer<typeof FPSSubmissionSchema>;

// EPS (Employer Payment Summary) schema
export const EPSSubmissionSchema = z.object({
  employerRef: z.string(),
  payPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }),
  recoverableAmounts: z.object({
    smp: z.number().optional(),
    spp: z.number().optional(),
    sap: z.number().optional(),
    spbp: z.number().optional(),
  }).optional(),
  apprenticeshipLevyDue: z.number().optional(),
  cisDeductions: z.number().optional(),
});

export type EPSSubmission = z.infer<typeof EPSSubmissionSchema>;

// HMRC Response schemas
export const HMRCSubmissionResponseSchema = z.object({
  submissionId: z.string(),
  status: z.enum(["ACCEPTED", "REJECTED", "PENDING"]),
  acknowledgementReference: z.string().optional(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).optional(),
});

export type HMRCSubmissionResponse = z.infer<typeof HMRCSubmissionResponseSchema>;

// HMRC Service Class
export class HMRCService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.HMRC_CLIENT_ID || "";
    this.clientSecret = process.env.HMRC_CLIENT_SECRET || "";
    this.redirectUri = process.env.HMRC_REDIRECT_URI || "";
  }

  // Generate OAuth authorization URL
  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      scope: HMRC_CONFIG.scopes,
      redirect_uri: this.redirectUri,
      ...(state && { state }),
    });

    return `${HMRC_CONFIG.authBaseUrl}/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string): Promise<HMRCToken> {
    const response = await fetch(`${HMRC_CONFIG.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HMRC token exchange failed: ${error}`);
    }

    const data = await response.json();
    return HMRCTokenSchema.parse(data);
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<HMRCToken> {
    const response = await fetch(`${HMRC_CONFIG.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HMRC token refresh failed: ${error}`);
    }

    const data = await response.json();
    return HMRCTokenSchema.parse(data);
  }

  // Submit FPS to HMRC
  async submitFPS(submission: FPSSubmission, accessToken: string): Promise<HMRCSubmissionResponse> {
    const response = await fetch(`${HMRC_CONFIG.apiBaseUrl}/individuals/employments/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.hmrc.1.0+json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HMRC FPS submission failed: ${error}`);
    }

    const data = await response.json();
    return HMRCSubmissionResponseSchema.parse(data);
  }

  // Submit EPS to HMRC
  async submitEPS(submission: EPSSubmission, accessToken: string): Promise<HMRCSubmissionResponse> {
    const response = await fetch(`${HMRC_CONFIG.apiBaseUrl}/individuals/employments/payments/eps`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.hmrc.1.0+json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HMRC EPS submission failed: ${error}`);
    }

    const data = await response.json();
    return HMRCSubmissionResponseSchema.parse(data);
  }

  // Validate NINO format
  static isValidNino(nino: string): boolean {
    const ninoRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/;
    return ninoRegex.test(nino.replace(/\s/g, "").toUpperCase());
  }

  // Calculate PAYE tax (simplified - you may need more complex logic)
  static calculatePAYE(grossPay: number, taxCode: string = "1257L"): number {
    // Basic rate: 20% on income above £12,570
    const personalAllowance = 12570;
    const basicRateThreshold = 50270;
    const higherRateThreshold = 125140;

    const taxableIncome = Math.max(0, grossPay - personalAllowance);
    
    if (taxableIncome <= basicRateThreshold - personalAllowance) {
      return taxableIncome * 0.20;
    } else if (taxableIncome <= higherRateThreshold - personalAllowance) {
      const basicRateTax = (basicRateThreshold - personalAllowance) * 0.20;
      const higherRateTax = (taxableIncome - (basicRateThreshold - personalAllowance)) * 0.40;
      return basicRateTax + higherRateTax;
    } else {
      const basicRateTax = (basicRateThreshold - personalAllowance) * 0.20;
      const higherRateTax = (higherRateThreshold - basicRateThreshold) * 0.40;
      const additionalRateTax = (taxableIncome - (higherRateThreshold - personalAllowance)) * 0.45;
      return basicRateTax + higherRateTax + additionalRateTax;
    }
  }

  // Calculate National Insurance (simplified)
  static calculateNI(grossPay: number): number {
    const lowerEarningsLimit = 12570;
    const upperEarningsLimit = 50270;
    
    if (grossPay <= lowerEarningsLimit) {
      return 0;
    } else if (grossPay <= upperEarningsLimit) {
      return (grossPay - lowerEarningsLimit) * 0.12;
    } else {
      const standardRateNI = (upperEarningsLimit - lowerEarningsLimit) * 0.12;
      const higherRateNI = (grossPay - upperEarningsLimit) * 0.02;
      return standardRateNI + higherRateNI;
    }
  }
}