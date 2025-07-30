import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { TimesheetUploadModal } from "@/components/modals/timesheet-upload-modal";
import { TimesheetEditModal } from "@/components/modals/timesheet-edit-modal";
import { EmployeeModal } from "@/components/modals/employee-modal";
import { useAppContext } from "@/contexts/app-context";
import { useAuth } from "@/hooks/use-auth";
import { Timesheet, Candidate, Agency, Company } from "@shared/schema";
import { Clock, Search, Edit, Check, X, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TimesheetsPage() {
  const { selectedCompany, setSelectedCompany, setShowTimesheetUploadModal } = useAppContext();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [prefilledEmployeeData, setPrefilledEmployeeData] = useState<any>(null);
  const [timesheetForNewEmployee, setTimesheetForNewEmployee] = useState<Timesheet | null>(null);

  // Get user's company and auto-select it
  const { data: userCompany } = useQuery<Company | null>({
    queryKey: ["/api/user/company"],
    queryFn: async () => {
      // If user has a company ID, load that specific company
      if (user && 'companyId' in user && user.companyId) {
        const response = await fetch("/api/companies");
        if (!response.ok) return null;
        const companies = await response.json();
        return companies.length > 0 ? companies[0] : null;
      }
      return null;
    },
    enabled: !!user,
  });

  // Auto-select user's company when it loads
  useEffect(() => {
    if (!selectedCompany && userCompany) {
      console.log("Auto-selecting user's company:", userCompany);
      setSelectedCompany(userCompany);
    }
  }, [userCompany, selectedCompany, setSelectedCompany]);

  const { data: timesheets, isLoading: timesheetsLoading, error: timesheetsError } = useQuery<Timesheet[]>({
    queryKey: ["/api/timesheets", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
    refetchOnWindowFocus: true,
    staleTime: 0, // Force refetch on mount
  });

  // Debug logging
  console.log("Timesheets page debug:", {
    user: user,
    userCompanyId: user && 'companyId' in user ? user.companyId : undefined,
    selectedCompany: selectedCompany,
    selectedCompanyId: selectedCompany?.id,
    timesheetsLoading,
    timesheetsCount: timesheets?.length || 0,
    timesheetsError,
    timesheets: timesheets?.map(t => ({ id: t.id, candidateId: t.candidateId, status: t.status })) || []
  });

  const { data: candidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["/api/agencies", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const updateTimesheetMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/timesheets/${data.id}`, { status: data.status });
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", selectedCompany?.id] });
      
      // If timesheet was approved, also refresh invoices
      if (variables.status === "approved") {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices", selectedCompany?.id] });
      }
      
      toast({
        title: "Success",
        description: variables.status === "approved" 
          ? "Timesheet approved and invoice created successfully" 
          : "Timesheet status updated successfully",
        className: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    },
  });

  const editTimesheetMutation = useMutation({
    mutationFn: async (data: Partial<Timesheet> & { id: string }) => {
      const res = await apiRequest("PUT", `/api/timesheets/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", selectedCompany?.id] });
      setShowEditModal(false);
      setEditingTimesheet(null);
      toast({
        title: "Success",
        description: "Timesheet updated successfully",
        className: "border-primary bg-primary/10 text-primary",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    },
  });

  const linkTimesheetToEmployeeMutation = useMutation({
    mutationFn: async (data: { timesheetId: string; candidateId: string }) => {
      const res = await apiRequest("PUT", `/api/timesheets/${data.timesheetId}`, { candidateId: data.candidateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({
        title: "Success",
        description: "Timesheet linked to employee successfully",
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    },
  });

  const getEmployeeName = (candidateId: string | null, timesheet?: Timesheet) => {
    if (!candidateId) {
      // If no candidateId, check if we have extracted employee name from OCR
      if (timesheet?.extractedData && typeof timesheet.extractedData === 'object') {
        const extractedData = timesheet.extractedData as any;
        const extractedName = extractedData.employeeName || 
                           extractedData["Person Name"] || 
                           extractedData.employee_name || 
                           extractedData.candidate_name || 
                           extractedData.worker_name || 
                           extractedData.name;
        if (extractedName) return extractedName;
      }
      return "Unknown Employee";
    }
    const employee = candidates?.find(c => c.id === candidateId);
    if (employee) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    
    // If employee not found in database, check extracted data from OCR
    if (timesheet?.extractedData && typeof timesheet.extractedData === 'object') {
      const extractedData = timesheet.extractedData as any;
      const extractedName = extractedData.employeeName || 
                           extractedData["Person Name"] || 
                           extractedData.employee_name || 
                           extractedData.candidate_name || 
                           extractedData.worker_name || 
                           extractedData.name;
      if (extractedName) return extractedName;
    }
    
    return "Unknown Employee";
  };

  const getEmployeeStatus = (candidateId: string | null, timesheet?: Timesheet) => {
    if (!candidateId) {
      // Check if we have extracted employee name from OCR
      if (timesheet?.extractedData && typeof timesheet.extractedData === 'object') {
        const extractedData = timesheet.extractedData as any;
        const extractedName = extractedData.employee_name || extractedData.candidate_name || extractedData.worker_name || extractedData.name;
        if (extractedName) return "not_in_database";
      }
      return "unknown";
    }
    const employee = candidates?.find(c => c.id === candidateId);
    return employee ? "in_database" : "not_in_database";
  };

  const getExtractedEmployeeData = (timesheet: Timesheet) => {
    console.log("getExtractedEmployeeData called with timesheet:", timesheet);
    if (timesheet?.extractedData && typeof timesheet.extractedData === 'object') {
      const extractedData = timesheet.extractedData as any;
      console.log("Extracted data from timesheet:", extractedData);
      
      const result = {
        firstName: extractedData.employee_name?.split(' ')[0] || '',
        lastName: extractedData.employee_name?.split(' ').slice(1).join(' ') || '',
        payRate: extractedData.hourly_rate || extractedData.rate || extractedData.pay_rate || '',
        // Add more fields as needed
      };
      console.log("Processed extracted data result:", result);
      return result;
    }
    console.log("No extracted data found");
    return null;
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return "No Agency";
    return agencies?.find(agency => agency.id === agencyId)?.agencyName || "Unknown Agency";
  };

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

  const filteredTimesheets = timesheets?.filter(timesheet => {
    const employeeName = getEmployeeName(timesheet.candidateId || "", timesheet);
    const agencyName = getAgencyName(timesheet.agencyId || "");
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agencyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || timesheet.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleApproveTimesheet = (id: string) => {
    updateTimesheetMutation.mutate({ id, status: "approved" });
  };

  const handleRejectTimesheet = (id: string) => {
    updateTimesheetMutation.mutate({ id, status: "rejected" });
  };

  const pendingTimesheets = filteredTimesheets.filter(t => t.status === "pending");
  const approvedTimesheets = filteredTimesheets.filter(t => t.status === "approved");
  const rejectedTimesheets = filteredTimesheets.filter(t => t.status === "rejected");
  
  // New filters based on database status
  const inDatabaseTimesheets = filteredTimesheets.filter(t => {
    const employee = candidates?.find(c => c.id === t.candidateId);
    return !!employee; // Employee exists in database
  });
  
  const notInDatabaseTimesheets = filteredTimesheets.filter(t => {
    const employee = candidates?.find(c => c.id === t.candidateId);
    // Check if employee is not in database but we have extracted employee data from OCR
    const hasExtractedEmployeeData = t.extractedData && typeof t.extractedData === 'object' && 
      (t.extractedData as any).employee_name || (t.extractedData as any).candidate_name || (t.extractedData as any).worker_name || (t.extractedData as any).name;
    return !employee || (!t.candidateId && hasExtractedEmployeeData);
  });

  const TimesheetTable = ({ timesheets: tableTimesheets }: { timesheets: Timesheet[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Agency</TableHead>
          <TableHead>Employee Status</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Gross Pay</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableTimesheets.map((timesheet) => (
          <TableRow key={timesheet.id}>
            <TableCell>
              <div className="font-medium text-neutral-800 dark:text-white">
                {getEmployeeName(timesheet.candidateId, timesheet)}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {getAgencyName(timesheet.agencyId)}
              </div>
            </TableCell>
            <TableCell>
              {(() => {
                const status = getEmployeeStatus(timesheet.candidateId, timesheet);
                if (status === "in_database") {
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">
                        In Database
                      </span>
                    </div>
                  );
                } else if (status === "not_in_database") {
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Not in Database
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log("Add Employee button clicked for timesheet:", timesheet);
                          const extractedData = getExtractedEmployeeData(timesheet);
                          console.log("Extracted employee data:", extractedData);
                          if (extractedData) {
                            // Open employee modal with pre-filled data
                            console.log("Opening employee modal with prefilled data");
                            setShowEmployeeModal(true);
                            setPrefilledEmployeeData(extractedData);
                            setTimesheetForNewEmployee(timesheet);
                          } else {
                            console.log("No extracted data found");
                          }
                        }}
                        className="h-6 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                      >
                        Add Employee
                      </Button>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Unknown
                      </span>
                    </div>
                  );
                }
              })()}
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {format(new Date(timesheet.startDate), "dd MMM")} - {format(new Date(timesheet.endDate), "dd MMM yyyy")}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {timesheet.hoursCharged}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                £{parseFloat(timesheet.grossPay || "0").toFixed(2)}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  (timesheet.status || "pending") === "approved" 
                    ? "bg-green-500" 
                    : (timesheet.status || "pending") === "rejected" 
                    ? "bg-red-500" 
                    : "bg-yellow-500"
                }`} />
                <span className={`text-xs font-medium capitalize ${
                  (timesheet.status || "pending") === "approved" 
                    ? "text-green-700 dark:text-green-400" 
                    : (timesheet.status || "pending") === "rejected" 
                    ? "text-red-700 dark:text-red-400" 
                    : "text-yellow-700 dark:text-yellow-400"
                }`}>
                  {timesheet.status || "pending"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                {timesheet.status === "pending" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleApproveTimesheet(timesheet.id)}
                      disabled={updateTimesheetMutation.isPending}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRejectTimesheet(timesheet.id)}
                      disabled={updateTimesheetMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setEditingTimesheet(timesheet);
                    setShowEditModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Timesheets"
        description="Process and approve employee timesheets"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-6">
          {/* Page Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  placeholder="Search timesheets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            </div>
            <Button onClick={() => setShowTimesheetUploadModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Timesheet
            </Button>
          </div>

          {/* Timesheet Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                  {timesheets?.length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Timesheets
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-warning">
                  {pendingTimesheets.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Pending Review
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-success">
                  {approvedTimesheets.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Approved
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-primary-500">
                  £{timesheets?.reduce((sum, t) => sum + parseFloat(t.grossPay || "0"), 0).toLocaleString() || "0"}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Value
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timesheets */}
          <Card>
            <CardHeader>
              <CardTitle>Timesheets</CardTitle>
            </CardHeader>
            <CardContent>
              {timesheetsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <Tabs defaultValue="pending" className="w-full">
                  <TabsList>
                    <TabsTrigger value="pending">
                      Pending ({pendingTimesheets.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved">
                      Approved ({approvedTimesheets.length})
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                      Rejected ({rejectedTimesheets.length})
                    </TabsTrigger>
                    <TabsTrigger value="in-database">
                      In Database ({inDatabaseTimesheets.length})
                    </TabsTrigger>
                    <TabsTrigger value="not-in-database">
                      Not in Database ({notInDatabaseTimesheets.length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      All ({filteredTimesheets.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pending" className="mt-6">
                    <TimesheetTable timesheets={pendingTimesheets} />
                  </TabsContent>
                  
                  <TabsContent value="approved" className="mt-6">
                    <TimesheetTable timesheets={approvedTimesheets} />
                  </TabsContent>
                  
                  <TabsContent value="rejected" className="mt-6">
                    <TimesheetTable timesheets={rejectedTimesheets} />
                  </TabsContent>
                  
                  <TabsContent value="in-database" className="mt-6">
                    <TimesheetTable timesheets={inDatabaseTimesheets} />
                  </TabsContent>
                  
                  <TabsContent value="not-in-database" className="mt-6">
                    <TimesheetTable timesheets={notInDatabaseTimesheets} />
                  </TabsContent>
                  
                  <TabsContent value="all" className="mt-6">
                    <TimesheetTable timesheets={filteredTimesheets} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CompanySelectorModal />
      <TimesheetUploadModal />
      <TimesheetEditModal
        timesheet={editingTimesheet}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTimesheet(null);
        }}
        onSave={(data) => {
          if (editingTimesheet) {
            editTimesheetMutation.mutate({ ...data, id: editingTimesheet.id });
          }
        }}
        candidates={candidates || []}
        agencies={agencies || []}
        isLoading={editTimesheetMutation.isPending}
        onCreateEmployee={() => {
          // Extract employee data from the timesheet
          if (editingTimesheet?.extractedData) {
            const extractedData = editingTimesheet.extractedData as any;
            const employeeName = extractedData.employeeName || 
                               extractedData["Person Name"] || 
                               extractedData.employee_name || 
                               "Unknown Employee";
            
            setPrefilledEmployeeData({
              firstName: employeeName.split(' ')[0] || '',
              lastName: employeeName.split(' ').slice(1).join(' ') || '',
              payRate: editingTimesheet.payRate || '',
              hoursWorked: editingTimesheet.hoursCharged || '',
              totalPay: editingTimesheet.grossPay || '',
              clientName: extractedData.Agency || extractedData.clientName || ''
            });
            setTimesheetForNewEmployee(editingTimesheet);
            setShowEmployeeModal(true);
            setShowEditModal(false);
          }
        }}
      />
      <EmployeeModal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setPrefilledEmployeeData(null);
        }}
        prefilledData={prefilledEmployeeData}
        onSave={(createdEmployee) => {
          setShowEmployeeModal(false);
          setPrefilledEmployeeData(null);
          
          // If a timesheet triggered this employee creation, link them together
          if (timesheetForNewEmployee && createdEmployee) {
            console.log("Linking timesheet", timesheetForNewEmployee.id, "to employee", createdEmployee.id);
            linkTimesheetToEmployeeMutation.mutate({
              timesheetId: timesheetForNewEmployee.id,
              candidateId: createdEmployee.id
            });
          }
          
          setTimesheetForNewEmployee(null);
          // Refresh data to show new employee and update timesheet status
          queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
          queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
        }}
      />
    </div>
  );
}
