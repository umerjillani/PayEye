import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCandidateSchema, Agency, Candidate, InsertCandidate } from "@shared/schema";
import { useAppContext } from "@/contexts/app-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Info } from "lucide-react";
import { useEffect } from "react";

const employeeFormSchema = insertCandidateSchema.extend({
  id: z.string().optional(),
  title: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationalInsuranceNumber: z.string().optional(),
  nino: z.string().optional(),
  referenceNumber: z.string().optional(),
  sector: z.string().optional(),
  paymentFrequency: z.string().optional(),
  payrollProcessor: z.string().optional(),
  firstPayDate: z.string().optional(),
  niCode: z.string().optional(),
  companyName: z.string().optional(),
  companyRegistrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  corporationTaxReference: z.string().optional(),
  emergencyTaxCode: z.boolean().optional(),
  agencyIds: z.array(z.string()).default([]),
}).refine((data) => {
  // NI Number is required for Umbrella workers, optional for Sub-contractors
  if (data.employmentType === "umbrellaNg" && (!data.nationalInsuranceNumber || data.nationalInsuranceNumber.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "National Insurance Number is required for Umbrella workers",
  path: ["nationalInsuranceNumber"],
});

type EmployeeForm = z.infer<typeof employeeFormSchema>;

interface EmployeeModalProps {
  employee?: Candidate | null;
  isOpen?: boolean;
  onClose?: () => void;
  prefilledData?: any;
  onSave?: (createdEmployee?: Candidate) => void;
}

export function EmployeeModal({ employee, isOpen, onClose, prefilledData, onSave }: EmployeeModalProps) {
  const { showEmployeeModal, setShowEmployeeModal, selectedCompany } = useAppContext();
  
  // Use passed props or fallback to global state
  const modalIsOpen = isOpen !== undefined ? isOpen : showEmployeeModal;
  const modalOnClose = onClose || (() => setShowEmployeeModal(false));
  const { toast } = useToast();

  const { data: agencies, isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/agencies"],
    enabled: !!selectedCompany?.id && modalIsOpen,
  });

  // Debug logging for agencies loading
  useEffect(() => {
    console.log("Employee modal agencies debug:", {
      modalIsOpen,
      selectedCompanyId: selectedCompany?.id,
      agenciesLoading,
      agenciesCount: agencies?.length,
      agencies: agencies?.map(a => a.agencyName)
    });
  }, [modalIsOpen, selectedCompany?.id, agenciesLoading, agencies]);

  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee ? {
      ...employee,
      title: employee.title || "",
      agencyIds: employee.agencyIds || [],
      dateOfBirth: "",
      nationalInsuranceNumber: employee.nationalInsuranceNumber || "",
      referenceNumber: "",
      sector: "",
      paymentFrequency: "Monthly",
      payrollProcessor: "None",
      firstPayDate: "30/05/2025",
      niCode: "A",
      companyName: employee.companyName || "",
      companyRegistrationNumber: employee.companyRegistrationNumber || "",
      vatNumber: employee.vatNumber || "",
      corporationTaxReference: employee.corporationTaxReference || "",
      emergencyTaxCode: employee.emergencyTaxCode || false,
    } : prefilledData ? {
      companyId: selectedCompany?.id || "",
      title: "",
      agencyIds: [],
      firstName: prefilledData.firstName || "",
      lastName: prefilledData.lastName || "",
      email: "",
      phone: "",
      address: "",
      employmentType: "umbrellaNg",
      taxCode: "1257L",
      payRate: prefilledData.payRate || "",
      margin: "",
      bankName: "",
      accountNumber: "",
      sortCode: "",
      status: "active",
      gender: "Male",
      dateOfBirth: "",
      nationalInsuranceNumber: "",
      referenceNumber: "",
      sector: "",
      paymentFrequency: "Monthly",
      payrollProcessor: "None",
      firstPayDate: "30/05/2025",
      niCode: "A",
      companyName: "",
      companyRegistrationNumber: "",
      vatNumber: "",
      corporationTaxReference: "",
      emergencyTaxCode: false,
      supplierCode: "",
    } : {
      companyId: selectedCompany?.id || "",
      title: "",
      agencyIds: [],
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      employmentType: "PAYE",
      taxCode: "1257L",
      payRate: "",
      margin: "",
      bankName: "",
      accountNumber: "",
      sortCode: "",
      status: "active",
      gender: "Male",
      dateOfBirth: "",
      nationalInsuranceNumber: "",
      referenceNumber: "",
      sector: "",
      paymentFrequency: "Monthly",
      payrollProcessor: "None",
      firstPayDate: "30/05/2025",
      niCode: "A",
      companyName: "",
      companyRegistrationNumber: "",
      vatNumber: "",
      corporationTaxReference: "",
      emergencyTaxCode: false,
    },
  });

  // Reset form when employee or prefilledData changes
  useEffect(() => {
    if (employee) {
      form.reset({
        ...employee,
        title: employee.title ?? "",
        agencyIds: employee.agencyIds || [],
        dateOfBirth: "",
        nationalInsuranceNumber: employee.nationalInsuranceNumber || "",
        referenceNumber: employee?.referenceNumber || "",
        sector: "",
        paymentFrequency: "Monthly",
        payrollProcessor: "None",
        firstPayDate: "30/05/2025",
        niCode: "A",
        companyName: employee.companyName || "",
        companyRegistrationNumber: employee.companyRegistrationNumber || "",
        vatNumber: employee.vatNumber || "",
        corporationTaxReference: employee.corporationTaxReference || "",
        emergencyTaxCode: employee.emergencyTaxCode || false,
      });
    } else if (prefilledData) {
      console.log("Setting form with prefilled data:", prefilledData);
      
      form.reset({
        companyId: selectedCompany?.id || "",
        title: "",
        agencyIds: [], // Will be set by separate useEffect when agencies load
        firstName: prefilledData.firstName || "",
        lastName: prefilledData.lastName || "",
        email: "",
        phone: "",
        address: "",
        employmentType: "umbrellaNg",
        taxCode: "1257L",
        payRate: prefilledData.payRate || "",
        margin: "",
        bankName: "",
        accountNumber: "",
        sortCode: "",
        status: "active",
        gender: "Male",
        dateOfBirth: "",
        nationalInsuranceNumber: "",
        referenceNumber: "",
        sector: "",
        paymentFrequency: "Monthly",
        payrollProcessor: "None",
        firstPayDate: "30/05/2025",
        niCode: "A",
        companyName: "",
        companyRegistrationNumber: "",
        vatNumber: "",
        corporationTaxReference: "",
        emergencyTaxCode: false,
        supplierCode: "",
      });
    } else {
      form.reset({
        companyId: selectedCompany?.id || "",
        title: "",
        agencyIds: [],
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        employmentType: "umbrellaNg",
        taxCode: "1257L",
        payRate: "",
        margin: "",
        bankName: "",
        accountNumber: "",
        sortCode: "",
        status: "active",
        gender: "Male",
        dateOfBirth: "",
        nationalInsuranceNumber: "",
        referenceNumber: "",
        sector: "",
        paymentFrequency: "Monthly",
        payrollProcessor: "None",
        firstPayDate: "30/05/2025",
        niCode: "A",
        companyName: "",
        companyRegistrationNumber: "",
        vatNumber: "",
        corporationTaxReference: "",
        emergencyTaxCode: false,
        supplierCode: "",
      });
    }
  }, [employee, prefilledData, selectedCompany?.id, form]);

  // Separate useEffect to handle agency matching when agencies are loaded
  useEffect(() => {
    if (prefilledData && agencies && agencies.length > 0 && !employee) {
      console.log("Updating agency selection for prefilled data");
      
      // Find matching agency by name with better matching logic
      const matchingAgency = agencies.find(agency => {
        if (!prefilledData.clientName || !agency.agencyName) return false;
        
        const clientName = prefilledData.clientName.toLowerCase().trim();
        const agencyName = agency.agencyName.toLowerCase().trim();
        
        // Exact match
        if (clientName === agencyName) return true;
        
        // Check if one contains the other
        if (clientName.includes(agencyName) || agencyName.includes(clientName)) return true;
        
        // Check for partial matches (remove common suffixes like Ltd, Limited, etc.)
        const cleanClientName = clientName.replace(/\s+(ltd|limited|inc|incorporated|llc|plc)\.?$/i, '').trim();
        const cleanAgencyName = agencyName.replace(/\s+(ltd|limited|inc|incorporated|llc|plc)\.?$/i, '').trim();
        
        return cleanClientName === cleanAgencyName || 
               cleanClientName.includes(cleanAgencyName) || 
               cleanAgencyName.includes(cleanClientName);
      });
      
      if (matchingAgency) {
        console.log("Found matching agency after agencies loaded:", matchingAgency);
        form.setValue("agencyIds", [matchingAgency.id]);
      } else {
        console.log("No matching agency found for:", prefilledData.clientName);
        console.log("Available agencies:", agencies.map(a => a.agencyName));
      }
    }
  }, [agencies, prefilledData, employee, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertCandidate) => {
      const res = await apiRequest("POST", "/api/candidates", data);
      return res.json();
    },
    onSuccess: async (createdEmployee) => {
      await queryClient.refetchQueries({ queryKey: ["/api/candidates", selectedCompany?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
      modalOnClose();
      if (onSave) onSave(createdEmployee);
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
    mutationFn: async (data: { id: string; updates: Partial<InsertCandidate> }) => {
      const res = await apiRequest("PUT", `/api/candidates/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: async (updatedEmployee) => {
      // Invalidate all candidate-related queries to force a refresh
      await queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/candidates", selectedCompany?.id] });
      
      // Also refetch to ensure immediate update
      await queryClient.refetchQueries({ queryKey: ["/api/candidates", selectedCompany?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/candidates"] });
      
      toast({
        title: "Success", 
        description: "Employee updated successfully",
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
      modalOnClose();
      if (onSave) onSave();
    },
    onError: (error: Error) => {
      console.error("Employee update error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmployeeForm) => {
    // Clean the data - convert empty strings to null for numeric fields
    const cleanedData = {
      ...data,
      payRate: data.payRate === "" ? null : data.payRate,
      margin: data.margin === "" ? null : data.margin,
      percentageCap: data.percentageCap === "" ? null : data.percentageCap,
    };

    if (employee) {
      updateMutation.mutate({ id: employee.id, updates: cleanedData });
    } else {
      createMutation.mutate({ ...cleanedData, id: nanoid() });
    }
  };

  return (
    <Dialog open={modalIsOpen} onOpenChange={modalOnClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {employee ? "Edit Employee" : "Create New Employee"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {employee ? (
              <>You are editing <strong>{employee.firstName} {employee.lastName}</strong>. Update the information below and save your changes.</>
            ) : (
              <>You are about to <strong>create a new employee</strong>. This employee will be created as "New Starter (Minimal)" and will require more details before payroll. If you do not enter a reference, one will be generated for you.</>
            )}
          </p>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Name Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="Title"
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  placeholder="First Name"
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Surname</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  placeholder="Surname"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Gender *</Label>
                <RadioGroup
                  value={form.watch("gender")}
                  onValueChange={(value) => form.setValue("gender", value)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Male" id="male" />
                    <Label htmlFor="male">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Female" id="female" />
                    <Label htmlFor="female">Female</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  {...form.register("dateOfBirth")}
                  placeholder="Date Of Birth"
                  type="date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalInsuranceNumber">
                  NI Number {form.watch("employmentType") === "umbrellaNg" && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="nationalInsuranceNumber"
                  {...form.register("nationalInsuranceNumber")}
                  placeholder={form.watch("employmentType") === "umbrellaNg" 
                    ? "National Insurance Number (Required)" 
                    : "National Insurance Number (Optional)"
                  }
                />
                {form.formState.errors.nationalInsuranceNumber && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.nationalInsuranceNumber.message}
                  </p>
                )}
                {form.watch("employmentType") === "subcontractor" && (
                  <p className="text-xs text-gray-500">
                    Not required for Limited Company workers
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Employee Reference Number</Label>
                <Input
                  id="referenceNumber"
                  {...form.register("referenceNumber")}
                  placeholder="Employee Reference Number (Optional)"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Used for linking timesheets to existing employees
                </p>
              </div>

              <div className="space-y-2">
                <Label>Agencies</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-10 px-3 py-2 text-left"
                      disabled={agenciesLoading}
                    >
                      <span className="truncate">
                        {agenciesLoading ? "Loading agencies..." : 
                         form.watch("agencyIds")?.length === 0 || !form.watch("agencyIds")
                          ? "Select agencies..."
                          : `${form.watch("agencyIds")?.length} selected`}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandEmpty className="py-6 text-center text-sm">
                        {agenciesLoading ? "Loading agencies..." : "No agencies found."}
                      </CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {agencies?.map((agency) => {
                          const isSelected = form.watch("agencyIds")?.includes(agency.id) || false;
                          return (
                            <CommandItem
                              key={agency.id}
                              onSelect={() => {
                                const currentAgencies = form.watch("agencyIds") || [];
                                if (isSelected) {
                                  form.setValue("agencyIds", currentAgencies.filter(id => id !== agency.id));
                                } else {
                                  form.setValue("agencyIds", [...currentAgencies, agency.id]);
                                }
                              }}
                              className="flex items-center py-2 px-3 cursor-pointer hover:bg-accent"
                            >
                              <Checkbox
                                checked={isSelected}
                                className="mr-3 h-4 w-4"
                              />
                              <span className="flex-1 truncate text-sm">{agency.agencyName}</span>
                              {isSelected && (
                                <Check className="ml-2 h-4 w-4 text-primary" />
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Show selected agencies as badges */}
                {form.watch("agencyIds")?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.watch("agencyIds")?.map((agencyId) => {
                      const agency = agencies?.find(a => a.id === agencyId);
                      return agency ? (
                        <Badge
                          key={agencyId}
                          variant="secondary"
                          className="text-xs px-2 py-1"
                        >
                          {agency.agencyName}
                          <button
                            type="button"
                            className="ml-1 text-xs hover:text-red-600"
                            onClick={() => {
                              const currentAgencies = form.watch("agencyIds") || [];
                              form.setValue("agencyIds", currentAgencies.filter(id => id !== agencyId));
                            }}
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type *</Label>
                <Select
                  value={form.watch("employmentType")}
                  onValueChange={(value) => form.setValue("employmentType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subcontractor">Subcontractor (Limited Company)</SelectItem>
                    <SelectItem value="umbrellaNg">UmbrellaNG (PAYE/Umbrella)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PAYE-specific fields */}
              {form.watch("employmentType") === "PAYE" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nationalInsuranceNumber">National Insurance Number *</Label>
                    <Input
                      id="nationalInsuranceNumber"
                      {...form.register("nationalInsuranceNumber")}
                      placeholder="AB123456C"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxCode">Tax Code *</Label>
                    <Input
                      id="taxCode"
                      {...form.register("taxCode")}
                      placeholder="1257L"
                    />
                  </div>
                </>
              )}

              {/* Limited Company-specific fields */}
              {form.watch("employmentType") === "Limited Company" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      {...form.register("companyName")}
                      placeholder="Company Ltd"
                      className="bg-blue-50 border-blue-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyRegistrationNumber">Company Registration Number *</Label>
                    <Input
                      id="companyRegistrationNumber"
                      {...form.register("companyRegistrationNumber")}
                      placeholder="12345678"
                      className="bg-blue-50 border-blue-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
                    <Input
                      id="vatNumber"
                      {...form.register("vatNumber")}
                      placeholder="GB123456789"
                      className="bg-blue-50 border-blue-200"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Select
                  value={form.watch("sector")}
                  onValueChange={(value) => form.setValue("sector", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Construction">Construction</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nino">National Insurance Number *</Label>
                <Input
                  id="nino"
                  {...form.register("nino")}
                  placeholder="AB123456C"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">Required for RTI data retrieval from HMRC</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxCode">Tax Code *</Label>
                <Input
                  id="taxCode"
                  {...form.register("taxCode")}
                  placeholder="1257L"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niCode">NI Code *</Label>
                <Input
                  id="niCode"
                  {...form.register("niCode")}
                  placeholder="A"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="Email Address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Number</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="Mobile Number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  {...form.register("reference")}
                  placeholder="Reference (NO AGENCY PREFIX)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                <Select
                  value={form.watch("paymentFrequency")}
                  onValueChange={(value) => form.setValue("paymentFrequency", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Monthly" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payrollProcessor">Payroll Processor</Label>
                <Select
                  value={form.watch("payrollProcessor")}
                  onValueChange={(value) => form.setValue("payrollProcessor", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="SAGE">SAGE</SelectItem>
                    <SelectItem value="QuickBooks">QuickBooks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstPayDate">First Pay Date *</Label>
                <Input
                  id="firstPayDate"
                  {...form.register("firstPayDate")}
                  placeholder="30/05/2025"
                  type="date"
                />
              </div>
            </div>
          </div>

          {/* Info Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>New users will be forced to change their passwords upon logging in</strong>
            </p>
          </div>
          
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={modalOnClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {createMutation.isPending || updateMutation.isPending
                ? (employee ? "Updating..." : "Creating...")
                : (employee ? "Update Details" : "Create Employee")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
