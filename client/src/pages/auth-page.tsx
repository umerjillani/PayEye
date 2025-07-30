import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Building2, Users, Clock, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, companyLoginMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Redirect if already authenticated
  if (user) {
    return <Redirect to="/dashboard" />;
  }

  const onLogin = async (data: LoginForm) => {
    companyLoginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-neutral-800 dark:to-neutral-700 flex relative">
      {/* Left side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 pb-20">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center">
                <Eye className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-neutral-800 dark:text-white">Welcome to PayEYE</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">
              Multi-tenant payroll management system
            </p>
          </div>

          {/* Company Login Only - No Signup */}
          <Card>
            <CardHeader>
              <CardTitle>Sign in to your account</CardTitle>
              <CardDescription>
                Enter your company credentials provided by your system administrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    {...loginForm.register("username")}
                    placeholder="Enter your username"
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-red-600">{loginForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      {...loginForm.register("password")}
                      placeholder="Enter your password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-neutral-500" />
                      )}
                    </Button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={companyLoginMutation.isPending}
                >
                  {companyLoginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Company accounts are created by system administrators. 
                  Contact your PayEYE administrator if you need access credentials.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-500 text-white p-8 items-center justify-center">
        <div className="max-w-md text-center space-y-8">
          <div>
            <h2 className="text-4xl font-bold mb-4">Streamline Your Payroll</h2>
            <p className="text-xl text-primary-100">
              Comprehensive multi-tenant payroll management for agencies, employees, and timesheets
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Multi-Tenant</h3>
              <p className="text-sm text-primary-100">Manage multiple companies</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Employee Management</h3>
              <p className="text-sm text-primary-100">Complete employee profiles</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Timesheet Processing</h3>
              <p className="text-sm text-primary-100">OCR document processing</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Payment Batches</h3>
              <p className="text-sm text-primary-100">Automated payroll runs</p>
            </div>
          </div>

          <div className="text-sm text-primary-100">
            Trusted by payroll companies across the UK for efficient operations and compliance
          </div>
        </div>
      </div>
      
      {/* Footer with Super Admin Link */}
      <div className="absolute bottom-4 left-0 lg:left-4 right-0 lg:right-auto lg:w-1/2 text-center">
        <p className="text-sm text-muted-foreground">
          System Administrator? <a href="/super-admin-auth" className="text-primary hover:underline font-medium">Login here</a>
        </p>
      </div>
    </div>
  );
}