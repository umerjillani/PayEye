import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { EmployeeModal } from "@/components/modals/employee-modal";
import { BulkEmployeeUploadModal } from "@/components/modals/bulk-employee-upload-modal";
import { useAppContext } from "@/contexts/app-context";
import { useAuth } from "@/hooks/use-auth";
import { Candidate, Agency } from "@shared/schema";
import { UserPlus, Search, Eye, Edit, Trash2, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface EmployeeTableProps {
  employees: Candidate[];
  handleEditEmployee?: (employee: Candidate) => void;
  handleDeleteEmployee?: (employee: Candidate) => void;
  getAgencyName?: (agencyId: string) => string;
  getEmployeeInitials?: (employee: Candidate) => string;
  getStatusBadgeVariant?: (status: string) => string;
  deleteMutation?: any;
}

function EmployeeTable({ 
  employees, 
  handleEditEmployee, 
  handleDeleteEmployee,
  getAgencyName,
  getEmployeeInitials,
  getStatusBadgeVariant,
  deleteMutation
}: EmployeeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Agency</TableHead>
          <TableHead>Employment Type</TableHead>
          <TableHead>Pay Rate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback className="bg-primary-100 text-primary-700">
                    {getEmployeeInitials?.(employee)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-neutral-800 dark:text-white">
                    {employee.firstName} {employee.lastName}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    {employee.email}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {employee.agencyIds && employee.agencyIds.length > 0 
                  ? employee.agencyIds.map(agencyId => getAgencyName?.(agencyId)).filter(Boolean).join(", ")
                  : "No agencies"
                }
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{employee.employmentType}</Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                £{employee.payRate}/hour
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  (employee.status || "active") === "active" 
                    ? "bg-green-500" 
                    : (employee.status || "active") === "inactive" 
                    ? "bg-red-500" 
                    : "bg-yellow-500"
                }`} />
                <span className={`text-xs font-medium capitalize ${
                  (employee.status || "active") === "active" 
                    ? "text-green-700 dark:text-green-400" 
                    : (employee.status || "active") === "inactive" 
                    ? "text-red-700 dark:text-red-400" 
                    : "text-yellow-700 dark:text-yellow-400"
                }`}>
                  {employee.status || "active"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditEmployee?.(employee)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDeleteEmployee?.(employee)}
                  disabled={deleteMutation?.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function EmployeesPage() {
  const { selectedCompany, setShowEmployeeModal } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<Candidate | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Candidate | null>(null);
  const { toast } = useToast();

  const { data: employees, isLoading: employeesLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    enabled: !!user, // Enable for all authenticated users
  });

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["/api/agencies"],
    enabled: !!user, // Enable for all authenticated users
  });

  const deleteMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await apiRequest("DELETE", `/api/candidates/${employeeId}`);
    },
    onSuccess: async () => {
      // Force refetch instead of just invalidating
      await queryClient.refetchQueries({ queryKey: ["/api/candidates", selectedCompany?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getAgencyName = (agencyId: string) => {
    return agencies?.find(agency => agency.id === agencyId)?.agencyName || "Unknown Agency";
  };

  const getEmployeeInitials = (employee: Candidate) => {
    return `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      default:
        return "outline";
    }
  };



  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (employee: Candidate) => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = (employee: Candidate) => {
    setEmployeeToDelete(employee);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (employeeToDelete) {
      deleteMutation.mutate(employeeToDelete.id);
      setDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
    }
  };

  // Filter employees based on search term and employment type
  const filteredEmployees = employees?.filter(employee => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
    const email = (employee.email || "").toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         email.includes(searchTerm.toLowerCase());
    const matchesEmploymentType = employmentTypeFilter === "all" || employee.employmentType === employmentTypeFilter;
    return matchesSearch && matchesEmploymentType;
  }) || [];

  // Group employees by employment type for tabs
  const subcontractorEmployees = filteredEmployees.filter(e => e.employmentType === "subcontractor");
  const umbrellaNgEmployees = filteredEmployees.filter(e => e.employmentType === "umbrellaNg");
  const activeEmployees = filteredEmployees.filter(e => e.status === "active");
  const inactiveEmployees = filteredEmployees.filter(e => e.status === "inactive");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Employees"
        description="Manage employee records and employment details"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-6">
          {/* Page Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setShowBulkUploadModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={handleAddEmployee}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </div>
          </div>

          {/* Employee Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                  {filteredEmployees.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Employees
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-success">
                  {activeEmployees.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Active
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-primary-500">
                  {subcontractorEmployees.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Subcontractor
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-secondary-500">
                  {umbrellaNgEmployees.length}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  UmbrellaNG
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employees */}
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Tabs defaultValue="all" className="w-full">
                  <TabsList>
                    <TabsTrigger value="all">
                      All ({filteredEmployees.length})
                    </TabsTrigger>
                    <TabsTrigger value="subcontractor">
                      Subcontractor ({subcontractorEmployees.length})
                    </TabsTrigger>
                    <TabsTrigger value="umbrellaNg">
                      UmbrellaNG ({umbrellaNgEmployees.length})
                    </TabsTrigger>
                    <TabsTrigger value="active">
                      Active ({activeEmployees.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="mt-6">
                    <EmployeeTable 
                      employees={filteredEmployees}
                      handleEditEmployee={handleEditEmployee}
                      handleDeleteEmployee={handleDeleteEmployee}
                      getAgencyName={getAgencyName}
                      getEmployeeInitials={getEmployeeInitials}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      deleteMutation={deleteMutation}
                    />
                  </TabsContent>
                  
                  <TabsContent value="subcontractor" className="mt-6">
                    <EmployeeTable 
                      employees={subcontractorEmployees}
                      handleEditEmployee={handleEditEmployee}
                      handleDeleteEmployee={handleDeleteEmployee}
                      getAgencyName={getAgencyName}
                      getEmployeeInitials={getEmployeeInitials}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      deleteMutation={deleteMutation}
                    />
                  </TabsContent>
                  
                  <TabsContent value="umbrellaNg" className="mt-6">
                    <EmployeeTable 
                      employees={umbrellaNgEmployees}
                      handleEditEmployee={handleEditEmployee}
                      handleDeleteEmployee={handleDeleteEmployee}
                      getAgencyName={getAgencyName}
                      getEmployeeInitials={getEmployeeInitials}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      deleteMutation={deleteMutation}
                    />
                  </TabsContent>
                  
                  <TabsContent value="active" className="mt-6">
                    <EmployeeTable 
                      employees={activeEmployees}
                      handleEditEmployee={handleEditEmployee}
                      handleDeleteEmployee={handleDeleteEmployee}
                      getAgencyName={getAgencyName}
                      getEmployeeInitials={getEmployeeInitials}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      deleteMutation={deleteMutation}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Components */}
        <EmployeeModal employee={selectedEmployee} />
        
        {showBulkUploadModal && (
          <BulkEmployeeUploadModal
            isOpen={showBulkUploadModal}
            onClose={() => setShowBulkUploadModal(false)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Employee Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{employeeToDelete?.firstName} {employeeToDelete?.lastName}</strong>? 
                This action cannot be undone and will permanently remove the employee from the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteConfirmOpen(false);
                setEmployeeToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Employee
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
