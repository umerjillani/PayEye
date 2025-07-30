interface TaxBand {
  min: number;
  max: number;
  rate: number;
}

interface TaxBands {
  personalAllowance: TaxBand;
  basicRate: TaxBand;
  higherRate: TaxBand;
  additionalRate: TaxBand;
}

interface PAYECalculationResult {
  grossPay: number;
  personalAllowance: number;
  taxableIncome: number;
  taxDue: number;
  taxBandBreakdown: {
    band: string;
    taxableAmount: number;
    rate: number;
    tax: number;
  }[];
}

export class PAYETaxCalculator {
  private currentTaxYear: string;
  private taxBands: TaxBands;

  constructor() {
    this.currentTaxYear = '2025-26';
    this.taxBands = {
      personalAllowance: { min: 0, max: 12570, rate: 0 },
      basicRate: { min: 12571, max: 37700, rate: 0.20 },
      higherRate: { min: 37701, max: 125140, rate: 0.40 },
      additionalRate: { min: 125141, max: Infinity, rate: 0.45 }
    };
  }

  calculateIncomeTax(
    grossPay: number, 
    taxCode: string, 
    periodType: 'weekly' | 'monthly' | 'annual' = 'annual',
    payeToDate: number = 0,
    payToDate: number = 0
  ): PAYECalculationResult {
    const personalAllowance = this.getPersonalAllowance(taxCode);
    const annualGrossPay = this.convertToAnnual(grossPay, periodType);
    const taxableIncome = Math.max(0, annualGrossPay - personalAllowance);
    
    const taxCalculation = this.applyTaxBands(taxableIncome);
    const periodTax = this.convertFromAnnual(taxCalculation.totalTax, periodType);

    return {
      grossPay,
      personalAllowance,
      taxableIncome,
      taxDue: periodTax,
      taxBandBreakdown: taxCalculation.breakdown
    };
  }

  private getPersonalAllowance(taxCode: string): number {
    // Handle different tax code formats
    const codeNumber = parseInt(taxCode.replace(/[A-Z]/g, ''));
    const codeLetter = taxCode.replace(/[0-9]/g, '');

    switch (codeLetter) {
      case 'L': // Standard personal allowance
        return codeNumber * 10;
      case 'BR': // Basic rate - no personal allowance
        return 0;
      case 'D0': // Higher rate - no personal allowance
        return 0;
      case 'D1': // Additional rate - no personal allowance
        return 0;
      case 'NT': // No tax
        return Infinity;
      case 'K': // Negative allowance (benefit in kind exceeds allowance)
        return -(codeNumber * 10);
      default:
        return codeNumber * 10;
    }
  }

  private applyTaxBands(taxableIncome: number): { totalTax: number; breakdown: any[] } {
    let totalTax = 0;
    let remainingIncome = taxableIncome;
    const breakdown = [];

    // Basic rate band
    if (remainingIncome > this.taxBands.basicRate.min - this.taxBands.personalAllowance.max - 1) {
      const basicRateMax = this.taxBands.basicRate.max - this.taxBands.personalAllowance.max;
      const basicRateTaxable = Math.min(remainingIncome, basicRateMax);
      const basicRateTax = basicRateTaxable * this.taxBands.basicRate.rate;
      
      totalTax += basicRateTax;
      remainingIncome -= basicRateTaxable;
      
      breakdown.push({
        band: 'Basic Rate (20%)',
        taxableAmount: basicRateTaxable,
        rate: this.taxBands.basicRate.rate,
        tax: basicRateTax
      });
    }

    // Higher rate band
    if (remainingIncome > 0) {
      const higherRateMax = this.taxBands.higherRate.max - this.taxBands.basicRate.max;
      const higherRateTaxable = Math.min(remainingIncome, higherRateMax);
      const higherRateTax = higherRateTaxable * this.taxBands.higherRate.rate;
      
      totalTax += higherRateTax;
      remainingIncome -= higherRateTaxable;
      
      if (higherRateTaxable > 0) {
        breakdown.push({
          band: 'Higher Rate (40%)',
          taxableAmount: higherRateTaxable,
          rate: this.taxBands.higherRate.rate,
          tax: higherRateTax
        });
      }
    }

    // Additional rate band
    if (remainingIncome > 0) {
      const additionalRateTax = remainingIncome * this.taxBands.additionalRate.rate;
      totalTax += additionalRateTax;
      
      breakdown.push({
        band: 'Additional Rate (45%)',
        taxableAmount: remainingIncome,
        rate: this.taxBands.additionalRate.rate,
        tax: additionalRateTax
      });
    }

    return { totalTax, breakdown };
  }

  private convertToAnnual(amount: number, periodType: 'weekly' | 'monthly' | 'annual'): number {
    switch (periodType) {
      case 'weekly':
        return amount * 52;
      case 'monthly':
        return amount * 12;
      case 'annual':
        return amount;
      default:
        return amount;
    }
  }

  private convertFromAnnual(amount: number, periodType: 'weekly' | 'monthly' | 'annual'): number {
    switch (periodType) {
      case 'weekly':
        return amount / 52;
      case 'monthly':
        return amount / 12;
      case 'annual':
        return amount;
      default:
        return amount;
    }
  }

  // Tax code validation
  validateTaxCode(taxCode: string): boolean {
    const validPatterns = [
      /^\d{1,4}[LMN]$/,  // Standard codes (e.g., 1257L)
      /^BR$/,            // Basic rate
      /^D[01]$/,         // Higher/Additional rate
      /^NT$/,            // No tax
      /^K\d{1,4}$/,      // K codes
      /^[0-9]+T$/        // T codes
    ];

    return validPatterns.some(pattern => pattern.test(taxCode.toUpperCase()));
  }
}