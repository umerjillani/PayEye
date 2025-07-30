import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileText, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "@/contexts/app-context";
import { Skeleton } from "@/components/ui/skeleton";

interface Metrics {
  pendingTimesheets: number;
  outstandingInvoices: string;
  monthlyRevenue: string;
  activeEmployees: number;
  totalAgencies: number;
  overdueInvoices: number;
}

export function MetricsCards() {
  const { selectedCompany } = useAppContext();
  
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ["/api/dashboard/metrics", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <div className="mt-4">
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricsData = [
    {
      title: "Pending Timesheets",
      value: metrics?.pendingTimesheets?.toString() || "0",
      icon: Clock,
      bgColor: "bg-warning",
      change: "Awaiting approval",
      changeColor: "text-warning",
    },
    {
      title: "Outstanding Invoices",
      value: metrics?.outstandingInvoices || "£0",
      icon: FileText,
      bgColor: "bg-error",
      change: `${metrics?.overdueInvoices || 0} overdue`,
      changeColor: "text-error",
    },
    {
      title: "Monthly Revenue",
      value: metrics?.monthlyRevenue || "£0",
      icon: TrendingUp,
      bgColor: "bg-success",
      change: "From approved timesheets",
      changeColor: "text-success",
    },
    {
      title: "Active Employees",
      value: metrics?.activeEmployees?.toString() || "0",
      icon: Users,
      bgColor: "bg-primary-500",
      change: `Across ${metrics?.totalAgencies || 0} agencies`,
      changeColor: "text-neutral-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricsData.map((metric, index) => (
        <Card key={index} className="border-border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {metric.title}
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {metric.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                metric.bgColor === 'bg-warning' ? 'bg-orange-100' :
                metric.bgColor === 'bg-error' ? 'bg-red-100' :
                metric.bgColor === 'bg-success' ? 'bg-green-100' :
                'bg-blue-100'
              }`}>
                <metric.icon className={`w-5 h-5 ${
                  metric.bgColor === 'bg-warning' ? 'text-orange-600' :
                  metric.bgColor === 'bg-error' ? 'text-red-600' :
                  metric.bgColor === 'bg-success' ? 'text-green-600' :
                  'text-blue-600'
                }`} />
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-xs font-medium ${metric.changeColor}`}>
                {metric.change}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
