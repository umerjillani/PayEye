import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, FileText, Upload, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "@/contexts/app-context";
import { Skeleton } from "@/components/ui/skeleton";

interface Activity {
  id: string;
  type: string;
  user?: string;
  employee?: string;
  agency?: string;
  invoiceNumber?: string;
  timestamp: string;
  icon: string;
  color: string;
}

export function RecentActivity() {
  const { selectedCompany } = useAppContext();

  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/dashboard/activity", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "check":
        return Check;
      case "file-invoice-dollar":
        return FileText;
      case "upload":
        return Upload;
      case "user-plus":
        return UserPlus;
      default:
        return FileText;
    }
  };

  const getIconBgColor = (color: string) => {
    switch (color) {
      case "success":
        return "bg-success bg-opacity-10";
      case "primary":
        return "bg-primary-100";
      case "warning":
        return "bg-warning bg-opacity-10";
      case "purple":
        return "bg-purple-100";
      default:
        return "bg-neutral-100 dark:bg-neutral-600";
    }
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case "success":
        return "text-success";
      case "primary":
        return "text-primary-500";
      case "warning":
        return "text-warning";
      case "purple":
        return "text-purple-600";
      default:
        return "text-neutral-500";
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case "timesheet_approved":
        return (
          <>
            <span className="font-medium">{activity.user}</span> approved timesheet for{" "}
            <span className="font-medium">{activity.employee}</span>
          </>
        );
      case "invoice_generated":
        return (
          <>
            Invoice #{activity.invoiceNumber} generated for{" "}
            <span className="font-medium">{activity.agency}</span>
          </>
        );
      case "timesheet_uploaded":
        return (
          <>
            New timesheet uploaded by{" "}
            <span className="font-medium">{activity.user}</span>
          </>
        );
      case "employee_added":
        return (
          <>
            New employee{" "}
            <span className="font-medium">{activity.employee}</span> added to{" "}
            <span className="font-medium">{activity.agency}</span>
          </>
        );
      default:
        return "Unknown activity";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" className="text-primary-500 hover:text-primary-600">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities?.map((activity) => {
            const IconComponent = getIcon(activity.icon);
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-8 h-8 ${getIconBgColor(activity.color)} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <IconComponent className={`w-4 h-4 ${getIconColor(activity.color)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
