import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink,
  Send,
  FileText,
  Clock,
  Calendar,
  User,
  PoundSterling
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface HMRCStatus {
  connected: boolean;
  expiresAt?: string;
  expired?: boolean;
  scope?: string;
  message?: string;
}

interface HMRCSubmission {
  id: number;
  submissionType: "FPS" | "EPS";
  submissionId?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  employerRef: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  employeeCount?: number;
  totalGrossPay?: string;
  totalTax?: string;
  totalNI?: string;
  submittedAt: string;
  errors?: any[];
}

export default function HMRCPage() {
  const [employerRef, setEmployerRef] = useState("");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const queryClient = useQueryClient();

  // Fetch HMRC connection status
  const { data: hmrcStatus, isLoading: statusLoading } = useQuery<HMRCStatus>({
    queryKey: ["/api/hmrc/status"],
  });

  // Fetch HMRC submissions
  const { data: submissions = [] } = useQuery<HMRCSubmission[]>({
    queryKey: ["/api/hmrc/submissions"],
  });

  // Connect to HMRC mutation
  const connectMutation = useMutation({
    mutationFn: () => apiRequest("/api/hmrc/auth"),
    onSuccess: (data: { authUrl: string }) => {
      // Redirect to HMRC OAuth
      window.location.href = data.authUrl;
    },
  });

  // Submit FPS mutation
  const submitFPSMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/hmrc/submit-fps", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hmrc/submissions"] });
    },
  });

  const handleSubmitFPS = () => {
    if (!employerRef || !payPeriodStart || !payPeriodEnd) {
      alert("Please fill in all required fields");
      return;
    }

    // TODO: Get approved timesheets and prepare employee data
    const mockEmployees = [
      {
        nino: "AB123456C",
        name: { forename: "John", surname: "Doe" },
        grossPay: 2500,
        paymentDate: payPeriodEnd,
        taxCode: "1257L",
      },
    ];

    submitFPSMutation.mutate({
      employerRef,
      payPeriodStart,
      payPeriodEnd,
      employees: mockEmployees,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HMRC RTI Integration</h1>
          <p className="text-muted-foreground">
            Real Time Information submissions to HM Revenue & Customs
          </p>
        </div>
        <Building2 className="h-8 w-8 text-blue-500" />
      </div>

      {/* Connection Status */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            HMRC Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="animate-pulse">Checking connection...</div>
          ) : hmrcStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Connected to HMRC
                </span>
              </div>
              {hmrcStatus.expiresAt && (
                <p className="text-sm text-muted-foreground">
                  Token expires: {new Date(hmrcStatus.expiresAt).toLocaleString()}
                </p>
              )}
              {hmrcStatus.expired && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your HMRC token has expired. Please reconnect to continue submitting data.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-700 dark:text-red-400">
                  Not connected to HMRC
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {hmrcStatus?.message || "Connect to HMRC to submit RTI data"}
              </p>
              <Button 
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {connectMutation.isPending ? "Connecting..." : "Connect to HMRC"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submissions">RTI Submissions</TabsTrigger>
          <TabsTrigger value="submit">Submit FPS</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>

        {/* RTI Submissions Tab */}
        <TabsContent value="submissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent RTI Submissions
              </CardTitle>
              <CardDescription>
                View all Full Payment Submissions (FPS) and Employer Payment Summaries (EPS)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No RTI submissions yet</p>
                  <p className="text-sm">Submit your first FPS to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {submission.submissionType}
                          </Badge>
                          <Badge className={getStatusColor(submission.status)}>
                            {getStatusIcon(submission.status)}
                            <span className="ml-1">{submission.status}</span>
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Employer Ref:</span>
                          <p className="font-mono">{submission.employerRef}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pay Period:</span>
                          <p>{submission.payPeriodStart} to {submission.payPeriodEnd}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Employees:</span>
                          <p className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {submission.employeeCount || 0}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Pay:</span>
                          <p className="flex items-center gap-1">
                            <PoundSterling className="h-4 w-4" />
                            {submission.totalGrossPay || "0.00"}
                          </p>
                        </div>
                      </div>

                      {submission.submissionId && (
                        <div className="bg-muted/50 rounded p-2">
                          <span className="text-xs text-muted-foreground">HMRC Submission ID:</span>
                          <p className="font-mono text-sm">{submission.submissionId}</p>
                        </div>
                      )}

                      {submission.errors && submission.errors.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            {submission.errors.length} error(s) encountered during submission
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Submit FPS Tab */}
        <TabsContent value="submit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Submit Full Payment Submission (FPS)
              </CardTitle>
              <CardDescription>
                Submit payroll information to HMRC in real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employerRef">Employer PAYE Reference *</Label>
                  <Input
                    id="employerRef"
                    placeholder="123/AB12345"
                    value={employerRef}
                    onChange={(e) => setEmployerRef(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payPeriodStart">Pay Period Start *</Label>
                  <Input
                    id="payPeriodStart"
                    type="date"
                    value={payPeriodStart}
                    onChange={(e) => setPayPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payPeriodEnd">Pay Period End *</Label>
                  <Input
                    id="payPeriodEnd"
                    type="date"
                    value={payPeriodEnd}
                    onChange={(e) => setPayPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will submit payroll data to HMRC. Ensure all information is accurate before proceeding.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSubmitFPS}
                disabled={submitFPSMutation.isPending || !hmrcStatus?.connected}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitFPSMutation.isPending ? "Submitting to HMRC..." : "Submit FPS"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Guide Tab */}
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HMRC Integration Setup Guide</CardTitle>
              <CardDescription>
                Follow these steps to connect your payroll system with HMRC
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Register with HMRC Developer Hub</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Visit <a href="https://developer.service.hmrc.gov.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">HMRC Developer Hub</a> and create an account
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Create Application</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Register your application and subscribe to the RTI API
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Obtain Credentials</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get your Client ID, Client Secret, and set your Redirect URI to:
                    </p>
                    <code className="block mt-2 p-2 bg-muted rounded text-sm">
                      {window.location.origin}/api/hmrc/callback
                    </code>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold">Configure Environment</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Provide your HMRC credentials to complete the integration
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> Your HMRC credentials are stored securely and used only for RTI submissions.
                  Never share your Client Secret with unauthorized parties.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}