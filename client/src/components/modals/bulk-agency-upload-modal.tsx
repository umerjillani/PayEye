import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, FileText, Building2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface BulkAgencyUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProcessingResult {
  success: number;
  failed: number;
  errors: string[];
  processedAgencies: any[];
}

export function BulkAgencyUploadModal({ isOpen, onClose }: BulkAgencyUploadModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProcessingResult(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setProcessingResult(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processBulkAgencyUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressText("Starting upload...");
    
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);

      // Simulate progressive loading states
      setProgress(10);
      setProgressText("Uploading document...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(30);
      setProgressText("Extracting agency data...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(60);
      setProgressText("Processing agency records with AI...");

      const response = await fetch('/api/upload/bulk-agencies', {
        method: 'POST',
        body: formData,
      });

      setProgress(90);
      setProgressText("Finalizing results...");

      const result = await response.json();
      
      setProgress(100);
      setProgressText("Complete!");
      
      if (result.success && result.processedAgencies) {
        setProcessingResult({
          success: result.processedAgencies.length,
          failed: result.failed || 0,
          errors: result.errors || [],
          processedAgencies: result.processedAgencies
        });
        
        // Invalidate agencies cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
        
        toast({
          title: "Bulk Upload Complete",
          description: `Successfully processed ${result.processedAgencies.length} agency record(s)`,
          className: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
        });
      } else {
        setProcessingResult({
          success: 0,
          failed: result.failed || 1,
          errors: result.errors || [result.error || "Failed to process agency data"],
          processedAgencies: []
        });
        
        toast({
          title: "Processing Issues",
          description: result.error || "Some agency records could not be processed",
          className: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        });
      }
    } catch (error) {
      console.error('Error uploading bulk agencies:', error);
      setProcessingResult({
        success: 0,
        failed: 1,
        errors: ["Network error occurred during upload"],
        processedAgencies: []
      });
      
      toast({
        title: "Upload Failed",
        description: "Network error occurred. Please try again.",
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setProgress(0);
    setProgressText("");
    setProcessingResult(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Bulk Agency Upload
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file containing agency information to create multiple agency records at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          {!processingResult && (
            <Card className="transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-6">
                <div
                  className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <CloudUpload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-800 dark:text-white mb-2">
                    Upload Agency File
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-300 mb-4">
                    Drag and drop your file here, or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="bulk-agency-file"
                  />
                  <label htmlFor="bulk-agency-file">
                    <Button variant="outline" className="cursor-pointer" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>
                  {selectedFile && (
                    <div className="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg font-medium text-neutral-800 dark:text-white">
                      {progressText}
                    </span>
                  </div>
                  <Progress value={progress} className="w-full" />
                  <div className="text-sm text-neutral-600 dark:text-neutral-300">
                    {progress}% Complete
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {processingResult && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {processingResult.success > 0 ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    )}
                    <h3 className="text-lg font-semibold text-neutral-800 dark:text-white">
                      Processing Complete
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {processingResult.success}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Successfully Processed
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-3 rounded">
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {processingResult.failed}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">
                        Failed to Process
                      </div>
                    </div>
                  </div>

                  {processingResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
                        Errors:
                      </h4>
                      <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                        {processingResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {processingResult.processedAgencies.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-medium text-neutral-800 dark:text-white mb-3">
                      Successfully Created Agencies:
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {processingResult.processedAgencies.map((agency, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 bg-neutral-50 dark:bg-neutral-800 rounded"
                        >
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <div className="flex-1">
                            <div className="font-medium text-neutral-800 dark:text-white">
                              {agency.agencyName}
                            </div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-300">
                              {agency.payRateType} • {agency.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* How It Works */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-white mb-3">
                How it works
              </h3>
              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                <p>• Upload an Excel (.xlsx, .xls) or CSV file containing agency information</p>
                <p>• The system automatically extracts and processes agency data using AI</p>
                <p>• Agency records are created with complete details including contact information, pay rates, and banking details</p>
                <p>• Supported fields: Agency Name, Contact Person, Email, Phone, Address, Pay Rate Type, VAT Details, Banking Information, and more</p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Button variant="outline" onClick={handleClose}>
              {processingResult ? "Close" : "Cancel"}
            </Button>
            {selectedFile && !processingResult && (
              <Button onClick={processBulkAgencyUpload} disabled={isProcessing}>
                <Building2 className="w-4 h-4 mr-2" />
                Process Agencies
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}