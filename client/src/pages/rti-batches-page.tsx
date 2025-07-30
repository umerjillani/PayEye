import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, FileText, Plus, RefreshCw, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PayrollBatch, Candidate } from "@shared/schema";

export default function RTIBatchesPage() {
  const { toast } = useToast();
  const [newBatchDialog, setNewBatchDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);

  // Get current company from URL or context
  const companyId = "company_1"; // This should come from auth context

  const { data: batches, isLoading } = useQuery<PayrollBatch[]>({
    queryKey: ["/api/payroll/batches", companyId],
    queryFn: () => fetch(`/api/payroll/batches?companyId=${companyId}`).then(res => res.json()),
  });

  const { data: candidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", companyId],
  });

  const createBatchMutation = useMutation({
    mutationFn: async (batchData: any) => {
      const res = await apiRequest("POST", "/api/payroll/batch", batchData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/batches", companyId] });
      setNewBatchDialog(false);
      toast({
        title: "Batch Created",
        description: "Payroll batch created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create batch",
        variant: "destructive",
      });
    },
  });

  const processBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest("POST", `/api/payroll/batch/${batchId}/process`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/batches", companyId] });
      toast({
        title: "Batch Processed",
        description: "RTI data retrieved and tax calculations completed",
      });
    },
    onError: () => {
      toast({
        title: "Processing Failed",
        description: "Failed to process batch",
        variant: "destructive",
      });
    },
  });

  const fetchRTIDataMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await apiRequest("POST", `/api/candidates/${candidateId}/rti-fetch`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "RTI Data Retrieved",
        description: "Employment information retrieved from HMRC",
      });
    },
    onError: () => {
      toast({
        title: "RTI Fetch Failed",
        description: "Failed to retrieve RTI data from HMRC",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "processing": return "bg-yellow-100 text-yellow-800";
      case "processed": return "bg-blue-100 text-blue-800";
      case "submitted": return "bg-green-100 text-green-800";
      case "error": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCurrentTaxWeek = () => {
    const now = new Date();
    const taxYearStart = new Date(now.getFullYear(), 3, 6); // April 6th
    if (now < taxYearStart) {
      taxYearStart.setFullYear(now.getFullYear() - 1);
    }
    const diffTime = now.getTime() - taxYearStart.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.min(Math.max(diffWeeks, 1), 52);
  };

  const getCurrentTaxYear = () => {
    const now = new Date();
    const taxYearStart = new Date(now.getFullYear(), 3, 6);
    if (now < taxYearStart) {
      return `${now.getFullYear() - 1}-${now.getFullYear()}`;
    }
    return `${now.getFullYear()}-${now.getFullYear() + 1}`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading batches...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RTI Payroll Batches</h1>
          <p className="text-gray-600">Manage HMRC Real-Time Information submissions and payroll processing</p>
        </div>
        <Dialog open={newBatchDialog} onOpenChange={setNewBatchDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Payroll Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createBatchMutation.mutate({
                companyId,
                batchName: formData.get("batchName"),
                taxWeek: parseInt(formData.get("taxWeek") as string),
                taxYear: formData.get("taxYear"),
                dateFrom: formData.get("dateFrom"),
                dateTo: formData.get("dateTo"),
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="batchName">Batch Name</Label>
                <Input 
                  id="batchName" 
                  name="batchName" 
                  placeholder="Week ending 15/11/2024"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxWeek">Tax Week</Label>
                  <Input 
                    id="taxWeek" 
                    name="taxWeek" 
                    type="number" 
                    defaultValue={getCurrentTaxWeek()}
                    min="1" 
                    max="52" 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="taxYear">Tax Year</Label>
                  <Input 
                    id="taxYear" 
                    name="taxYear" 
                    defaultValue={getCurrentTaxYear()}
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Period From</Label>
                  <Input 
                    id="dateFrom" 
                    name="dateFrom" 
                    type="date" 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo">Period To</Label>
                  <Input 
                    id="dateTo" 
                    name="dateTo" 
                    type="date" 
                    required 
                  />
                </div>
              </div>
              <Button type="submit" disabled={createBatchMutation.isPending} className="w-full">
                {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {batches?.map((batch) => (
          <Card key={batch.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {batch.batchName}
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Tax Week {batch.taxWeek} • {batch.taxYear} • {batch.totalEmployees || 0} employees
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {batch.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => processBatchMutation.mutate(batch.id)}
                      disabled={processBatchMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Process RTI
                    </Button>
                  )}
                  {batch.status === "processed" && (
                    <Button variant="outline" size="sm">
                      <Send className="w-4 h-4 mr-1" />
                      Submit to HMRC
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Period</p>
                  <p className="text-gray-600">{batch.dateFrom} to {batch.dateTo}</p>
                </div>
                <div>
                  <p className="font-medium">Gross Pay</p>
                  <p className="text-gray-600">£{batch.totalGrossPay || "0.00"}</p>
                </div>
                <div>
                  <p className="font-medium">Tax Deducted</p>
                  <p className="text-gray-600">£{batch.totalTax || "0.00"}</p>
                </div>
                <div>
                  <p className="font-medium">NI Deducted</p>
                  <p className="text-gray-600">£{batch.totalNI || "0.00"}</p>
                </div>
              </div>
              {batch.processedAt && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  Processed: {new Date(batch.processedAt).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {(!batches || batches.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll batches</h3>
              <p className="text-gray-600 text-center mb-4">
                Create your first payroll batch to start processing RTI submissions
              </p>
              <Button onClick={() => setNewBatchDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Batch
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RTI Data Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>HMRC RTI Data Management</CardTitle>
          <CardDescription>
            Retrieve employment information and tax codes from HMRC Real-Time Information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4">
              {candidates?.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{candidate.firstName} {candidate.lastName}</p>
                    <p className="text-sm text-gray-600">
                      NINO: {candidate.nino || "Not provided"} • 
                      Tax Code: {candidate.taxCode || "Unknown"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRTIDataMutation.mutate(candidate.id)}
                    disabled={!candidate.nino || fetchRTIDataMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Fetch RTI
                  </Button>
                </div>
              ))}
            </div>
            {(!candidates || candidates.length === 0) && (
              <p className="text-gray-600 text-center py-4">
                No employees available. Add employees with NINO numbers to fetch RTI data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}