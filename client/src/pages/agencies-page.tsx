import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { useAppContext } from "@/contexts/app-context";
import { useAuth } from "@/hooks/use-auth";
import { Agency } from "@shared/schema";
import { AgencyForm } from "@/components/forms/agency-form";
import { BulkAgencyUploadModal } from "@/components/modals/bulk-agency-upload-modal";
import { Building2, Search, Eye, Edit, Trash2, Plus, Mail, CreditCard, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

// Agency Table Component
function AgencyTable({ agencies, handleEditAgency, handleDeleteAgency }: {
  agencies: Agency[];
  handleEditAgency: (agency: Agency) => void;
  handleDeleteAgency: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agency Name</TableHead>
          <TableHead>Contact Person</TableHead>
          <TableHead>Emails</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status & Pay Rate</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agencies.map((agency) => (
          <TableRow key={agency.id}>
            <TableCell>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-neutral-800 dark:text-white">
                    {agency.agencyName}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    {agency.codaRef}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {agency.contactPerson || "—"}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {agency.emails && agency.emails.length > 0 ? (
                  agency.emails.map((emailObj, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="text-sm">{typeof emailObj === 'string' ? emailObj : emailObj.email}</span>
                      {(emailObj.isPrimary || index === 0) && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                    </div>
                  ))
                ) : "—"}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {agency.phone || "—"}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    agency.status === "active" 
                      ? "bg-green-500" 
                      : agency.status === "inactive" 
                      ? "bg-red-500" 
                      : "bg-yellow-500"
                  }`} />
                  <span className={`text-xs font-medium capitalize ${
                    agency.status === "active" 
                      ? "text-green-700 dark:text-green-400" 
                      : agency.status === "inactive" 
                      ? "text-red-700 dark:text-red-400" 
                      : "text-yellow-700 dark:text-yellow-400"
                  }`}>
                    {agency.status || "Unknown"}
                  </span>
                </div>
                {agency.payRateType && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {agency.payRateType === "UmbrellaNG" ? (
                      <CreditCard className="h-3 w-3" />
                    ) : (
                      <span className="text-xs">%</span>
                    )}
                    <span>{agency.payRateType}</span>
                    {agency.currency && <span>({agency.currency})</span>}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditAgency(agency)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAgency(agency.id)}
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

export default function AgenciesPage() {
  const { selectedCompany } = useAppContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  const { data: agencies, isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/agencies"],
    enabled: !!user, // Enable for all authenticated users
  });

  const createAgencyMutation = useMutation({
    mutationFn: async (agencyData: any) => {
      const response = await apiRequest("POST", "/api/agencies", {
        ...agencyData,
        id: nanoid(),
        companyId: selectedCompany?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to create agency");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      setShowAgencyModal(false);
      setSelectedAgency(null);
      toast({
        title: "Success",
        description: "Agency created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Please add the required details",
        description: error.message || "Some required information is missing or invalid",
        variant: "destructive",
      });
    },
  });

  const updateAgencyMutation = useMutation({
    mutationFn: async (agencyData: any) => {
      const response = await apiRequest("PUT", `/api/agencies/${selectedAgency?.id}`, agencyData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      setShowAgencyModal(false);
      setSelectedAgency(null);
      toast({
        title: "Success",
        description: "Agency updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update agency",
        variant: "destructive",
      });
    },
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/agencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({
        title: "Success",
        description: "Agency deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete agency",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (data: any) => {
    if (selectedAgency) {
      updateAgencyMutation.mutate(data);
    } else {
      createAgencyMutation.mutate(data);
    }
  };

  const handleEditAgency = (agency: Agency) => {
    setSelectedAgency(agency);
    setShowAgencyModal(true);
  };

  const handleDeleteAgency = (id: string) => {
    if (window.confirm("Are you sure you want to delete this agency?")) {
      deleteAgencyMutation.mutate(id);
    }
  };

  const filteredAgencies = agencies?.filter(agency =>
    agency.agencyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.emails?.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Group agencies by different criteria for tabs
  const activeAgencies = filteredAgencies.filter(a => a.status === "active");
  const inactiveAgencies = filteredAgencies.filter(a => a.status === "inactive");
  const vatRegisteredAgencies = filteredAgencies.filter(a => a.vatTable);
  const umbrellaAgencies = filteredAgencies.filter(a => a.payRateType === "UmbrellaNG");
  const subcontractorAgencies = filteredAgencies.filter(a => a.payRateType === "Sub-Contractor");

  // For now, skip company selection for regular admins
  // if (user?.userType === 'super_admin' && !selectedCompany) {
  //   return <CompanySelectorModal />;
  // }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Agencies"
        description="Manage client agencies and their contact information"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-6">
          {/* Page Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  placeholder="Search agencies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setIsBulkUploadModalOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => setShowAgencyModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Agency
              </Button>
            </div>
          </div>

          {/* Agency Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                  {agencies?.length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Agencies
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-green-600">
                  {agencies?.filter(a => a.status === "active").length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Active
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-blue-600">
                  {agencies?.filter(a => a.vatTable).length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  VAT Registered
                </div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-purple-600">
                  {agencies && agencies.length > 0 
                    ? Math.round(agencies.reduce((sum, a) => sum + (a.paymentTerms || 0), 0) / agencies.length)
                    : 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Avg Payment Terms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agencies Table with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Agencies</CardTitle>
            </CardHeader>
            <CardContent>
              {agenciesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-10 rounded" />
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
                      All ({filteredAgencies.length})
                    </TabsTrigger>
                    <TabsTrigger value="active">
                      Active ({activeAgencies.length})
                    </TabsTrigger>
                    <TabsTrigger value="inactive">
                      Inactive ({inactiveAgencies.length})
                    </TabsTrigger>
                    <TabsTrigger value="vat">
                      VAT Registered ({vatRegisteredAgencies.length})
                    </TabsTrigger>
                    <TabsTrigger value="umbrella">
                      UmbrellaNG ({umbrellaAgencies.length})
                    </TabsTrigger>
                    <TabsTrigger value="subcontractor">
                      Sub-Contractor ({subcontractorAgencies.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="mt-6">
                    <AgencyTable agencies={filteredAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                  
                  <TabsContent value="active" className="mt-6">
                    <AgencyTable agencies={activeAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                  
                  <TabsContent value="inactive" className="mt-6">
                    <AgencyTable agencies={inactiveAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                  
                  <TabsContent value="vat" className="mt-6">
                    <AgencyTable agencies={vatRegisteredAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                  
                  <TabsContent value="umbrella" className="mt-6">
                    <AgencyTable agencies={umbrellaAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                  
                  <TabsContent value="subcontractor" className="mt-6">
                    <AgencyTable agencies={subcontractorAgencies} handleEditAgency={handleEditAgency} handleDeleteAgency={handleDeleteAgency} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agency Modal */}
      <Dialog open={showAgencyModal} onOpenChange={setShowAgencyModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAgency ? "Edit Agency" : "Add New Agency"}
            </DialogTitle>
          </DialogHeader>
          
          <AgencyForm
            agency={selectedAgency}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowAgencyModal(false);
              setSelectedAgency(null);
            }}
            isLoading={createAgencyMutation.isPending || updateAgencyMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Agency Upload Modal */}
      <BulkAgencyUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
      />
    </div>
  );
}