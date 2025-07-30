import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Users, 
  Shield, 
  Settings, 
  Database, 
  Plus, 
  Edit, 
  Trash2, 
  Crown,
  Key,
  Server,
  Monitor,
  AlertTriangle
} from "lucide-react";

interface Company {
  id: string;
  companyName: string;
  contactEmail: string;
  username: string;
  active: boolean;
  createdAt: string;
}

interface CompanyFormData {
  companyName: string;
  contactEmail: string;
  username: string;
  password: string;
}

interface SystemSettings {
  maxFileSize: number;
  allowedFileTypes: string[];
  sessionTimeout: number;
  enableBackups: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  const [companyFormData, setCompanyFormData] = useState<CompanyFormData>({
    companyName: "",
    contactEmail: "",
    username: "",
    password: ""
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    maxFileSize: 1024,
    allowedFileTypes: ['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'png'],
    sessionTimeout: 60,
    enableBackups: true,
    backupFrequency: 'daily'
  });

  // Fetch companies
  const { data: companies, isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/super-admin/companies"],
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyFormData) => apiRequest("POST", "/api/super-admin/companies", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      setIsCreateDialogOpen(false);
      resetCompanyForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompanyFormData> }) => 
      apiRequest("PUT", `/api/super-admin/companies/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
      setEditingCompany(null);
      resetCompanyForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/super-admin/companies/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/companies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const resetCompanyForm = () => {
    setCompanyFormData({
      companyName: "",
      contactEmail: "",
      username: "",
      password: ""
    });
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate(companyFormData);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyFormData({
      companyName: company.companyName,
      contactEmail: company.contactEmail,
      username: company.username,
      password: ""
    });
  };

  const handleUpdateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      updateCompanyMutation.mutate({
        id: editingCompany.id,
        data: companyFormData
      });
    }
  };

  const handleDeleteCompany = (id: string, companyName: string) => {
    if (confirm(`Are you sure you want to delete "${companyName}"? This action cannot be undone and will remove all associated data.`)) {
      deleteCompanyMutation.mutate(id);
    }
  };

  const handleSaveSystemSettings = () => {
    toast({
      title: "Settings Saved",
      description: "System settings have been updated successfully",
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <Sidebar />
      <Header
        title="Super Admin Settings"
        description="Manage system configuration, companies, and administrative settings"
      />
      
      <div className="ml-64 p-6">
        <div className="max-w-6xl">
          <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <Crown className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              You are logged in as a Super Administrator with full system access. Use these settings carefully.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="companies" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="companies">
                <Building2 className="w-4 h-4 mr-2" />
                Company Management
              </TabsTrigger>
              <TabsTrigger value="system">
                <Server className="w-4 h-4 mr-2" />
                System Settings
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="monitoring">
                <Monitor className="w-4 h-4 mr-2" />
                Monitoring
              </TabsTrigger>
            </TabsList>

            {/* Company Management Tab */}
            <TabsContent value="companies" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Company Management
                      </CardTitle>
                      <CardDescription>
                        Create, edit, and manage company accounts. Each company gets their own login credentials.
                      </CardDescription>
                    </div>
                    
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add Company
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Company</DialogTitle>
                          <DialogDescription>
                            Add a new company and assign their login credentials
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateCompany} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                              id="companyName"
                              value={companyFormData.companyName}
                              onChange={(e) => setCompanyFormData(prev => ({ ...prev, companyName: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contactEmail">Contact Email</Label>
                            <Input
                              id="contactEmail"
                              type="email"
                              value={companyFormData.contactEmail}
                              onChange={(e) => setCompanyFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="username">Username (Login)</Label>
                            <Input
                              id="username"
                              value={companyFormData.username}
                              onChange={(e) => setCompanyFormData(prev => ({ ...prev, username: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              value={companyFormData.password}
                              onChange={(e) => setCompanyFormData(prev => ({ ...prev, password: e.target.value }))}
                              required
                            />
                          </div>
                          <Button 
                            type="submit" 
                            className="w-full"
                            disabled={createCompanyMutation.isPending}
                          >
                            {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCompanies ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading companies...</p>
                    </div>
                  ) : companies?.length === 0 ? (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No companies created yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Create your first company to get started
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {companies?.map((company) => (
                        <div key={company.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold">{company.companyName}</h3>
                                <Badge variant={company.active ? "default" : "secondary"}>
                                  {company.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div>
                                  <span className="font-medium">Email:</span> {company.contactEmail}
                                </div>
                                <div>
                                  <span className="font-medium">Username:</span> {company.username}
                                </div>
                                <div>
                                  <span className="font-medium">Created:</span> {new Date(company.createdAt).toLocaleDateString()}
                                </div>
                                <div>
                                  <span className="font-medium">ID:</span> {company.id}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCompany(company)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCompany(company.id, company.companyName)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* System Settings Tab */}
            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure global system settings and file upload limits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="maxFileSize">Maximum File Size (MB)</Label>
                      <Input
                        id="maxFileSize"
                        type="number"
                        value={systemSettings.maxFileSize}
                        onChange={(e) => setSystemSettings(prev => ({ 
                          ...prev, 
                          maxFileSize: parseInt(e.target.value) 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={systemSettings.sessionTimeout}
                        onChange={(e) => setSystemSettings(prev => ({ 
                          ...prev, 
                          sessionTimeout: parseInt(e.target.value) 
                        }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Allowed File Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'png', 'docx', 'doc'].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Switch
                            checked={systemSettings.allowedFileTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              setSystemSettings(prev => ({
                                ...prev,
                                allowedFileTypes: checked 
                                  ? [...prev.allowedFileTypes, type]
                                  : prev.allowedFileTypes.filter(t => t !== type)
                              }));
                            }}
                          />
                          <Label className="text-sm">{type.toUpperCase()}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Automatic Backups</Label>
                        <p className="text-sm text-muted-foreground">Automatically backup system data</p>
                      </div>
                      <Switch
                        checked={systemSettings.enableBackups}
                        onCheckedChange={(checked) => setSystemSettings(prev => ({ 
                          ...prev, 
                          enableBackups: checked 
                        }))}
                      />
                    </div>

                    {systemSettings.enableBackups && (
                      <div className="space-y-2">
                        <Label>Backup Frequency</Label>
                        <Select
                          value={systemSettings.backupFrequency}
                          onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                            setSystemSettings(prev => ({ ...prev, backupFrequency: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleSaveSystemSettings}>
                    Save System Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Manage security policies and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Strong Passwords</Label>
                        <p className="text-sm text-muted-foreground">Enforce password complexity requirements</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Require 2FA for all admin accounts</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-logout Inactive Sessions</Label>
                        <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">Log all administrative actions</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">API Access</h3>
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">Master API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="apiKey"
                          type="password"
                          value="sk-proj-••••••••••••••••••••••••••••••••••••••••"
                          readOnly
                        />
                        <Button variant="outline">
                          <Key className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      System Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Database</span>
                      <Badge className="bg-green-100 text-green-800">Online</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>File Storage</span>
                      <Badge className="bg-green-100 text-green-800">Online</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>OCR Service</span>
                      <Badge className="bg-green-100 text-green-800">Online</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Email Service</span>
                      <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Usage Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Companies</span>
                      <span className="font-semibold">{companies?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Sessions</span>
                      <span className="font-semibold">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Files Processed Today</span>
                      <span className="font-semibold">47</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage Used</span>
                      <span className="font-semibold">2.3 GB</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Company "Demo Company Ltd" created by super admin</span>
                      <span className="text-muted-foreground ml-auto">2 hours ago</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>System backup completed successfully</span>
                      <span className="text-muted-foreground ml-auto">6 hours ago</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>Failed login attempt for company admin "acme"</span>
                      <span className="text-muted-foreground ml-auto">1 day ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Company Dialog */}
      {editingCompany && (
        <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
              <DialogDescription>
                Update company information and credentials
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-companyName">Company Name</Label>
                <Input
                  id="edit-companyName"
                  value={companyFormData.companyName}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactEmail">Contact Email</Label>
                <Input
                  id="edit-contactEmail"
                  type="email"
                  value={companyFormData.contactEmail}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username (Login)</Label>
                <Input
                  id="edit-username"
                  value={companyFormData.username}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={companyFormData.password}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={updateCompanyMutation.isPending}
              >
                {updateCompanyMutation.isPending ? "Updating..." : "Update Company"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}