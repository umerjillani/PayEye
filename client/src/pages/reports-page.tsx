import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/calendar";
import { CompanySelectorModal } from "@/components/modals/company-selector-modal";
import { BarChart, FileText, Download, Calendar, Filter, TrendingUp, Users, DollarSign, Clock } from "lucide-react";

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState("payroll");
  const [dateRange, setDateRange] = useState("month");

  const reportTypes = [
    {
      id: "payroll",
      title: "Payroll Report",
      description: "Employee payments and deductions",
      icon: DollarSign,
    },
    {
      id: "timesheet",
      title: "Timesheet Report",
      description: "Hours worked and time tracking",
      icon: Clock,
    },
    {
      id: "tax",
      title: "Tax Report",
      description: "PAYE, NI, and tax calculations",
      icon: FileText,
    },
    {
      id: "agency",
      title: "Agency Report",
      description: "Agency performance and billing",
      icon: TrendingUp,
    },
    {
      id: "employee",
      title: "Employee Report",
      description: "Employee statistics and analysis",
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Reports"
        description="Generate and export business reports"
      />
      
      <div className="ml-64 p-6">
        <div className="space-y-6">
          {/* Report Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((report) => (
              <Card
                key={report.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                  selectedReport === report.id
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-700"
                    : ""
                }`}
                onClick={() => setSelectedReport(report.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedReport === report.id
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300"
                    }`}>
                      <report.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-neutral-800 dark:text-white">
                        {report.title}
                      </h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Report Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Date Range
                  </label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Format
                  </label>
                  <Select defaultValue="pdf">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Include
                  </label>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Data</SelectItem>
                      <SelectItem value="summary">Summary Only</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Report Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-64 bg-neutral-100 dark:bg-neutral-600 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-4" />
                      <p className="text-neutral-500 dark:text-neutral-400">
                        Report preview will appear here
                      </p>
                    </div>
                  </div>
                  
                  {/* Sample Data Table */}
                  <div className="border border-neutral-200 dark:border-neutral-600 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-neutral-50 dark:bg-neutral-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            Employee
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            Gross Pay
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            Net Pay
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            Tax
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-600">
                        {/* Sample rows would be populated with actual data */}
                        <tr>
                          <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">
                            No data available
                          </td>
                          <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">-</td>
                          <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">-</td>
                          <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Monthly Summary
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Employee List
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Payroll Summary
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Clock className="w-4 h-4 mr-2" />
                  Timesheet Report
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Financial Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CompanySelectorModal />
    </div>
  );
}
