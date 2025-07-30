import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProcessingResult {
  success: boolean;
  message: string;
  agency: string;
  paymentsCreated: number;
  totalRecords: number;
  ocrData?: any;
  payments: any[];
}

export default function RemittanceOCRPage() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 
        'image/png',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      const fileExtension = selectedFile.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'csv'];
      
      if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension || '')) {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF, Excel (.xlsx/.xls), CSV, or image (JPEG/PNG) file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
      setResults(null);
      setError(null);
    }
  };

  const processRemittance = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await apiRequest("POST", "/api/upload-remittance", formData);

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }

      let result: ProcessingResult;
      try {
        result = await response.json();
      } catch (jsonError) {
        const responseText = await response.text();
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
      setResults(result);

      toast({
        title: "Processing complete",
        description: `Successfully processed ${result.paymentsCreated} payments from ${result.agency}`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResults(null);
    setError(null);
    setProgress(0);
    // Reset file input
    const fileInput = document.getElementById('remittance-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800 transition-colors duration-200">
      <Sidebar />
      <div className="ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Remittance OCR Processing</h1>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            AI-Powered Document Processing
          </Badge>
        </div>
        <div className="space-y-6">

      <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload Remittance Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors duration-200">
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Upload Document for Processing
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select PDF, Excel (.xlsx/.xls), JPEG, or PNG file (max 1GB)
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => document.getElementById('remittance-file')?.click()}
                    disabled={processing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-base font-medium"
                    size="lg"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Choose File
                  </Button>
                  
                  <input
                    id="remittance-file"
                    type="file"
                    accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.pdf"
                    onChange={handleFileSelect}
                    disabled={processing}
                    className="hidden"
                  />
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Supported formats: PDF, Excel, CSV, JPEG, PNG
                  </p>
                </div>
              </div>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}

          {processing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 animate-spin" />
                Processing document with AI...
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={processRemittance}
              disabled={!file || processing}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {processing ? "Processing..." : "Process Remittance"}
            </Button>

            {(file || results || error) && (
              <Button variant="outline" onClick={resetForm} disabled={processing}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Processing Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card className="border-green-200 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {results.paymentsCreated}
                </div>
                <div className="text-sm text-green-600">Payments Created</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {results.totalRecords}
                </div>
                <div className="text-sm text-blue-600">Records Processed</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-700 truncate">
                  {results.agency}
                </div>
                <div className="text-sm text-purple-600">Agency</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">
                  {Math.round((results.paymentsCreated / results.totalRecords) * 100)}%
                </div>
                <div className="text-sm text-yellow-600">Success Rate</div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Processing Summary</h4>
              <p className="text-sm text-gray-600">{results.message}</p>
            </div>

            {results.ocrData && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold mb-3">Extracted Records ({results.ocrData.records?.length || 0})</h4>
                  <div className="grid gap-3 max-h-64 overflow-y-auto">
                    {results.ocrData.records?.slice(0, 5).map((record: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><strong>Person:</strong> {record["Person Name"] || "N/A"}</div>
                          <div><strong>Agency:</strong> {record["Agency"] || "N/A"}</div>
                          <div><strong>Gross Pay:</strong> £{record["Gross Pay"] || "0"}</div>
                          <div><strong>Hours:</strong> {record["Hours charged"] || "N/A"}</div>
                          <div><strong>Rate:</strong> £{record["Pay Rate"] || "N/A"}/hr</div>
                          <div><strong>Shift:</strong> {record["Shift details"] || "N/A"}</div>
                        </div>
                      </div>
                    ))}
                    {(results.ocrData.records?.length || 0) > 5 && (
                      <div className="text-center text-sm text-gray-500">
                        ... and {(results.ocrData.records?.length || 0) - 5} more records
                      </div>
                    )}
                  </div>
                </div>
                
                {Object.keys(results.ocrData).filter(key => key !== 'records').map(summaryKey => (
                  <div key={summaryKey} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold mb-2">Summary - {summaryKey}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(results.ocrData[summaryKey] || {}).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong> {typeof value === 'number' ? `£${value}` : String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                <details className="bg-gray-50 border rounded-lg">
                  <summary className="p-3 cursor-pointer font-medium">View Raw JSON Data</summary>
                  <pre className="text-xs bg-white p-3 m-3 rounded border overflow-auto max-h-64">
                    {JSON.stringify(results.ocrData, null, 2)}
                  </pre>
                </details>
              </div>
            )}
            
            {results.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Created Payments</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {results.payments.slice(0, 5).map((payment, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-sm font-medium">Payment #{payment.id.slice(-6)}</span>
                      <span className="text-sm text-gray-600">£{payment.amount}</span>
                      <Badge variant="secondary" className="text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                  {results.payments.length > 5 && (
                    <div className="text-center text-sm text-gray-500">
                      ... and {results.payments.length - 5} more payments
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-medium">1. Upload Document</h4>
              <p className="text-sm text-gray-600">
                Upload your remittance PDF or image file
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium">2. AI Processing</h4>
              <p className="text-sm text-gray-600">
                AI extracts structured data from your document
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-medium">3. Auto-Create Records</h4>
              <p className="text-sm text-gray-600">
                Payments automatically saved to database
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}