import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanySwitcher } from '@/components/ui/company-switcher';
import { 
  Shield, 
  Building, 
  Users, 
  Crown, 
  Lock, 
  UnlockIcon,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface UserInfo {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'super_admin' | 'admin';
  currentCompanyId: string | null;
  accessibleCompanies: any[];
  isSuperAdmin: boolean;
}

export default function MultiTenantDemo() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'companies' | 'access'>('overview');

  const { data: userInfo, isLoading } = useQuery<UserInfo>({
    queryKey: ['/api/user/info'],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/user/companies'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Loading Multi-Tenant System...</h1>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'companies', label: 'Company Management', icon: Building },
    { id: 'access', label: 'Access Control', icon: Shield },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-4xl font-bold">Multi-Tenant Access Control Demo</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          This demo showcases the difference between Super Admin and Regular Admin access levels. 
          Super admins can switch between companies while regular admins are restricted to their assigned company.
        </p>
      </div>

      {/* User Status Card */}
      <div className="flex justify-center">
        <CompanySwitcher />
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  selectedTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content based on selected tab */}
      <div className="space-y-6">
        {selectedTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* User Type Card */}
            <Card className="border-2 hover:border-blue-300 transition-all duration-300 hover:scale-102 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {userInfo?.isSuperAdmin ? (
                    <>
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Super Admin
                    </>
                  ) : (
                    <>
                      <Users className="h-5 w-5 text-blue-500" />
                      Regular Admin
                    </>
                  )}
                </CardTitle>
                <CardDescription>Your current access level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">User Type:</span>
                    <Badge variant={userInfo?.isSuperAdmin ? "default" : "secondary"}>
                      {userInfo?.userType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Company Access:</span>
                    <span className="text-sm font-medium">
                      {userInfo?.isSuperAdmin ? 'All Companies' : 'Single Company'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Switch Companies:</span>
                    {userInfo?.isSuperAdmin ? (
                      <UnlockIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Access Card */}
            <Card className="border-2 hover:border-blue-300 transition-all duration-300 hover:scale-102 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-500" />
                  Company Access
                </CardTitle>
                <CardDescription>Companies you can access</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Companies:</span>
                    <Badge variant="outline">
                      {userInfo?.accessibleCompanies.length || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Company:</span>
                    <span className="text-sm font-medium truncate max-w-32">
                      {userInfo?.accessibleCompanies.find(c => c.id === userInfo.currentCompanyId)?.companyName || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Can Switch:</span>
                    {userInfo?.isSuperAdmin && userInfo.accessibleCompanies.length > 1 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Card */}
            <Card className="border-2 hover:border-blue-300 transition-all duration-300 hover:scale-102 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Access Permissions
                </CardTitle>
                <CardDescription>What you can do</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>View company data</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Manage employees</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Process payroll</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {userInfo?.isSuperAdmin ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>Switch companies</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {userInfo?.isSuperAdmin ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>Access all company data</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === 'companies' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Company Management</h2>
              <p className="text-gray-600 dark:text-gray-400">
                {userInfo?.isSuperAdmin 
                  ? 'As a Super Admin, you can access and switch between all companies.'
                  : 'As a Regular Admin, you only have access to your assigned company.'
                }
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userInfo?.accessibleCompanies.map((company, index) => (
                <Card 
                  key={company.id} 
                  className={`border-2 transition-all duration-300 hover:scale-102 hover:shadow-lg ${
                    company.id === userInfo.currentCompanyId 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'hover:border-gray-300'
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-blue-500" />
                      {company.companyName}
                      {company.id === userInfo.currentCompanyId && (
                        <Badge variant="default" className="ml-auto">Current</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{company.contactEmail}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant={company.active ? "default" : "secondary"}>
                          {company.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Access Level:</span>
                        <span className="font-medium">
                          {userInfo.isSuperAdmin ? 'Full Access' : 'Assigned'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'access' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Access Control Matrix</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Comparison of Super Admin vs Regular Admin capabilities
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Super Admin Card */}
              <Card className="border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Crown className="h-5 w-5" />
                    Super Admin
                  </CardTitle>
                  <CardDescription>System-wide administrative access</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Access all companies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Switch between companies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Create new companies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Manage system settings</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>View all audit logs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Manage user roles</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Regular Admin Card */}
              <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Users className="h-5 w-5" />
                    Regular Admin
                  </CardTitle>
                  <CardDescription>Company-specific administrative access</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Access assigned company only</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span>Cannot switch companies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Manage company employees</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Process company payroll</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>View company audit logs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span>Limited user management</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current User Status */}
            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle className="text-center">Your Current Status</CardTitle>
                <CardDescription className="text-center">
                  Based on your user type: {userInfo?.userType.replace('_', ' ')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    {userInfo?.isSuperAdmin ? (
                      <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                        <Crown className="h-8 w-8 text-yellow-600" />
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                        <Users className="h-8 w-8 text-blue-600" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {userInfo?.firstName} {userInfo?.lastName}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{userInfo?.email}</p>
                  </div>
                  <Badge 
                    variant={userInfo?.isSuperAdmin ? "default" : "secondary"}
                    className="text-sm px-4 py-2"
                  >
                    {userInfo?.isSuperAdmin ? 'Super Admin Access' : 'Regular Admin Access'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}