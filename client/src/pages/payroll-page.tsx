import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { useAppContext } from "@/contexts/app-context";
import { Timesheet, Candidate, Agency } from "@shared/schema";
import { User, Clock, Eye, ArrowLeft, Search, Banknote, Calendar, FileText, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function PayrollPage() {
  const { selectedCompany } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Candidate | null>(null);
  const [showEmployeeTimesheets, setShowEmployeeTimesheets] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [showTimesheetView, setShowTimesheetView] = useState(false);

  const { data: candidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: timesheets } = useQuery<Timesheet[]>({
    queryKey: ["/api/timesheets", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["/api/agencies", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const getEmployeeName = (candidateId: string) => {
    const employee = candidates?.find(c => c.id === candidateId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown Employee";
  };

  const getAgencyName = (agencyId: string) => {
    const agency = agencies?.find(a => a.id === agencyId);
    return agency?.agencyName || "Unknown Agency";
  };

  // Get all approved timesheets for a specific employee
  const getEmployeeTimesheets = (candidateId: string) => {
    if (!timesheets) return [];
    
    // Special handling for virtual employees (extracted from timesheets)
    if (candidateId.startsWith('extracted-')) {
      const extractedName = candidateId.replace('extracted-', '').replace(/-/g, ' ');
      return timesheets.filter(ts => {
        if (ts.status !== 'approved') return false; // Only approved timesheets
        const timesheetEmployeeName = (ts.extractedData as any)?.employeeName || '';
        return timesheetEmployeeName.toLowerCase().trim() === extractedName.toLowerCase().trim();
      });
    }
    
    // Get timesheets by candidate ID - only approved
    const directTimesheets = timesheets.filter(ts => 
      ts.candidateId === candidateId && ts.status === 'approved'
    );
    
    // Also get timesheets by employee name for those without candidateId
    const candidate = candidates?.find(c => c.id === candidateId);
    if (candidate) {
      const fullName = `${candidate.firstName} ${candidate.lastName}`;
      const nameTimesheets = timesheets.filter(ts => {
        if (ts.candidateId) return false; // Already included above
        if (ts.status !== 'approved') return false; // Only approved timesheets
        const extractedName = (ts.extractedData as any)?.employeeName;
        return extractedName && extractedName.toLowerCase().trim() === fullName.toLowerCase().trim();
      });
      return [...directTimesheets, ...nameTimesheets];
    }
    
    return directTimesheets;
  };

  // Group employees with their approved timesheet data
  const getEmployeePayrollData = () => {
    if (!candidates || !timesheets) return [];
    
    // Only get approved timesheets
    const approvedTimesheets = timesheets.filter(ts => ts.status === 'approved');
    
    // Get all employees who have approved timesheets
    const employeesWithTimesheets = candidates.map(employee => {
      const employeeTimesheets = getEmployeeTimesheets(employee.id); // Already filtered to approved only
      const totalGrossPay = employeeTimesheets.reduce((sum, ts) => sum + parseFloat(ts.grossPay || '0'), 0);
      const totalHours = employeeTimesheets.reduce((sum, ts) => sum + parseFloat(ts.hoursCharged || '0'), 0);
      
      return {
        employee,
        timesheets: employeeTimesheets,
        totalGrossPay,
        timesheetCount: employeeTimesheets.length,
        approvedCount: employeeTimesheets.length, // All are approved
        totalHours
      };
    }).filter(data => data.timesheetCount > 0);
    
    // Also handle approved timesheets without assigned employees
    const processedCandidateIds = new Set(employeesWithTimesheets.map(e => e.employee.id));
    const processedTimesheetIds = new Set();
    employeesWithTimesheets.forEach(data => {
      data.timesheets.forEach(ts => processedTimesheetIds.add(ts.id));
    });
    
    const unmatchedTimesheets = approvedTimesheets.filter(ts => !processedTimesheetIds.has(ts.id));
    
    // Group unmatched approved timesheets by extracted employee name
    const unmatchedByName = new Map<string, Timesheet[]>();
    unmatchedTimesheets.forEach(ts => {
      const extractedName = (ts.extractedData as any)?.employeeName;
      if (extractedName) {
        const existing = unmatchedByName.get(extractedName) || [];
        unmatchedByName.set(extractedName, [...existing, ts]);
      }
    });
    
    // Add virtual employees for unmatched approved timesheets
    unmatchedByName.forEach((timesheets, name) => {
      const totalGrossPay = timesheets.reduce((sum, ts) => sum + parseFloat(ts.grossPay || '0'), 0);
      const totalHours = timesheets.reduce((sum, ts) => sum + parseFloat(ts.hoursCharged || '0'), 0);
      
      employeesWithTimesheets.push({
        employee: {
          id: `extracted-${name.replace(/\s+/g, '-')}`,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ') || '',
          status: 'active',
          companyId: selectedCompany?.id || ''
        } as Candidate,
        timesheets,
        totalGrossPay,
        timesheetCount: timesheets.length,
        approvedCount: timesheets.length, // All are approved
        totalHours
      });
    });
    
    return employeesWithTimesheets.sort((a, b) => b.totalGrossPay - a.totalGrossPay);
  };

  const employeePayrollData = getEmployeePayrollData();
  const filteredEmployees = employeePayrollData.filter(data =>
    `${data.employee.firstName} ${data.employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleViewEmployee = (employee: Candidate) => {
    setSelectedEmployee(employee);
    setShowEmployeeTimesheets(true);
  };

  const handleViewTimesheet = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setShowTimesheetView(true);
  };

  if (!selectedCompany) {
    return <CompanySelectorModal />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Payroll"
        description="Manage employee payroll and view timesheet summaries"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                      {employeePayrollData.length}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total Employees
                    </div>
                  </div>
                  <User className="w-8 h-8 text-primary-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                      £{employeePayrollData.reduce((sum, data) => sum + data.totalGrossPay, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total Gross Pay
                    </div>
                  </div>
                  <Banknote className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                      {employeePayrollData.reduce((sum, data) => sum + data.timesheetCount, 0)}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total Timesheets
                    </div>
                  </div>
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                      {employeePayrollData.reduce((sum, data) => sum + data.totalHours, 0).toFixed(1)}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total Hours
                    </div>
                  </div>
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Table */}
          <Card>
            <CardHeader>
              <CardTitle>Employees with Approved Timesheets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Approved Timesheets</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Total Gross Pay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((data) => (
                    <TableRow key={data.employee.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={() => handleViewEmployee(data.employee)}>
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {data.employee.firstName} {data.employee.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {data.employee.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => handleViewEmployee(data.employee)}>
                        {data.employee.employmentType || 'Employee'}
                      </TableCell>
                      <TableCell onClick={() => handleViewEmployee(data.employee)}>
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          {data.approvedCount} approved
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => handleViewEmployee(data.employee)}>
                        {data.totalHours.toFixed(1)} hrs
                      </TableCell>
                      <TableCell onClick={() => handleViewEmployee(data.employee)}>
                        <div className="font-semibold">£{data.totalGrossPay.toFixed(2)}</div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewEmployee(data.employee)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No employees with approved timesheets found</h3>
                        <p className="text-muted-foreground">
                          {searchTerm ? 'Try adjusting your search criteria.' : 'Approve some timesheets to view payroll data.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Employee Timesheets Modal */}
      <Dialog open={showEmployeeTimesheets} onOpenChange={setShowEmployeeTimesheets}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                {selectedEmployee?.firstName} {selectedEmployee?.lastName} - Timesheets
              </DialogTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowEmployeeTimesheets(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </DialogHeader>

          {selectedEmployee && (
            <div className="mt-4">
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Total Gross Pay</p>
                  <p className="text-lg font-semibold">
                    £{getEmployeeTimesheets(selectedEmployee.id).reduce((sum, ts) => sum + parseFloat(ts.grossPay || '0'), 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Total Hours</p>
                  <p className="text-lg font-semibold">
                    {getEmployeeTimesheets(selectedEmployee.id).reduce((sum, ts) => sum + parseFloat(ts.hoursCharged || '0'), 0).toFixed(1)}
                  </p>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Total Timesheets</p>
                  <p className="text-lg font-semibold">
                    {getEmployeeTimesheets(selectedEmployee.id).length}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Pay Rate</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getEmployeeTimesheets(selectedEmployee.id).map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(timesheet.startDate), "dd/MM/yyyy")} - 
                          {format(new Date(timesheet.endDate), "dd/MM/yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {timesheet.agencyId ? getAgencyName(timesheet.agencyId) : 
                           (timesheet.extractedData as any)?.clientName || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>{timesheet.hoursCharged}</TableCell>
                      <TableCell>£{timesheet.payRate}</TableCell>
                      <TableCell className="font-medium">£{timesheet.grossPay}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(timesheet.status)}>
                          {timesheet.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTimesheet(timesheet);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Timesheet View Modal */}
      <Dialog open={showTimesheetView} onOpenChange={setShowTimesheetView}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Timesheet Details</DialogTitle>
          </DialogHeader>
          
          {selectedTimesheet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Employee</p>
                  <p className="font-medium">
                    {selectedTimesheet.candidateId ? getEmployeeName(selectedTimesheet.candidateId) : 
                     (selectedTimesheet.extractedData as any)?.employeeName || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Agency</p>
                  <p className="font-medium">
                    {selectedTimesheet.agencyId ? getAgencyName(selectedTimesheet.agencyId) : 
                     (selectedTimesheet.extractedData as any)?.clientName || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Period</p>
                  <p className="font-medium">
                    {format(new Date(selectedTimesheet.startDate), "dd/MM/yyyy")} - 
                    {format(new Date(selectedTimesheet.endDate), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedTimesheet.status)}>
                    {selectedTimesheet.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Hours</p>
                  <p className="font-medium">{selectedTimesheet.hoursCharged}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Pay Rate</p>
                  <p className="font-medium">£{selectedTimesheet.payRate}/hr</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Gross Pay</p>
                  <p className="font-medium text-lg">£{selectedTimesheet.grossPay}</p>
                </div>
                {selectedTimesheet.shiftDetails && (
                  <div className="col-span-2">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">Details</p>
                    <p className="font-medium">{selectedTimesheet.shiftDetails}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowTimesheetView(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}