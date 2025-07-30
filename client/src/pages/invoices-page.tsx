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
import { Agency, Timesheet, Candidate } from "@shared/schema";
import { Search, ArrowLeft, Building2, Clock, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function InvoicesPage() {
  const { selectedCompany } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [showAgencyTimesheets, setShowAgencyTimesheets] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [showTimesheetView, setShowTimesheetView] = useState(false);

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["/api/agencies", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: timesheets } = useQuery<Timesheet[]>({
    queryKey: ["/api/timesheets", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: candidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const getEmployeeName = (candidateId: string) => {
    const candidate = candidates?.find(c => c.id === candidateId);
    return candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown Employee";
  };

  // Get approved timesheets for a specific agency (including employees with multiple agencies)
  const getAgencyTimesheets = (agencyId: string) => {
    if (!timesheets || !candidates || !agencies) return [];
    
    // For virtual agencies (extracted from timesheets)
    if (agencyId.startsWith('extracted-')) {
      const extractedAgencyName = agencyId.replace('extracted-', '').replace(/-/g, ' ');
      return timesheets.filter(timesheet => {
        if (timesheet.status !== 'approved') return false;
        const timesheetAgencyName = (timesheet.extractedData as any)?.Agency || 
                                   (timesheet.extractedData as any)?.agency || '';
        return timesheetAgencyName.toLowerCase().trim() === extractedAgencyName.toLowerCase().trim();
      });
    }
    
    const agency = agencies.find(a => a.id === agencyId);
    if (!agency) return [];
    
    return timesheets.filter(timesheet => {
      // Only include approved timesheets
      if (timesheet.status !== 'approved') return false;
      
      // Method 1: Direct agency assignment
      if (timesheet.agencyId === agencyId) {
        return true;
      }
      
      // Method 2: Employee belongs to multiple agencies including this one
      if (timesheet.candidateId) {
        const employee = candidates.find(c => c.id === timesheet.candidateId);
        if (employee?.agencyIds?.includes(agencyId)) {
          return true;
        }
      }
      
      // Method 3: Match by extracted agency name (for timesheets without direct agency assignment)
      if (timesheet.extractedData && typeof timesheet.extractedData === 'object') {
        const extractedAgencyName = (timesheet.extractedData as any)?.Agency || 
                                   (timesheet.extractedData as any)?.agency ||
                                   (timesheet.extractedData as any)?.agencyName;
        
        if (extractedAgencyName) {
          // Check if extracted agency name matches this agency
          const normalizedExtracted = extractedAgencyName.toLowerCase().trim();
          const normalizedAgency = agency.agencyName.toLowerCase().trim();
          
          // Exact match only for real agencies
          if (normalizedExtracted === normalizedAgency) {
            return true;
          }
        }
      }
      
      return false;
    });
  };

  // Group agencies with their approved timesheet counts and totals
  const getAgencyInvoiceData = () => {
    if (!agencies || !timesheets) return [];
    
    const agencyData = agencies.map(agency => {
      const agencyTimesheets = getAgencyTimesheets(agency.id); // Already filtered to approved only
      const totalAmount = agencyTimesheets.reduce((sum, ts) => sum + parseFloat(ts.grossPay || '0'), 0);
      const timesheetCount = agencyTimesheets.length;
      const approvedCount = agencyTimesheets.length; // All are approved
      
      return {
        agency,
        timesheets: agencyTimesheets,
        totalAmount,
        timesheetCount,
        approvedCount
      };
    }).filter(data => data.timesheetCount > 0); // Only show agencies with approved timesheets
    
    // Also handle timesheets with extracted agency names that don't match existing agencies
    const processedTimesheetIds = new Set();
    agencyData.forEach(data => {
      data.timesheets.forEach(ts => processedTimesheetIds.add(ts.id));
    });
    
    // Find unprocessed approved timesheets with agency names in extracted data
    const unprocessedTimesheets = timesheets.filter(ts => 
      ts.status === 'approved' && 
      !processedTimesheetIds.has(ts.id) &&
      ts.extractedData &&
      ((ts.extractedData as any)?.Agency || (ts.extractedData as any)?.agency)
    );
    
    // Group unprocessed timesheets by extracted agency name
    const extractedAgencyGroups: { [key: string]: Timesheet[] } = {};
    unprocessedTimesheets.forEach(ts => {
      const agencyName = (ts.extractedData as any)?.Agency || (ts.extractedData as any)?.agency;
      if (agencyName) {
        if (!extractedAgencyGroups[agencyName]) {
          extractedAgencyGroups[agencyName] = [];
        }
        extractedAgencyGroups[agencyName].push(ts);
      }
    });
    
    // Add extracted agency groups as virtual agencies
    Object.entries(extractedAgencyGroups).forEach(([agencyName, timesheets]) => {
      const totalAmount = timesheets.reduce((sum, ts) => sum + parseFloat(ts.grossPay || '0'), 0);
      agencyData.push({
        agency: {
          id: `extracted-${agencyName.replace(/\s+/g, '-').toLowerCase()}`,
          agencyName: agencyName,
          contactEmail: '',
          paymentTerms: '',
          bankDetails: null,
          currencies: [],
          payRateTypes: [],
          companyId: selectedCompany?.id || '',
          organizationId: null,
          createdAt: new Date(),
        } as Agency,
        timesheets: timesheets,
        totalAmount,
        timesheetCount: timesheets.length,
        approvedCount: timesheets.length
      });
    });
    
    return agencyData;
  };

  const handleAgencyClick = (agency: Agency) => {
    setSelectedAgency(agency);
    setShowAgencyTimesheets(true);
  };

  const handleBackToAgencies = () => {
    setSelectedAgency(null);
    setShowAgencyTimesheets(false);
  };

  const handleViewTimesheet = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setShowTimesheetView(true);
  };

  const handleCloseTimesheetView = () => {
    setSelectedTimesheet(null);
    setShowTimesheetView(false);
  };

  const agencyInvoiceData = getAgencyInvoiceData();
  const filteredAgencyData = agencyInvoiceData.filter(data =>
    data.agency.agencyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agency list view component
  const AgencyListView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agencies with Approved Timesheets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency Name</TableHead>
                <TableHead>Approved Timesheets</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgencyData.map((data) => (
                <TableRow key={data.agency.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => handleAgencyClick(data.agency)}>
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{data.agency.agencyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {data.agency.contactEmail || 'No email'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleAgencyClick(data.agency)}>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      {data.approvedCount} approved
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => handleAgencyClick(data.agency)}>
                    <div className="font-semibold">£{data.totalAmount.toFixed(2)}</div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAgencyClick(data.agency)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAgencyData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No agencies with approved timesheets found</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'Approve some timesheets to generate invoices.'}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // Agency timesheet detail view component  
  const AgencyTimesheetView = () => {
    if (!selectedAgency) return null;
    
    const agencyTimesheets = getAgencyTimesheets(selectedAgency.id);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToAgencies}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Agencies</span>
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedAgency.agencyName}</h2>
            <p className="text-muted-foreground">
              {agencyTimesheets.length > 0 
                ? `${agencyTimesheets.length} approved timesheet${agencyTimesheets.length !== 1 ? 's' : ''} ready for invoicing`
                : 'No approved timesheets found'
              }
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Approved Timesheets</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyTimesheets.length > 0 ? (
                  agencyTimesheets.map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell className="font-medium">
                        {timesheet.candidateId 
                          ? getEmployeeName(timesheet.candidateId)
                          : (timesheet.extractedData as any)?.employeeName || 
                            (timesheet.extractedData as any)?.["Person Name"] || 
                            "Unknown Employee"
                        }
                      </TableCell>
                      <TableCell>
                        {timesheet.startDate && format(new Date(timesheet.startDate), "dd/MM/yyyy")}
                        {timesheet.endDate && timesheet.startDate !== timesheet.endDate && 
                          ` - ${format(new Date(timesheet.endDate), "dd/MM/yyyy")}`
                        }
                      </TableCell>
                      <TableCell>{timesheet.hoursCharged}</TableCell>
                      <TableCell>£{parseFloat(timesheet.payRate || '0').toFixed(2)}</TableCell>
                      <TableCell className="font-medium">£{parseFloat(timesheet.grossPay || '0').toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          timesheet.status === 'approved' ? 'default' :
                          timesheet.status === 'rejected' ? 'destructive' : 'secondary'
                        }>
                          {timesheet.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewTimesheet(timesheet)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No approved timesheets found for this agency
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Invoices"
        description="Manage timesheets by agency"
      />
      
      <div className="ml-64 p-6">
        {!showAgencyTimesheets ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Invoices by Agency</h1>
                <p className="text-muted-foreground">Click on an agency to view their approved timesheets ready for invoicing</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search agencies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <AgencyListView />
          </div>
        ) : (
          <AgencyTimesheetView />
        )}
      </div>

      <CompanySelectorModal />

      {/* Timesheet View Dialog */}
      <Dialog open={showTimesheetView} onOpenChange={setShowTimesheetView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Timesheet Details</DialogTitle>
          </DialogHeader>
          
          {selectedTimesheet && (
            <div className="space-y-6">
              {/* Employee Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Employee Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Employee Name</label>
                    <p className="text-sm font-medium">
                      {selectedTimesheet.candidateId 
                        ? getEmployeeName(selectedTimesheet.candidateId)
                        : (selectedTimesheet.extractedData as any)?.employeeName || 
                          (selectedTimesheet.extractedData as any)?.["Person Name"] || 
                          "Unknown Employee"
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Agency</label>
                    <p className="text-sm font-medium">
                      {selectedAgency?.agencyName || 
                       (selectedTimesheet.extractedData as any)?.Agency ||
                       (selectedTimesheet.extractedData as any)?.agency ||
                       "Unknown Agency"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Timesheet Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Timesheet Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                    <p className="text-sm font-medium">
                      {selectedTimesheet.startDate ? format(new Date(selectedTimesheet.startDate), "dd/MM/yyyy") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">End Date</label>
                    <p className="text-sm font-medium">
                      {selectedTimesheet.endDate ? format(new Date(selectedTimesheet.endDate), "dd/MM/yyyy") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge variant={
                      selectedTimesheet.status === 'approved' ? 'default' :
                      selectedTimesheet.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {selectedTimesheet.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Hours Charged</label>
                    <p className="text-sm font-medium">{selectedTimesheet.hoursCharged || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Pay Rate</label>
                    <p className="text-sm font-medium">£{parseFloat(selectedTimesheet.payRate || '0').toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gross Pay</label>
                    <p className="text-sm font-medium text-lg text-green-600">£{parseFloat(selectedTimesheet.grossPay || '0').toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Information */}
              {selectedTimesheet.extractedData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedTimesheet.extractedData as Record<string, any>).map(([key, value]) => {
                        if (!value || ['employeeName', 'Person Name', 'Agency', 'agency'].includes(key)) return null;
                        return (
                          <div key={key}>
                            <label className="text-sm font-medium text-muted-foreground">{key}</label>
                            <p className="text-sm">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Document Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Original Document</label>
                    <p className="text-sm">{selectedTimesheet.originalDocumentUrl || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created At</label>
                    <p className="text-sm">
                      {selectedTimesheet.createdAt ? format(new Date(selectedTimesheet.createdAt), "dd/MM/yyyy HH:mm") : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={handleCloseTimesheetView}>
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