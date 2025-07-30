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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { useAppContext } from "@/contexts/app-context";
import { Agency, InsertAgency } from "@shared/schema";
import { Building2, Search, Filter, Eye, Edit, Trash2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAgencySchema } from "@shared/schema";
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

  const form = useForm<InsertAgency>({
    resolver: zodResolver(insertAgencySchema),
    defaultValues: {
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
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAgency) => {
      const res = await apiRequest("POST", "/api/agencies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({
        title: "Success",
        description: "Agency created successfully",
      });
      setShowAgencyModal(false);
      form.reset();
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
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    if (selectedAgency) {
      updateMutation.mutate({ id: selectedAgency.id, updates: data });
    } else {
      const agencyData = { ...data, id: nanoid(), companyId: selectedCompany?.id || "" };
      console.log("Creating agency with data:", agencyData);
      createMutation.mutate(agencyData);
    }
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
                  {agencies?.reduce((sum, a) => sum + (a.paymentTerms || 0), 0) / (agencies?.length || 1) || 0}
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAgency ? "Edit Agency" : "Create Agency"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="details">Agency Details</TabsTrigger>
                <TabsTrigger value="workers">Worker Profiles</TabsTrigger>
                <TabsTrigger value="notes">Notes & Audit</TabsTrigger>
                <TabsTrigger value="communication">Communication Settings</TabsTrigger>
                <TabsTrigger value="general">General Settings</TabsTrigger>
                <TabsTrigger value="paymodel">Pay Model Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Building2 className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Agency Details</h3>
                  </div>
                  
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
                </div>
              </TabsContent>

              <TabsContent value="workers" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">Worker Profiles</h3>
                  <p className="text-gray-600 mt-2">Configure worker profile settings and templates</p>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">Notes & Audit</h3>
                  <p className="text-gray-600 mt-2">Manage agency notes and audit information</p>
                </div>
              </TabsContent>

              <TabsContent value="communication" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">Communication Settings</h3>
                  <p className="text-gray-600 mt-2">Configure communication preferences and templates</p>
                </div>
              </TabsContent>

              <TabsContent value="general" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">General Settings</h3>
                  <p className="text-gray-600 mt-2">Manage general agency configuration</p>
                </div>
              </TabsContent>

              <TabsContent value="paymodel" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">Pay Model Settings</h3>
                  <p className="text-gray-600 mt-2">Configure pay models and calculation settings</p>
                </div>
              </TabsContent>

              <TabsContent value="portal" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium">Agency Portal Users</h3>
                  <p className="text-gray-600 mt-2">Manage portal access and user permissions</p>
                </div>
              </TabsContent>

              <div className="flex justify-end space-x-4 pt-6 border-t">
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
            </Tabs>
          </form>
        </DialogContent>
      </Dialog>

      <CompanySelectorModal />
    </div>
  );
}
