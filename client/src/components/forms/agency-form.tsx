import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Mail, Building2, CreditCard, Percent } from "lucide-react";
import { Agency } from "@shared/schema";

const CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
];

const agencyFormSchema = z.object({
  agencyName: z.string().min(1, "Agency name is required"),
  contactPerson: z.string().optional(),
  emails: z.array(z.object({
    email: z.string().email("Invalid email format"),
    isPrimary: z.boolean().default(false)
  })).min(1, "At least one email is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  codaRef: z.string().optional(),
  paymentTerms: z.number().min(1).max(365).default(30),
  accountInvoiceRequired: z.boolean().default(false),
  vatTable: z.boolean().default(false),
  notes: z.string().optional(),
  bankDetails: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    sortCode: z.string().min(1, "Sort code is required"),
    iban: z.string().optional(),
    swiftCode: z.string().optional(),
    accountHolderName: z.string().min(1, "Account holder name is required"),
  }).optional(),
  payRateType: z.enum(["UmbrellaNG", "Sub-Contractor"]).default("UmbrellaNG"),
  payRateValue: z.string().optional(),
  payRatePercentage: z.string().optional(),
  currency: z.string().default("GBP"),
});

type AgencyFormData = z.infer<typeof agencyFormSchema>;

interface AgencyFormProps {
  agency?: Agency | null;
  onSubmit: (data: AgencyFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AgencyForm({ agency, onSubmit, onCancel, isLoading }: AgencyFormProps) {
  const [showBankDetails, setShowBankDetails] = useState(!!agency?.bankDetails);

  const form = useForm<AgencyFormData>({
    resolver: zodResolver(agencyFormSchema),
    defaultValues: {
      agencyName: agency?.agencyName || "",
      contactPerson: agency?.contactPerson || "",
      emails: agency?.emails?.map((email, index) => ({ 
        email, 
        isPrimary: index === 0 
      })) || [{ email: "", isPrimary: true }],
      phone: agency?.phone || "",
      address: agency?.address || "",
      codaRef: agency?.codaRef || "",
      paymentTerms: agency?.paymentTerms || 30,
      accountInvoiceRequired: agency?.accountInvoiceRequired || false,
      vatTable: agency?.vatTable || false,
      notes: agency?.notes || "",
      bankDetails: agency?.bankDetails || undefined,
      payRateType: agency?.payRateType || "UmbrellaNG",
      payRateValue: agency?.payRateValue || "",
      payRatePercentage: agency?.payRatePercentage || "",
      currency: agency?.currency || "GBP",
    },
  });

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control: form.control,
    name: "emails",
  });

  const watchPayRateType = form.watch("payRateType");
  const watchCurrency = form.watch("currency");
  const selectedCurrency = CURRENCIES.find(c => c.code === watchCurrency);

  // Clear bank details errors when toggle is turned off
  useEffect(() => {
    if (!showBankDetails) {
      form.clearErrors("bankDetails");
    }
  }, [showBankDetails, form]);

  const handleSubmit = (data: AgencyFormData) => {
    // Ensure only one primary email
    const emails = data.emails.map((emailObj, index) => ({
      ...emailObj,
      isPrimary: index === 0
    }));

    // Only include bank details if the toggle is on
    const submissionData = {
      ...data,
      emails,
      bankDetails: showBankDetails ? data.bankDetails : undefined,
    };

    onSubmit(submissionData);
  };

  // Custom validation to bypass bank details validation when toggle is off
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Get current form values
    const formData = form.getValues();
    
    // First, validate the form normally
    const isValid = await form.trigger();
    
    // If bank details are not shown, skip their validation
    if (!showBankDetails) {
      // Clear any bank details errors
      form.clearErrors("bankDetails");
      
      // Check if there are any other validation errors
      const hasNonBankErrors = Object.keys(form.formState.errors).some(key => key !== "bankDetails");
      
      if (!hasNonBankErrors) {
        handleSubmit(formData);
      }
    } else {
      // Use standard form validation when bank details are shown
      if (isValid) {
        handleSubmit(formData);
      }
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="agencyName">Agency Name *</Label>
            <Input
              id="agencyName"
              {...form.register("agencyName")}
              placeholder="Enter agency name"
            />
            {form.formState.errors.agencyName && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.agencyName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              {...form.register("contactPerson")}
              placeholder="Enter contact person name"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...form.register("phone")}
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...form.register("address")}
              placeholder="Enter full address"
            />
          </div>

