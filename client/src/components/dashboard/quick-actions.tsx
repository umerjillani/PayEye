import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Upload, FileText, CreditCard } from "lucide-react";
import { useAppContext } from "@/contexts/app-context";

export function QuickActions() {
  const { setShowEmployeeModal, setShowTimesheetUploadModal } = useAppContext();

  const actions = [
    {
      title: "Add Employee",
      description: "Create new employee record",
      icon: UserPlus,
      bgColor: "bg-primary-100",
      iconColor: "text-primary-500",
      onClick: () => setShowEmployeeModal(true),
    },
    {
      title: "Upload Timesheet",
      description: "Process document with OCR",
      icon: Upload,
      bgColor: "bg-secondary-100",
      iconColor: "text-secondary-500",
      onClick: () => setShowTimesheetUploadModal(true),
    },
    {
      title: "Generate Invoices",
      description: "Create invoices from timesheets",
      icon: FileText,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      onClick: () => console.log("Generate invoices"),
    },
    {
      title: "Process Payroll",
      description: "Generate payslips and payments",
      icon: CreditCard,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      onClick: () => console.log("Process payroll"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 text-left justify-start transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
              onClick={action.onClick}
            >
              <div className="flex items-start space-x-3 w-full">
                <div className={`w-8 h-8 ${action.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <action.icon className={`w-4 h-4 ${action.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground text-sm">
                    {action.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {action.description}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
