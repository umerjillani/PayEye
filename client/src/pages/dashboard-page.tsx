import { useEffect } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useQuery } from "@tanstack/react-query";
import { Company } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DataTables } from "@/components/dashboard/data-tables";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { EmployeeModal } from "@/components/modals/employee-modal";
import { TimesheetUploadModal } from "@/components/modals/timesheet-upload-modal";

export default function DashboardPage() {
  const { selectedCompany, setSelectedCompany } = useAppContext();
  const { user } = useAuth();

  // Use different API endpoint based on user type
  const companiesEndpoint = user?.userType === 'super_admin' 
    ? "/api/super-admin/companies" 
    : "/api/companies";

  const { data: companies } = useQuery<Company[]>({
    queryKey: [companiesEndpoint],
  });

  // Auto-select first company if none selected
  useEffect(() => {
    if (!selectedCompany && companies && companies.length > 0) {
      setSelectedCompany(companies[0]);
    }
  }, [companies, selectedCompany, setSelectedCompany]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background transition-colors duration-200">
      <Sidebar />
      <Header
        title="Dashboard"
        description="Welcome back, manage your payroll operations"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-8">
          {/* Metrics Cards */}
          <MetricsCards />
          
          {/* Quick Actions and Recent Activity */}
          <div className="space-y-6">
            <QuickActions />
            <RecentActivity />
          </div>
          
          {/* Data Tables */}
          <DataTables />
        </div>
      </div>

      {/* Modals */}
      <CompanySelectorModal />
      <EmployeeModal />
      <TimesheetUploadModal />
    </div>
  );
}