          <div>
            <Label htmlFor="codaRef">CODA Reference</Label>
            <Input
              id="codaRef"
              {...form.register("codaRef")}
              placeholder="Enter CODA reference"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  {...form.register(`emails.${index}.email`)}
                  placeholder="Enter email address"
                />
                {form.formState.errors.emails?.[index]?.email && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.emails[index]?.email?.message}
                  </p>
                )}
              </div>
              {index === 0 && (
                <Badge variant="secondary">Primary</Badge>
              )}
              {emailFields.length > 1 && index > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeEmail(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendEmail({ email: "", isPrimary: false })}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Email Address
          </Button>
        </CardContent>
      </Card>

      {/* Pay Rate Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay Rate Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={watchCurrency}
              onValueChange={(value) => form.setValue("currency", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payRateType">Pay Rate Type</Label>
            <Select
              value={watchPayRateType}
              onValueChange={(value: "UmbrellaNG" | "Sub-Contractor") => {
                form.setValue("payRateType", value);
                // Clear the other field when switching types
                if (value === "UmbrellaNG") {
                  form.setValue("payRatePercentage", "");
                } else {
                  form.setValue("payRateValue", "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pay rate type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UmbrellaNG">UmbrellaNG (Fixed Rate)</SelectItem>
                <SelectItem value="Sub-Contractor">Sub-Contractor (Percentage)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchPayRateType === "UmbrellaNG" && (
            <div>
              <Label htmlFor="payRateValue">
                Fixed Pay Rate ({selectedCurrency?.symbol})
              </Label>
              <Input
                id="payRateValue"
                {...form.register("payRateValue")}
                placeholder={`Enter fixed rate in ${selectedCurrency?.symbol}`}
                type="number"
                step="0.01"
              />
            </div>
          )}

          {watchPayRateType === "Sub-Contractor" && (
            <div>
              <Label htmlFor="payRatePercentage" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Percentage Rate
              </Label>
              <Input
                id="payRatePercentage"
                {...form.register("payRatePercentage")}
                placeholder="Enter percentage (e.g., 15.5)"
                type="number"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Details
            </div>
            <Switch
              checked={showBankDetails}
              onCheckedChange={setShowBankDetails}
            />
          </CardTitle>
        </CardHeader>
        {showBankDetails && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bankName">Bank Name *</Label>
              <Input
                id="bankName"
                {...form.register("bankDetails.bankName")}
                placeholder="Enter bank name"
              />
            </div>

            <div>
              <Label htmlFor="accountHolderName">Account Holder Name *</Label>
              <Input
                id="accountHolderName"
                {...form.register("bankDetails.accountHolderName")}
                placeholder="Enter account holder name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                  id="accountNumber"
                  {...form.register("bankDetails.accountNumber")}
                  placeholder="Enter account number"
                />
              </div>
              <div>
                <Label htmlFor="sortCode">Sort Code *</Label>
                <Input
                  id="sortCode"
                  {...form.register("bankDetails.sortCode")}
                  placeholder="XX-XX-XX"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="iban">IBAN (Optional)</Label>
                <Input
                  id="iban"
                  {...form.register("bankDetails.iban")}
                  placeholder="Enter IBAN"
                />
              </div>
              <div>
                <Label htmlFor="swiftCode">SWIFT Code (Optional)</Label>
                <Input
                  id="swiftCode"
                  {...form.register("bankDetails.swiftCode")}
                  placeholder="Enter SWIFT code"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Business Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="paymentTerms">Payment Terms (Days)</Label>
            <Input
              id="paymentTerms"
              {...form.register("paymentTerms", { valueAsNumber: true })}
              type="number"
              min="1"
              max="365"
              placeholder="30"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="accountInvoiceRequired"
              {...form.register("accountInvoiceRequired")}
            />
            <Label htmlFor="accountInvoiceRequired">Account Invoice Required</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="vatTable"
              {...form.register("vatTable")}
            />
            <Label htmlFor="vatTable">VAT Table</Label>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Additional notes or comments"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : agency ? "Update Agency" : "Create Agency"}
        </Button>
      </div>
    </form>
  );
}