import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppContextProvider } from "@/contexts/app-context";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import EmailVerificationPage from "@/pages/email-verification-page";
import { SuperAdminAuth } from "@/pages/super-admin-auth";
import { CompanyLogin } from "@/pages/company-login";
import { CompanyManagement } from "@/pages/company-management";
import DashboardPage from "@/pages/dashboard-page";
import EmployeesPage from "@/pages/employees-page";
import AgenciesPage from "@/pages/agencies-page";
import TimesheetsPage from "@/pages/timesheets-page";
import InvoicesPage from "@/pages/invoices-page";
import PayrollPage from "@/pages/payroll-page";
import RTIBatchesPage from "@/pages/rti-batches-page";
import RemittanceOCRPage from "@/pages/remittance-ocr-page";
import HMRCPage from "@/pages/hmrc-page";
import ReportsPage from "@/pages/reports-page";
import SettingsPage from "@/pages/settings-page";
import SuperAdminSettings from "@/pages/super-admin-settings";
import MultiTenantDemo from "@/pages/multi-tenant-demo";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/employees" component={EmployeesPage} />
      <ProtectedRoute path="/agencies" component={AgenciesPage} />
      <ProtectedRoute path="/timesheets" component={TimesheetsPage} />
      <ProtectedRoute path="/invoices" component={InvoicesPage} />
      <ProtectedRoute path="/payroll" component={PayrollPage} />
      <ProtectedRoute path="/hmrc" component={HMRCPage} />
      <ProtectedRoute path="/rti-batches" component={RTIBatchesPage} />
      <ProtectedRoute path="/remittance-ocr" component={RemittanceOCRPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/super-admin-settings" component={SuperAdminSettings} />
      <ProtectedRoute path="/multi-tenant-demo" component={MultiTenantDemo} />
      <ProtectedRoute path="/company-management" component={CompanyManagement} />
      <Route path="/super-admin-auth" component={SuperAdminAuth} />
      <Route path="/company-login" component={CompanyLogin} />
      <Route path="/auth" component={AuthPage} />
      {/* <Route path="/verify-email" component={EmailVerificationPage} /> */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContextProvider>
              <Toaster />
              <Router />
            </AppContextProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
