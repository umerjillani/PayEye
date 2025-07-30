import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Company } from "@shared/schema";
import { useAppContext } from "@/contexts/app-context";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function CompanySelectorModal() {
  const { selectedCompany, setSelectedCompany } = useAppContext();
  const { user } = useAuth();
  
  // This modal should never be shown for regular company admins
  if (user?.userType !== 'super_admin') {
    return null;
  }
  
  // Use different API endpoint based on user type
  const companiesEndpoint = user?.userType === 'super_admin' 
    ? "/api/super-admin/companies" 
    : "/api/companies";
  
  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: [companiesEndpoint],
    enabled: false, // Disabled for now since we don't use this modal
  });

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setShowCompanySelector(false);
  };

  const getCompanyInitials = (companyName: string) => {
    return companyName
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Since we're removing company switching for regular admins, just return null
  return null;
  
  // Original code below (kept for reference but never executed)
  return (
    <Dialog open={false} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Company</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {companies?.map((company) => (
              <Button
                key={company.id}
                variant="outline"
                className="w-full p-4 h-auto justify-start hover:bg-primary-50 dark:hover:bg-neutral-600"
                onClick={() => handleSelectCompany(company)}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: company.primaryColor }}
                  >
                    {getCompanyInitials(company.companyName)}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-neutral-800 dark:text-white">
                      {company.companyName}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      {company.subdomainSlug}.payeye.com
                    </div>
                  </div>
                  {selectedCompany?.id === company.id && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-success rounded-full"></div>
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
