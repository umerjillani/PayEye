interface NICRates {
  threshold: number;
  rate: number;
  upperThreshold: number;
  upperRate: number;
}

interface NICCategories {
  [key: string]: NICRates;
}

interface EmployerNICRates {
  secondary: {
    threshold: number;
    rate: number;
  };
  employmentAllowance: number;
}

interface NICCalculationResult {
  employeeNIC: number;
  employerNIC: number;
  breakdown: {
    category: string;
    grossPay: number;
    lowerBandNIC: number;
    upperBandNIC: number;
    totalNIC: number;
  };
}

export class NICCalculator {
  private employeeRates: NICCategories;
  private employerRates: EmployerNICRates;
  private currentTaxYear: string;

  constructor() {
    this.currentTaxYear = '2025-26';
    
    // Employee NIC rates for 2025-26
    this.employeeRates = {
      A: { threshold: 12570, rate: 0.08, upperThreshold: 50270, upperRate: 0.02 },
      B: { threshold: 12570, rate: 0.055, upperThreshold: 50270, upperRate: 0.02 },
      C: { threshold: 12570, rate: 0, upperThreshold: 50270, upperRate: 0 },
      H: { threshold: 12570, rate: 0.08, upperThreshold: 50270, upperRate: 0.02 },
      J: { threshold: 12570, rate: 0.02, upperThreshold: 50270, upperRate: 0.02 },
      L: { threshold: 12570, rate: 0.08, upperThreshold: 50270, upperRate: 0.02 },
      S: { threshold: 12570, rate: 0.08, upperThreshold: 50270, upperRate: 0.02 },
      X: { threshold: 12570, rate: 0, upperThreshold: 50270, upperRate: 0 },
      Z: { threshold: 12570, rate: 0, upperThreshold: 50270, upperRate: 0 }
    };

    // Employer NIC rates
    this.employerRates = {
      secondary: { threshold: 5000, rate: 0.138 }, // 13.8% for 2025-26
      employmentAllowance: 5000 // Annual employment allowance
    };
  }

  calculateEmployeeNIC(
    grossPay: number, 
    nicCategory: string, 
    payPeriod: 'weekly' | 'monthly' | 'annual' = 'annual'
  ): number {
    const rates = this.employeeRates[nicCategory.toUpperCase()];
    if (!rates) {
      throw new Error(`Invalid NIC category: ${nicCategory}`);
    }

    const annualGrossPay = this.convertToAnnual(grossPay, payPeriod);
    const annualNIC = this.applyNICRates(annualGrossPay, rates);
    
    return this.convertFromAnnual(annualNIC, payPeriod);
  }

  calculateEmployerNIC(
    grossPay: number, 
    employmentAllowanceUsed: number = 0,
    payPeriod: 'weekly' | 'monthly' | 'annual' = 'annual'
  ): number {
    const annualGrossPay = this.convertToAnnual(grossPay, payPeriod);
    const rates = this.employerRates.secondary;
    
    // Calculate basic employer NIC
    const basicNIC = Math.max(0, (annualGrossPay - rates.threshold) * rates.rate);
    
    // Apply employment allowance (annual)
    const remainingAllowance = Math.max(0, this.employerRates.employmentAllowance - employmentAllowanceUsed);
    const finalNIC = Math.max(0, basicNIC - remainingAllowance);
    
    return this.convertFromAnnual(finalNIC, payPeriod);
  }

  calculateFullNIC(
    grossPay: number,
    nicCategory: string,
    employmentAllowanceUsed: number = 0,
    payPeriod: 'weekly' | 'monthly' | 'annual' = 'annual'
  ): NICCalculationResult {
    const rates = this.employeeRates[nicCategory.toUpperCase()];
    if (!rates) {
      throw new Error(`Invalid NIC category: ${nicCategory}`);
    }

    const annualGrossPay = this.convertToAnnual(grossPay, payPeriod);
    
    // Calculate employee NIC
    const employeeNIC = this.applyNICRates(annualGrossPay, rates);
    
    // Calculate employer NIC
    const employerRates = this.employerRates.secondary;
    const basicEmployerNIC = Math.max(0, (annualGrossPay - employerRates.threshold) * employerRates.rate);
    const remainingAllowance = Math.max(0, this.employerRates.employmentAllowance - employmentAllowanceUsed);
    const employerNIC = Math.max(0, basicEmployerNIC - remainingAllowance);

    // Calculate breakdown
    const lowerBandAmount = Math.min(Math.max(0, annualGrossPay - rates.threshold), rates.upperThreshold - rates.threshold);
    const upperBandAmount = Math.max(0, annualGrossPay - rates.upperThreshold);
    
    const lowerBandNIC = lowerBandAmount * rates.rate;
    const upperBandNIC = upperBandAmount * rates.upperRate;

    return {
      employeeNIC: this.convertFromAnnual(employeeNIC, payPeriod),
      employerNIC: this.convertFromAnnual(employerNIC, payPeriod),
      breakdown: {
        category: nicCategory.toUpperCase(),
        grossPay,
        lowerBandNIC: this.convertFromAnnual(lowerBandNIC, payPeriod),
        upperBandNIC: this.convertFromAnnual(upperBandNIC, payPeriod),
        totalNIC: this.convertFromAnnual(employeeNIC, payPeriod)
      }
    };
  }

  private applyNICRates(annualGrossPay: number, rates: NICRates): number {
    if (annualGrossPay <= rates.threshold) {
      return 0;
    }

    // Lower band calculation
    const lowerBandAmount = Math.min(annualGrossPay - rates.threshold, rates.upperThreshold - rates.threshold);
    const lowerBandNIC = lowerBandAmount * rates.rate;

    // Upper band calculation
    const upperBandAmount = Math.max(0, annualGrossPay - rates.upperThreshold);
    const upperBandNIC = upperBandAmount * rates.upperRate;

    return lowerBandNIC + upperBandNIC;
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

  // Validate NIC category
  validateNICCategory(category: string): boolean {
    return Object.keys(this.employeeRates).includes(category.toUpperCase());
  }

  // Get NIC category description
  getNICCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      A: 'Standard rate for employees under State Pension age',
      B: 'Married women and widows with reduced rate election',
      C: 'Employees over State Pension age',
      H: 'Apprentices under 25',
      J: 'Employees who defer State Pension',
      L: 'Employees with reduced rate (director)',
      S: 'Employees with reduced rate (share fishermen)',
      X: 'Employees who do not pay NIC',
      Z: 'Employees under 21'
    };
    
    return descriptions[category.toUpperCase()] || 'Unknown category';
  }
}