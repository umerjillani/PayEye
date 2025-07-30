import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  BarChart3, 
  Building2, 
  Users, 
  Clock, 
  FileText, 
  CreditCard, 
  Settings, 
  LogOut,
  Eye,
  ScanText,
  Shield,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAppContext } from "@/contexts/app-context";
import { useQuery } from "@tanstack/react-query";

interface NavigationItem {
  title: string;
  href: string;
  icon: any;
  badge?: string | null;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

// Bottom navigation items based on user type
const getBottomNavigationItems = (userType?: string): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
    {
      title: "Multi-Tenant Demo",
      href: "/multi-tenant-demo",
      icon: Shield,
      badge: "NEW",
      badgeVariant: "default" as const,
    }
  ];

  if (userType === 'super_admin') {
    return [
      ...baseItems,
      {
        title: "Super Admin Settings",
        href: "/super-admin-settings",
        icon: Settings,
        badge: "Admin",
        badgeVariant: "secondary" as const,
      }
    ];
  } else {
    return [
      ...baseItems,
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        badge: null,
        badgeVariant: "secondary" as const,
      }
    ];
  }
};

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { selectedCompany } = useAppContext();

  // Fetch real-time counts for sidebar badges
  const { data: sidebarMetrics } = useQuery<{
    agencies: number;
    employees: number;
    timesheets: number;
    pendingTimesheets: number;
    invoices: number;
    pendingInvoices: number;
    payroll: number;
  }>({
    queryKey: ["/api/sidebar/metrics", selectedCompany?.id],
    enabled: !!selectedCompany?.id,
  });

  // Calculate counts from API response
  const agenciesCount = sidebarMetrics?.agencies || 0;
  const employeesCount = sidebarMetrics?.employees || 0;
  const timesheetsCount = sidebarMetrics?.timesheets || 0;
  const pendingTimesheetsCount = sidebarMetrics?.pendingTimesheets || 0;
  const invoicesCount = sidebarMetrics?.invoices || 0;
  const payrollCount = sidebarMetrics?.payroll || 0;

  // Super admin navigation items
  const superAdminItems: NavigationItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: BarChart3,
    },
    {
      title: "Company Management",
      href: "/company-management",
      icon: Building2,
      badge: "Admin",
      badgeVariant: "secondary",
    },
  ];

  // Regular admin navigation items with real-time data
  const regularAdminItems: NavigationItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: BarChart3,
    },
    {
      title: "Agencies",
      href: "/agencies",
      icon: Building2,
      badge: agenciesCount > 0 ? agenciesCount.toString() : null,
      badgeVariant: "secondary",
    },
    {
      title: "Employees",
      href: "/employees",
      icon: Users,
      badge: employeesCount > 0 ? employeesCount.toString() : null,
      badgeVariant: "secondary",
    },
    {
      title: "Timesheets",
      href: "/timesheets",
      icon: Clock,
      badge: pendingTimesheetsCount > 0 ? pendingTimesheetsCount.toString() : null,
      badgeVariant: "secondary",
    },
    {
      title: "Invoices",
      href: "/invoices",
      icon: FileText,
      badge: invoicesCount > 0 ? invoicesCount.toString() : null,
      badgeVariant: "secondary",
    },
    {
      title: "Payroll",
      href: "/payroll",
      icon: CreditCard,
      badge: payrollCount > 0 ? payrollCount.toString() : null,
      badgeVariant: "secondary",
    },
    {
      title: "HMRC RTI",
      href: "/hmrc",
      icon: ExternalLink,
      badge: "NEW",
      badgeVariant: "default",
    },
    {
      title: "RTI Batches",
      href: "/rti-batches",
      icon: Eye,
    },
    {
      title: "Remittance OCR",
      href: "/remittance-ocr",
      icon: ScanText,
      badge: "AI",
      badgeVariant: "secondary",
    },
  ];

  // Determine user type safely
  const userType = (user as any)?.userType;
  const isSuperAdmin = userType === 'super_admin';
  
  // Choose navigation items based on user type
  const navigationItems = isSuperAdmin ? superAdminItems : regularAdminItems;
  const bottomNavigationItems = getBottomNavigationItems(userType);

  const getUserInitials = () => {
    if (!user) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-[hsl(var(--sidebar-background))] z-40">
      <div className="p-6">
        {/* Logo and Company */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-xl text-foreground">PayEYE</div>
            <div className="text-xs text-muted-foreground">
              {selectedCompany?.companyName || "Select Company"}
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start px-3 py-2 h-auto",
                    isActive 
                      ? "bg-secondary text-primary" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.title}</span>
                  {item.badge && (
                    <Badge 
                      variant={item.badgeVariant || "secondary"} 
                      className="ml-auto text-xs px-2 py-1"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
          
          <div className="pt-4 mt-4">
            {bottomNavigationItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start px-3 py-2 h-auto",
                      isActive 
                        ? "bg-secondary text-primary" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.title}</span>
                    {item.badge && (
                      <Badge 
                        variant={item.badgeVariant || "secondary"} 
                        className="ml-auto text-xs px-2 py-1"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      
      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="bg-secondary rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {user ? `${user.firstName} ${user.lastName}` : "Unknown User"}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {(user as any)?.role || userType || "User"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="p-1 h-auto text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
