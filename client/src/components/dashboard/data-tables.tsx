import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Eye } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppContext } from "@/contexts/app-context";
import { Timesheet, Invoice, Candidate, Agency } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function DataTables() {
  const { selectedCompany } = useAppContext();
  const { toast } = useToast();

  const { data: pendingTimesheets, isLoading: timesheetsLoading } = useQuery<Timesheet[]>({
    queryKey: ["/api/timesheets", selectedCompany?.id, "pending"],
    enabled: !!selectedCompany?.id,
  });

  const { data: outstandingInvoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: candidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["/api/agencies", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const approveTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/timesheets/${id}`, { status: "approved" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({
        title: "Success",
        description: "Timesheet approved successfully",
        className: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
      });
    },
  });

  const getEmployeeName = (candidateId: string) => {
    const employee = candidates?.find(c => c.id === candidateId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
  };

  const getEmployeeInitials = (candidateId: string) => {
    const employee = candidates?.find(c => c.id === candidateId);
    return employee ? `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase() : "??";
  };

  const getAgencyName = (agencyId: string) => {
    return agencies?.find(agency => agency.id === agencyId)?.agencyName || "Unknown Agency";
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "text-error";
      case "outstanding":
        return "text-warning";
      case "paid":
        return "text-success";
      default:
        return "text-neutral-500";
    }
  };

  // Filter outstanding and overdue invoices
  const filteredInvoices = outstandingInvoices?.filter(
    invoice => invoice.status === "outstanding" || invoice.status === "overdue"
  ) || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Pending Timesheets Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Timesheets</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                {pendingTimesheets?.length || 0} pending
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timesheetsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTimesheets?.slice(0, 3).map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-neutral-200 dark:bg-neutral-500 text-xs">
                              {getEmployeeInitials(timesheet.candidateId)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm font-medium text-neutral-800 dark:text-white">
                            {getEmployeeName(timesheet.candidateId)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                        {getAgencyName(timesheet.agencyId)}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                        {timesheet.hoursCharged}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => approveTimesheetMutation.mutate(timesheet.id)}
                            disabled={approveTimesheetMutation.isPending}
                          >
                            <Check className="w-4 h-4 text-success" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4 text-primary-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {pendingTimesheets && pendingTimesheets.length > 3 && (
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-600 mt-4">
                  <Button variant="ghost" size="sm" className="text-primary-500 hover:text-primary-600">
                    View all pending timesheets
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Invoices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Outstanding Invoices</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                {filteredInvoices.filter(i => i.status === "overdue").length} overdue
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.slice(0, 3).map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-sm font-medium text-neutral-800 dark:text-white">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                        {getAgencyName(invoice.agencyId)}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                        £{parseFloat(invoice.totalAmount || "0").toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${getInvoiceStatusColor(invoice.status || "outstanding")}`}>
                          {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredInvoices.length > 3 && (
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-600 mt-4">
                  <Button variant="ghost" size="sm" className="text-primary-500 hover:text-primary-600">
                    View all invoices
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
