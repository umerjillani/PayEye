import { PAYETaxCalculator } from './paye-calculator';
import { NICCalculator } from './nic-calculator';

interface PayrollInput {
  grossPay: number;
  taxCode: string;
  nicCategory: string;
  payPeriod: 'weekly' | 'monthly' | 'annual';
  studentLoan?: {
    plan: 'plan1' | 'plan2' | 'plan4' | 'postgrad';
    threshold: number;
    rate: number;
  };
  pensionContribution?: {
    employeeRate: number;
    employerRate: number;
    pensionableEarnings: number;
  };
  employmentAllowanceUsed?: number;
}

interface PayrollResult {
  grossPay: number;
  taxableIncome: number;
  incomeTax: number;
  employeeNIC: number;
  employerNIC: number;
  studentLoanDeduction: number;
  pensionContribution: {
    employee: number;
    employer: number;
  };
  netPay: number;
  totalCostToEmployer: number;
  breakdown: {
    tax: any;
    nic: any;
  };
}

export class PayrollCalculator {
  private payeCalculator: PAYETaxCalculator;
  private nicCalculator: NICCalculator;

  constructor() {
    this.payeCalculator = new PAYETaxCalculator();
    this.nicCalculator = new NICCalculator();
  }

  calculatePayroll(input: PayrollInput): PayrollResult {
    // Calculate PAYE tax
    const taxCalculation = this.payeCalculator.calculateIncomeTax(
      input.grossPay,
      input.taxCode,
      input.payPeriod
    );

    // Calculate National Insurance
    const nicCalculation = this.nicCalculator.calculateFullNIC(
      input.grossPay,
      input.nicCategory,
      input.employmentAllowanceUsed || 0,
      input.payPeriod
    );

    // Calculate student loan deduction
    const studentLoanDeduction = this.calculateStudentLoan(
      input.grossPay,
      input.studentLoan,
      input.payPeriod
    );

    // Calculate pension contributions
    const pensionContributions = this.calculatePensionContributions(
      input.grossPay,
      input.pensionContribution,
      input.payPeriod
    );

    // Calculate net pay
    const totalDeductions = taxCalculation.taxDue + 
                           nicCalculation.employeeNIC + 
                           studentLoanDeduction + 
                           pensionContributions.employee;
    
    const netPay = input.grossPay - totalDeductions;

    // Calculate total cost to employer
    const totalCostToEmployer = input.grossPay + 
                               nicCalculation.employerNIC + 
                               pensionContributions.employer;

    return {
      grossPay: input.grossPay,
      taxableIncome: taxCalculation.taxableIncome,
      incomeTax: taxCalculation.taxDue,
      employeeNIC: nicCalculation.employeeNIC,
      employerNIC: nicCalculation.employerNIC,
      studentLoanDeduction,
      pensionContribution: pensionContributions,
      netPay,
      totalCostToEmployer,
      breakdown: {
        tax: taxCalculation.taxBandBreakdown,
        nic: nicCalculation.breakdown
      }
    };
  }

  private calculateStudentLoan(
    grossPay: number,
    studentLoan?: PayrollInput['studentLoan'],
    payPeriod: 'weekly' | 'monthly' | 'annual' = 'annual'
  ): number {
    if (!studentLoan) return 0;

    const annualGrossPay = this.convertToAnnual(grossPay, payPeriod);
    
    if (annualGrossPay <= studentLoan.threshold) {
      return 0;
    }

    const annualDeduction = (annualGrossPay - studentLoan.threshold) * studentLoan.rate;
    return this.convertFromAnnual(annualDeduction, payPeriod);
  }

  private calculatePensionContributions(
    grossPay: number,
    pension?: PayrollInput['pensionContribution'],
    payPeriod: 'weekly' | 'monthly' | 'annual' = 'annual'
  ): { employee: number; employer: number } {
    if (!pension) {
      return { employee: 0, employer: 0 };
    }

    const pensionableEarnings = pension.pensionableEarnings || grossPay;
    
    const employeeContribution = pensionableEarnings * (pension.employeeRate / 100);
    const employerContribution = pensionableEarnings * (pension.employerRate / 100);

    return {
      employee: employeeContribution,
      employer: employerContribution
    };
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

  // Batch processing for multiple employees
  calculateBatchPayroll(inputs: PayrollInput[]): PayrollResult[] {
    return inputs.map(input => this.calculatePayroll(input));
  }

  // Generate payslip data
  generatePayslip(input: PayrollInput, employeeDetails: any): any {
    const calculation = this.calculatePayroll(input);
    
    return {
      employee: employeeDetails,
      payPeriod: input.payPeriod,
      grossPay: calculation.grossPay,
      deductions: {
        incomeTax: calculation.incomeTax,
        nationalInsurance: calculation.employeeNIC,
        studentLoan: calculation.studentLoanDeduction,
        pension: calculation.pensionContribution.employee
      },
      netPay: calculation.netPay,
      yearToDate: {
        // This would be calculated from historical data
        grossPay: 0,
        incomeTax: 0,
        nationalInsurance: 0,
        studentLoan: 0,
        pension: 0,
        netPay: 0
      },
      employerCosts: {
        nationalInsurance: calculation.employerNIC,
        pension: calculation.pensionContribution.employer,
        total: calculation.totalCostToEmployer
      }
    };
  }
}

// Student loan thresholds for 2025-26
export const STUDENT_LOAN_THRESHOLDS = {
  plan1: { threshold: 22015, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31395, rate: 0.09 },
  postgrad: { threshold: 21000, rate: 0.06 }
};

// Workplace pension auto-enrollment thresholds
export const PENSION_THRESHOLDS = {
  autoEnrollment: {
    minAge: 22,
    maxAge: 65,
    earningsThreshold: 10000,
    minimumContribution: {
      employee: 5,
      employer: 3,
      total: 8
    }
  }
};