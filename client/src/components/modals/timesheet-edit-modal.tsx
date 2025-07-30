import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, Building, Clock, DollarSign, UserPlus, Check, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Timesheet, Candidate, Agency } from "@shared/schema";
import { format } from "date-fns";

interface TimesheetEditModalProps {
  timesheet: Timesheet | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Timesheet>) => void;
  candidates: Candidate[];
  agencies: Agency[];
  isLoading?: boolean;
  onCreateEmployee?: () => void;
}

export function TimesheetEditModal({
  timesheet,
  isOpen,
  onClose,
  onSave,
  candidates,
  agencies,
  isLoading = false,
  onCreateEmployee
}: TimesheetEditModalProps) {
  const [formData, setFormData] = useState({
    candidateId: "",
    agencyIds: [] as string[],
    startDate: "",
    endDate: "",
    hoursCharged: "",
    payRate: "",
    grossPay: "",
    status: "pending",
    shiftDetails: "",
  });

  const [employeeReferenceNumber, setEmployeeReferenceNumber] = useState("");
  const [showReferenceSection, setShowReferenceSection] = useState(false);

  useEffect(() => {
    if (timesheet) {
      setFormData({
        candidateId: timesheet.candidateId || "",
        agencyIds: timesheet.agencyId ? [timesheet.agencyId] : [],
        startDate: timesheet.startDate ? format(new Date(timesheet.startDate), "yyyy-MM-dd") : "",
        endDate: timesheet.endDate ? format(new Date(timesheet.endDate), "yyyy-MM-dd") : "",
        hoursCharged: timesheet.hoursCharged || "",
        payRate: timesheet.payRate || "",
        grossPay: timesheet.grossPay || "",
        status: timesheet.status || "pending",
        shiftDetails: timesheet.shiftDetails || "",
      });
    }
  }, [timesheet]);

  const handleSave = () => {
    if (!timesheet) return;

    const updatedData = {
      ...formData,
      agencyId: formData.agencyIds.length > 0 ? formData.agencyIds[0] : "",
      startDate: formData.startDate ? new Date(formData.startDate) : timesheet.startDate,
      endDate: formData.endDate ? new Date(formData.endDate) : timesheet.endDate,
    };

    onSave(updatedData);
  };

  const getEmployeeName = (candidateId: string) => {
    const employee = candidates.find(c => c.id === candidateId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown Employee";
  };

  const getAgencyName = (agencyId: string) => {
    return agencies.find(a => a.id === agencyId)?.agencyName || "Unknown Agency";
  };

  // Handle employee linking with reference number
  const handleEmployeeLinking = (selectedCandidateId: string) => {
    const selectedEmployee = candidates.find(c => c.id === selectedCandidateId);
    if (selectedEmployee && timesheet) {
      // Replicate ONLY basic employee properties, keep timesheet data from extraction
      setFormData(prev => ({
        ...prev,
        candidateId: selectedEmployee.id,
        agencyIds: selectedEmployee.agencyIds || [],
        // Keep all timesheet-specific data from AI extraction (dates, hours, pay rate, gross pay)
        // Only link the employee identity and agencies
      }));
      
      console.log("Linked employee:", selectedEmployee.firstName, selectedEmployee.lastName);
      console.log("Employee agencies:", selectedEmployee.agencyIds);
      console.log("Selected agency:", selectedEmployee.agencyIds?.[0]);
    }
  };

  // Handle reference number matching
  const handleReferenceNumberSubmit = () => {
    if (!employeeReferenceNumber.trim()) return;
    
    // Find employee by reference number, ID, or name
    const matchedEmployee = candidates.find(c => 
      c.id === employeeReferenceNumber ||
      c.referenceNumber === employeeReferenceNumber ||
      c.firstName?.toLowerCase().includes(employeeReferenceNumber.toLowerCase()) ||
      c.lastName?.toLowerCase().includes(employeeReferenceNumber.toLowerCase()) ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(employeeReferenceNumber.toLowerCase())
    );
    
    if (matchedEmployee) {
      handleEmployeeLinking(matchedEmployee.id);
      setEmployeeReferenceNumber("");
      setShowReferenceSection(false);
    } else {
      // Show toast message if no employee found
      console.log("No employee found with reference:", employeeReferenceNumber);
    }
  };

  if (!timesheet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="w-5 h-5 text-primary" />
            <span>Edit Timesheet</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Employee Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="candidateId">Employee</Label>
                <div className="space-y-2">
                  <Select
                    value={formData.candidateId}
                    onValueChange={(value) => handleEmployeeLinking(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.firstName} {candidate.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Show employee name from extracted data if no candidate is selected */}
                  {!formData.candidateId && timesheet?.extractedData && (
                    <div className="text-sm text-muted-foreground">
                      <span>Extracted Employee: </span>
                      <span className="font-medium">
                        {((timesheet.extractedData as any)?.employeeName || 
                         (timesheet.extractedData as any)?.["Person Name"] || 
                         "Unknown") as string}
                      </span>
                    </div>
                  )}
                  
                  {/* Employee linking options for unknown employees */}
                  {!formData.candidateId && (
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReferenceSection(!showReferenceSection)}
                          className="flex-1"
                        >
                          Link to Existing Employee
                        </Button>
                        {onCreateEmployee && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onCreateEmployee}
                            className="flex-1"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create Employee
                          </Button>
                        )}
                      </div>
                      
                      {/* Reference number input section */}
                      {showReferenceSection && (
                        <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                          <div>
                            <Label htmlFor="employeeReference">Employee Reference/Name</Label>
                            <div className="flex space-x-2">
                              <Input
                                id="employeeReference"
                                value={employeeReferenceNumber}
                                onChange={(e) => setEmployeeReferenceNumber(e.target.value)}
                                placeholder="Enter employee ID, name, or reference number"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleReferenceNumberSubmit}
                                disabled={!employeeReferenceNumber.trim()}
                              >
                                Link
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Enter employee ID, name, or any unique identifier to link this timesheet
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Agencies</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-auto min-h-10"
                    >
                      <div className="flex flex-wrap gap-1">
                        {formData.agencyIds.length === 0 ? (
                          <span className="text-muted-foreground">Select agencies...</span>
                        ) : (
                          formData.agencyIds.map((agencyId) => {
                            const agency = agencies.find(a => a.id === agencyId);
                            return agency ? (
                              <Badge key={agencyId} variant="secondary" className="text-xs">
                                {agency.agencyName}
                                <X 
                                  className="ml-1 h-3 w-3 cursor-pointer" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData(prev => ({
                                      ...prev,
                                      agencyIds: prev.agencyIds.filter(id => id !== agencyId)
                                    }));
                                  }}
                                />
                              </Badge>
                            ) : null;
                          })
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandEmpty>No agencies found.</CommandEmpty>
                      <CommandGroup className="max-h-48 overflow-y-auto">
                        {agencies.map((agency) => (
                          <CommandItem
                            key={agency.id}
                            onSelect={() => {
                              setFormData(prev => {
                                const isSelected = prev.agencyIds.includes(agency.id);
                                return {
                                  ...prev,
                                  agencyIds: isSelected
                                    ? prev.agencyIds.filter(id => id !== agency.id)
                                    : [...prev.agencyIds, agency.id]
                                };
                              });
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.agencyIds.includes(agency.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {agency.agencyName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Time & Pay Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Time & Pay Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="hoursCharged">Hours Worked</Label>
                <Input
                  id="hoursCharged"
                  type="number"
                  step="0.5"
                  value={formData.hoursCharged}
                  onChange={(e) => setFormData(prev => ({ ...prev, hoursCharged: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="payRate">Pay Rate (£/hour)</Label>
                <Input
                  id="payRate"
                  type="number"
                  step="0.01"
                  value={formData.payRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, payRate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="grossPay">Gross Pay (£)</Label>
                <Input
                  id="grossPay"
                  type="number"
                  step="0.01"
                  value={formData.grossPay}
                  onChange={(e) => setFormData(prev => ({ ...prev, grossPay: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Additional Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="shiftDetails">Shift Details / Notes</Label>
                <Textarea
                  id="shiftDetails"
                  value={formData.shiftDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, shiftDetails: e.target.value }))}
                  placeholder="Enter any additional details about the shift..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}