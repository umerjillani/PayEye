import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationPageProps {
  userId?: number;
  email?: string;
}

export default function EmailVerificationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  
  // Get verification data from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const userId = parseInt(urlParams.get('userId') || localStorage.getItem('pendingUserId') || '0');
  const email = urlParams.get('email') || localStorage.getItem('pendingUserEmail') || '';

  useEffect(() => {
    if (!userId || !email) {
      setLocation("/auth");
      return;
    }

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [userId, email, setLocation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/verify-email", {
        userId,
        otp: otp.trim(),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Email verified successfully! Welcome to PayEYE.",
        });
        
        // Clear pending verification data
        localStorage.removeItem('pendingUserId');
        localStorage.removeItem('pendingUserEmail');
        
        // Redirect to dashboard
        setLocation("/");
      } else {
        setError(result.error || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/resend-otp", { userId });
      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Code Sent",
          description: "A new verification code has been sent to your email.",
        });
        setTimeLeft(900); // Reset timer to 15 minutes
        setOtp(""); // Clear current OTP input
      } else {
        setError(result.error || "Failed to resend code");
      }
    } catch (error) {
      console.error("Resend error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    if (error) setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Verify Your Email
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              We've sent a 6-digit verification code to
            </p>
            <p className="font-semibold text-blue-600 dark:text-blue-400">
              {email}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Verification Code
                </label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={handleOTPChange}
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Enter the 6-digit code from your email
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isVerifying || otp.length !== 6}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>

            <div className="text-center space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {timeLeft > 0 ? (
                  <>Code expires in <span className="font-mono font-semibold">{formatTime(timeLeft)}</span></>
                ) : (
                  <span className="text-red-600 dark:text-red-400">Code has expired</span>
                )}
              </div>

              <div className="flex flex-col space-y-2">
                <Button
                  variant="outline"
                  onClick={handleResendOTP}
                  disabled={isResending || timeLeft > 840} // Allow resend only after 1 minute
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend Code"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setLocation("/auth")}
                  className="text-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}