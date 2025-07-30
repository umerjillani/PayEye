import { createHash, randomBytes } from 'crypto';

interface HMRCConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
  scope: string;
}

interface HMRCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface EmploymentRecord {
  employerName: string;
  taxCode: string;
  startDate: string;
  endDate?: string;
  payFrequency: string;
  employerPayeReference: string;
}

interface RTIEmployeeData {
  nino: string;
  employments: EmploymentRecord[];
  retrievedAt: Date;
  status: 'success' | 'error' | 'no_consent' | 'not_found';
  errorMessage?: string;
}

export class HMRCRTIService {
  private config: HMRCConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    this.config = {
      clientId: process.env.HMRC_CLIENT_ID || '',
      clientSecret: process.env.HMRC_CLIENT_SECRET || '',
      redirectUri: process.env.HMRC_REDIRECT_URI || 'http://localhost:5000/api/hmrc/callback',
      baseUrl: process.env.HMRC_BASE_URL || 'https://test-api.service.hmrc.gov.uk',
      scope: 'read:employment'
    };
  }

  /**
   * Generate OAuth 2.0 authorization URL for user consent
   */
  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: state || this.generateState()
    });

    return `${this.config.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<HMRCTokenResponse> {
    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokenData = await response.json() as HMRCTokenResponse;
    this.setTokens(tokenData);
    return tokenData;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<HMRCTokenResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const tokenData = await response.json() as HMRCTokenResponse;
    this.setTokens(tokenData);
    return tokenData;
  }

  /**
   * Retrieve employment information for a specific NINO
   */
  async getEmploymentInfo(nino: string, fromDate: string, toDate: string): Promise<RTIEmployeeData> {
    await this.ensureValidToken();

    const sanitizedNino = nino.replace(/\s/g, '').toUpperCase();
    
    try {
      const response = await fetch(
        `${this.config.baseUrl}/individuals/employment/${sanitizedNino}/employment?from=${fromDate}&to=${toDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/vnd.hmrc.1.0+json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        return {
          nino: sanitizedNino,
          employments: [],
          retrievedAt: new Date(),
          status: 'not_found',
          errorMessage: 'No employment records found'
        };
      }

      if (response.status === 403) {
        return {
          nino: sanitizedNino,
          employments: [],
          retrievedAt: new Date(),
          status: 'no_consent',
          errorMessage: 'User consent required'
        };
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        nino: sanitizedNino,
        employments: this.parseEmploymentData(data),
        retrievedAt: new Date(),
        status: 'success'
      };

    } catch (error) {
      return {
        nino: sanitizedNino,
        employments: [],
        retrievedAt: new Date(),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process a batch of employees for RTI data retrieval
   */
  async processBatch(employees: { nino: string; name: string; payrollId?: string }[]): Promise<RTIEmployeeData[]> {
    const currentTaxYear = this.getCurrentTaxYear();
    const results: RTIEmployeeData[] = [];

    // Process in smaller chunks to avoid rate limiting
    const chunkSize = 10;
    for (let i = 0; i < employees.length; i += chunkSize) {
      const chunk = employees.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(employee => 
        this.getEmploymentInfo(
          employee.nino,
          `${currentTaxYear.start}`,
          `${currentTaxYear.end}`
        )
      );

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            nino: chunk[index].nino,
            employments: [],
            retrievedAt: new Date(),
            status: 'error',
            errorMessage: result.reason?.message || 'Processing failed'
          });
        }
      });

      // Rate limiting delay between chunks
      if (i + chunkSize < employees.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private setTokens(tokenData: HMRCTokenResponse): void {
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available. User authentication required.');
    }

    // Refresh token if expiring within 5 minutes
    if (this.tokenExpiry && this.tokenExpiry.getTime() - Date.now() < 300000) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Token expired and no refresh token available');
      }
    }
  }

  private parseEmploymentData(data: any): EmploymentRecord[] {
    if (!data.employments || !Array.isArray(data.employments)) {
      return [];
    }

    return data.employments.map((emp: any) => ({
      employerName: emp.employerName || '',
      taxCode: emp.taxCode || '',
      startDate: emp.startDate || '',
      endDate: emp.endDate,
      payFrequency: emp.payFrequency || 'WEEKLY',
      employerPayeReference: emp.employerPayeReference || ''
    }));
  }

  private getCurrentTaxYear(): { start: string; end: string } {
    const now = new Date();
    const year = now.getFullYear();
    const taxYearStart = new Date(year, 3, 6); // April 6th
    
    if (now < taxYearStart) {
      // Current tax year is previous year
      return {
        start: `${year - 1}-04-06`,
        end: `${year}-04-05`
      };
    } else {
      // Current tax year
      return {
        start: `${year}-04-06`,
        end: `${year + 1}-04-05`
      };
    }
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }
}

export const hmrcRTIService = new HMRCRTIService();