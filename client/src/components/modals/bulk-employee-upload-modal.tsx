import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, FileText, Users, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface BulkEmployeeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProcessingResult {
  success: number;
  failed: number;
  errors: string[];
  processedEmployees: any[];
}

export function BulkEmployeeUploadModal({ isOpen, onClose }: BulkEmployeeUploadModalProps) {
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

  const processBulkEmployeeUpload = async () => {
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
      setProgressText("Extracting employee data...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(60);
      setProgressText("Processing employee records with AI...");

      const response = await fetch('/api/upload/bulk-employees', {
        method: 'POST',
        body: formData,
      });

      setProgress(90);
      setProgressText("Finalizing results...");

      const result = await response.json();
      
      setProgress(100);
      setProgressText("Complete!");
      
      if (result.success && result.processedEmployees) {
        setProcessingResult({
          success: result.processedEmployees.length,
          failed: result.failed || 0,
          errors: result.errors || [],
          processedEmployees: result.processedEmployees
        });
        
        // Invalidate employees cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
        
        toast({
          title: "Bulk Upload Complete",
          description: `Successfully processed ${result.processedEmployees.length} employee record(s)`,
          className: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
        });
      } else {
        setProcessingResult({
          success: 0,
          failed: result.failed || 1,
          errors: result.errors || [result.error || "Failed to process employee data"],
          processedEmployees: []
        });
        
        toast({
          title: "Processing Issues",
          description: result.error || "Some employee records could not be processed",
          className: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        });
      }
    } catch (error) {
      console.error('Error uploading bulk employees:', error);
      setProcessingResult({
        success: 0,
        failed: 1,
        errors: ["Failed to upload and process employee document"],
        processedEmployees: []
      });
      
      toast({
        title: "Upload Error",
        description: "Failed to process employee document",
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressText("");
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedFile(null);
    setProcessingResult(null);
    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>Bulk Employee Upload</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file containing employee details for batch processing
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* File Upload Zone */}
          <div
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-500 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('bulk-file-input')?.click()}
          >
            <input
              id="bulk-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <CloudUpload className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-4" />
            <div className="text-lg font-medium text-neutral-800 dark:text-white mb-2">
              {selectedFile ? selectedFile.name : "Drag and drop your employee file here"}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Supports Excel (.xlsx/.xls) and CSV files (Max 1GB)
            </div>
            <Button variant="outline" className="mb-3">
              Browse Files
            </Button>
            <div className="text-xs text-neutral-400 dark:text-neutral-500">
              Expected columns: First Name, Last Name, Email, Employment Type, Pay Rate, etc.
            </div>
          </div>

          {/* Processing State */}
          {isProcessing && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="font-medium text-neutral-800 dark:text-white">
                    {progressText || "Processing employee data..."}
                  </div>
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                      {progress}% complete
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Results */}
          {processingResult && !isProcessing && (
            <div>
              <h3 className="text-lg font-medium text-neutral-800 dark:text-white mb-4">
                Processing Results
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-neutral-800 dark:text-white">
                          Successful: {processingResult.success}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-neutral-800 dark:text-white">
                          Failed: {processingResult.failed}
                        </span>
                      </div>
                    </div>
                    
                    {processingResult.processedEmployees.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-neutral-800 dark:text-white">
                          Successfully Processed Employees ({processingResult.processedEmployees.length}):
                        </h4>
                        <div className="relative">
                          <div className="max-h-80 overflow-y-auto space-y-2 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 bg-neutral-25 dark:bg-neutral-900 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                            {processingResult.processedEmployees.map((employee, index) => (
                              <div key={index} className="bg-white dark:bg-neutral-800 p-3 rounded-lg text-sm shadow-sm border border-neutral-100 dark:border-neutral-700">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <div>
                                    <span className="font-medium text-muted-foreground">Name:</span>
                                    <span className="text-foreground ml-2">{employee.firstName} {employee.lastName}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Email:</span>
                                    <span className="text-foreground ml-2 break-all">{employee.email}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Type:</span>
                                    <span className="text-foreground ml-2">{employee.employmentType}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {processingResult.errors.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-red-600 dark:text-red-400">
                          Processing Errors:
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {processingResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* Footer with Action Buttons - Always Visible */}
        <div className="flex-shrink-0 border-t pt-4 mt-4">
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Close
            </Button>
            {selectedFile && !processingResult && (
              <Button onClick={processBulkEmployeeUpload} disabled={isProcessing}>
                <Users className="w-4 h-4 mr-2" />
                Process Employees
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}