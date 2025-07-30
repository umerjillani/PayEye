import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAppContext } from "@/contexts/app-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ExtractedData {
  totalRecords?: number;
  processedTimesheets?: any[];
  rawExtraction?: any;
  // Legacy single record fields for backwards compatibility
  employeeName?: string;
  hoursWorked?: string;
  payRate?: string;
  totalPay?: string;
  clientName?: string;
  weekEnding?: string;
}

export function TimesheetUploadModal() {
  const { showTimesheetUploadModal, setShowTimesheetUploadModal, selectedCompany } = useAppContext();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);



  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processTimesheetUpload = async () => {
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
      setProgressText("Processing document with OCR...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(60);
      setProgressText("Extracting structured data with AI...");

      const response = await fetch('/api/upload/timesheet', {
        method: 'POST',
        body: formData,
      });

      setProgress(90);
      setProgressText("Finalizing results...");

      const result = await response.json();
      
      setProgress(100);
      setProgressText("Complete!");
      
      // Check if the response was successful (2xx status code)
      if (response.ok && result.success) {
        setExtractedData(result.extractedData);
        // Invalidate timesheets cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
        toast({
          title: "Success",
          description: result.message,
          className: "border-primary bg-primary/10 text-primary",
        });
      } else if (!response.ok) {
        // Handle error response
        toast({
          title: "Error",
          description: result.error || "Failed to process timesheet document",
          className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
        });
      } else {
        const extracted = result.extractedData || null;
        setExtractedData(extracted);
        
        // Check if employee exists when we have extracted data
        if (extracted && extracted.employeeName) {
          const exists = checkEmployeeExists(extracted.employeeName);
          setEmployeeExists(exists);
          
          if (exists) {
            toast({
              title: "Employee Found",
              description: `Employee ${extracted.employeeName} exists in database but timesheet couldn't be created automatically. Please check the data and create manually.`,
              className: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
              variant: undefined,
            });
          } else {
            toast({
              title: "Data Extracted Successfully",
              description: `Information extracted but employee ${extracted.employeeName} not found in system. You can create the employee first or continue with the data.`,
              className: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
              variant: undefined,
            });
          }
        } else {
          toast({
            title: "Data Extracted Successfully",
            description: "Information extracted but employee not found in system. You can create the employee or continue with the data.",
            className: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
            variant: undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error uploading timesheet:', error);
      toast({
        title: "Error",
        description: "Failed to process timesheet document",
        className: "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressText("");
    }
  };

  const handleProcessTimesheet = async () => {
    if (!extractedData) return;
    
    try {
      // If no timesheets were created (employee not found), create manually
      if (!extractedData.totalRecords || extractedData.totalRecords === 0) {
        const response = await fetch('/api/timesheets/manual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeName: extractedData.employeeName,
            hoursWorked: typeof extractedData.hoursWorked === 'string' ? extractedData.hoursWorked.replace(/"/g, '') : String(extractedData.hoursWorked || ''),
            payRate: typeof extractedData.payRate === 'string' ? extractedData.payRate.replace(/"/g, '') : String(extractedData.payRate || ''),
            totalPay: typeof extractedData.totalPay === 'string' ? extractedData.totalPay.replace(/"/g, '') : String(extractedData.totalPay || ''),
            clientName: extractedData.clientName,
            weekEnding: extractedData.weekEnding,
            originalFile: selectedFile?.name
          }),
        });

        if (response.ok) {
          const result = await response.json();
          toast({
            title: "Timesheet Created",
            description: "Timesheet created without employee link - can be edited later",
            className: "bg-blue-50 border-blue-200 text-blue-800",
          });
        } else {
          throw new Error('Failed to create manual timesheet');
        }
      }
      
      // Invalidate and refetch timesheet queries to refresh data
      console.log("Invalidating timesheet queries after successful processing");
      await queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/timesheets", selectedCompany?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/timesheets", selectedCompany?.id] });
      
      // Also invalidate candidates and agencies in case they were updated
      await queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/candidates", selectedCompany?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agencies", selectedCompany?.id] });
      
      console.log("Cache invalidation complete");
      
      toast({
        title: "Processing Complete",
        description: "Timesheet has been processed and added to the system",
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
      
      setShowTimesheetUploadModal(false);
      setSelectedFile(null);
      setExtractedData(null);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error processing timesheet:", error);
      toast({
        title: "Error",
        description: "Failed to create timesheet",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setShowTimesheetUploadModal(false);
    setSelectedFile(null);
    setExtractedData(null);
    setIsProcessing(false);
  };

  return (
    <Dialog open={showTimesheetUploadModal} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Timesheet</DialogTitle>
          <DialogDescription>
            Upload a timesheet document for automatic processing with OCR
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto flex-1">
          {/* File Upload Zone */}
          <div
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-500 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <CloudUpload className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-4" />
            <div className="text-lg font-medium text-neutral-800 dark:text-white mb-2">
              {selectedFile ? selectedFile.name : "Drag and drop your timesheet here"}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Supports PDF, Excel (.xls/.xlsx), CSV, and image files
            </div>
            <Button variant="outline" className="mb-3">
              Browse Files
            </Button>
            <div className="text-xs text-neutral-400 dark:text-neutral-500">
              Supported formats: PDF, JPG, PNG (Max 1GB)
            </div>
          </div>

          {/* Processing State */}
          {isProcessing && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="font-medium text-neutral-800 dark:text-white">
                    {progressText || "Processing document..."}
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

          {/* Extracted Data */}
          {extractedData && !isProcessing && (
            <div>
              <h3 className="text-lg font-medium text-neutral-800 dark:text-white mb-4">
                Processing Results
              </h3>
              <Card>
                <CardContent className="p-4">
                  {extractedData.totalRecords && extractedData.totalRecords > 0 ? (
                    <div className="space-y-4">
                      <div className="text-sm">
                        <span className="font-medium text-primary">
                          Successfully processed {extractedData.totalRecords} timesheet record(s)
                        </span>
                      </div>
                      
                      {extractedData.processedTimesheets && extractedData.processedTimesheets.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-neutral-800 dark:text-white">
                            Processed Records:
                          </h4>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {extractedData.processedTimesheets.map((timesheet, index) => (
                              <div key={index} className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="col-span-2 mb-2 flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-muted-foreground">Employee:</span>
                                      <span className="text-foreground ml-2 font-medium">{timesheet.candidateName}</span>
                                    </div>
                                    {timesheet.status === 'created' && (
                                      <span className="text-green-600 text-xs font-medium">✓ Created</span>
                                    )}
                                    {timesheet.status === 'existing' && (
                                      <span className="text-blue-600 text-xs font-medium">✓ Existing</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Hours:</span>
                                    <span className="text-foreground ml-2">{timesheet.hoursCharged}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Pay Rate:</span>
                                    <span className="text-foreground ml-2">£{timesheet.payRate}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Gross Pay:</span>
                                    <span className="text-foreground ml-2">£{timesheet.grossPay}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Status:</span>
                                    <span className="text-foreground ml-2 capitalize">{timesheet.status}</span>
                                  </div>
                                  <div className="col-span-2 mt-1">
                                    <span className="font-medium text-muted-foreground">ID:</span>
                                    <span className="text-foreground ml-2 font-mono text-xs">{timesheet.id}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback to single record display for backwards compatibility
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Employee:</span>
                        <span className="text-foreground ml-2">
                          {extractedData.employeeName || 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Client/Agency:</span>
                        <span className="text-foreground ml-2">
                          {extractedData.clientName || 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Week Ending:</span>
                        <span className="text-foreground ml-2">
                          {extractedData.weekEnding || 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Hours Worked:</span>
                        <span className="text-foreground ml-2">
                          {extractedData.hoursWorked || 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Pay Rate:</span>
                        <span className="text-foreground ml-2">
                          £{extractedData.payRate || 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Total Pay:</span>
                        <span className="text-foreground ml-2">
                          £{extractedData.totalPay || 'Not calculated'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-4 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          {selectedFile && !extractedData && !isProcessing && (
            <Button onClick={processTimesheetUpload}>
              Process Document
            </Button>
          )}
          
          {extractedData && !isProcessing && (
            <Button onClick={handleProcessTimesheet}>
              Create Timesheet{extractedData.totalRecords && extractedData.totalRecords > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
