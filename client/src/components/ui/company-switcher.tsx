import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Badge } from './badge';
import { Building, ChevronDown, Users, Crown, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  companyName: string;
  contactEmail: string;
  active: boolean;
}

interface UserInfo {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'super_admin' | 'admin';
  currentCompanyId: string | null;
  accessibleCompanies: Company[];
  isSuperAdmin: boolean;
}

export function CompanySwitcher() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);

  // Fetch user info with multi-tenant context
  const { data: userInfo, isLoading } = useQuery<UserInfo>({
    queryKey: ['/api/user/info'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Switch company mutation
  const switchCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch('/api/user/switch-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to switch company');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data with new company context
      queryClient.invalidateQueries();
      setIsChanging(false);
      toast({
        title: "Company switched successfully",
        description: "All data now reflects the selected company",
      });
    },
    onError: (error: any) => {
      setIsChanging(false);
      toast({
        title: "Failed to switch company", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCompanySwitch = async (companyId: string) => {
    if (companyId === userInfo?.currentCompanyId) return;
    
    setIsChanging(true);
    switchCompanyMutation.mutate(companyId);
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 h-10 w-10"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userInfo) {
    return null;
  }

  const currentCompany = userInfo.accessibleCompanies.find(
    (company) => company.id === userInfo.currentCompanyId
  );

  return (
    <Card className="w-full max-w-md border-2 hover:border-blue-300 transition-all duration-300 hover:scale-102 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {userInfo.isSuperAdmin ? (
                <>
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Super Admin
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-blue-500" />
                  Admin
                </>
              )}
            </CardTitle>
            <CardDescription>
              {userInfo.firstName} {userInfo.lastName}
            </CardDescription>
          </div>
          <Badge variant={userInfo.isSuperAdmin ? "default" : "secondary"}>
            {userInfo.userType.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Current Company Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Company
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <div className="font-medium">{currentCompany?.companyName || 'No company selected'}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {currentCompany?.contactEmail}
              </div>
            </div>
          </div>

          {/* Company Switcher for Super Admins */}
          {userInfo.isSuperAdmin && userInfo.accessibleCompanies.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Switch Company
              </label>
              <Select
                value={userInfo.currentCompanyId || ''}
                onValueChange={handleCompanySwitch}
                disabled={isChanging || switchCompanyMutation.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a company">
                    {currentCompany?.companyName}
                  </SelectValue>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </SelectTrigger>
                <SelectContent>
                  {userInfo.accessibleCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{company.companyName}</div>
                          <div className="text-xs text-gray-500">{company.contactEmail}</div>
                        </div>
                        {company.id === userInfo.currentCompanyId && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Access Information */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Access Level:</span>
                <span className="font-medium">
                  {userInfo.isSuperAdmin ? 'All Companies' : 'Single Company'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Companies Available:</span>
                <span className="font-medium">{userInfo.accessibleCompanies.length}</span>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              isChanging || switchCompanyMutation.isPending 
                ? 'bg-yellow-500 animate-pulse' 
                : 'bg-green-500'
            }`} />
            <span className="text-gray-600 dark:text-gray-400">
              {isChanging || switchCompanyMutation.isPending 
                ? 'Switching company...' 
                : 'Ready'
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}