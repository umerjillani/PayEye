import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Agency } from "@shared/schema";
import { AgencyForm } from "@/components/forms/agency-form";
import { Building2, Search, Filter, Eye, Edit, Trash2, Plus, Mail, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

export default function AgenciesPage() {
  const { selectedCompany } = useAppContext();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);

  const { data: agencies, isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/agencies", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const createAgencyMutation = useMutation({
    mutationFn: async (agencyData: any) => {
      const response = await apiRequest("POST", "/api/agencies", {
        ...agencyData,
        id: nanoid(),
        companyId: selectedCompany?.id,
      });
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
        title: "Error",
        description: error.message || "Failed to create agency",
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

  const filteredAgencies = agencies?.filter(agency =>
    agency.agencyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.emails?.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<InsertAgency> }) => {
      const res = await apiRequest("PUT", `/api/agencies/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({
        title: "Success",
        description: "Agency updated successfully",
      });
      setShowAgencyModal(false);
      setSelectedAgency(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredAgencies = agencies?.filter(agency =>
    agency.agencyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAddAgency = () => {
    setSelectedAgency(null);
    form.reset({
      id: nanoid(),
      companyId: selectedCompany?.id || "",
      agencyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: 30,
      accountInvoiceRequired: false,
      vatTable: false,
      status: "active",
    });
    setShowAgencyModal(true);
  };

  const handleEditAgency = (agency: Agency) => {
    setSelectedAgency(agency);
    form.reset(agency);
    setShowAgencyModal(true);
  };

  const handleDeleteAgency = (id: string) => {
    if (window.confirm("Are you sure you want to delete this agency?")) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: InsertAgency) => {
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    console.log("Selected company:", selectedCompany);
    
    if (selectedAgency) {
      console.log("Updating existing agency:", selectedAgency.id);
      updateMutation.mutate({ id: selectedAgency.id, updates: data });
    } else {
      const agencyData = { 
        ...data, 
        id: nanoid(), 
        companyId: selectedCompany?.id || "",
        accountInvoiceRequired: false,
        vatTable: false
      };
      console.log("Creating new agency with data:", agencyData);
      createMutation.mutate(agencyData);
    }
  };

  // Add a simple test function
  const testFormSubmit = () => {
    console.log("=== TEST BUTTON CLICKED ===");
    console.log("Form is valid:", form.formState.isValid);
    console.log("Form errors:", form.formState.errors);
    console.log("Form values:", form.getValues());
  };

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
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
            <Button onClick={handleAddAgency}>
              <Plus className="w-4 h-4 mr-2" />
              Add Agency
            </Button>
          </div>

          {/* Agency Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-neutral-800 dark:text-white">
                  {agencies?.length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Agencies
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-success">
                  {agencies?.filter(a => a.status === "active").length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Active
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-primary-500">
                  {agencies?.filter(a => a.vatTable).length || 0}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  VAT Registered
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-secondary-500">
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

          {/* Agencies Table */}
          <Card>
            <CardHeader>
              <CardTitle>Agency List</CardTitle>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agency Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgencies.map((agency) => (
                      <TableRow key={agency.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-100 rounded flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-primary-500" />
                            </div>
                            <div>
                              <div className="font-medium text-neutral-800 dark:text-white">
                                {agency.agencyName}
                              </div>
                              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                                {agency.phone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-600 dark:text-neutral-300">
                            {agency.contactPerson || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-600 dark:text-neutral-300">
                            {agency.email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-600 dark:text-neutral-300">
                            {agency.paymentTerms} days
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={agency.status === "active" ? "default" : "secondary"}>
                            {agency.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agency Modal */}
      <Dialog open={showAgencyModal} onOpenChange={setShowAgencyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAgency ? "Edit Agency" : "Create Agency"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agencyName">Agency Name *</Label>
                <Input
                  id="agencyName"
                  {...form.register("agencyName", { required: "Agency name is required" })}
                  placeholder="Enter agency name"
                />
                {form.formState.errors.agencyName && (
                  <p className="text-sm text-red-500">{form.formState.errors.agencyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  {...form.register("contactPerson")}
                  placeholder="Enter contact person name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                <Input
                  id="paymentTerms"
                  type="number"
                  {...form.register("paymentTerms", { valueAsNumber: true })}
                  placeholder="30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  defaultValue="active"
                  onValueChange={(value) => form.setValue("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...form.register("address")}
                placeholder="Enter full address"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={testFormSubmit}
                className="mr-auto"
              >
                Test Form
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAgencyModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : selectedAgency
                  ? "Update Agency"
                  : "Create Agency"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CompanySelectorModal />
    </div>
  );
}