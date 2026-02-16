"use client";

/**
 * HMS Medical Masters - Import Dialog
 * 
 * Modal dialog for importing master data from CSV/Excel files.
 * Supports dry-run validation and shows detailed error reports.
 */

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Badge import removed - not currently used
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

// ============== TYPES ==============

interface ImportRowError {
  row: number;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportRowError[];
  isDryRun: boolean;
}

interface MasterImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  templateUrl: string;
  onImport: (data: Record<string, unknown>[], dryRun: boolean) => Promise<ImportResult>;
}

// ============== COMPONENT ==============

export function MasterImportDialog({
  isOpen,
  onClose,
  entityName,
  templateUrl,
  onImport,
}: MasterImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "validate" | "result">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Reset state when dialog closes
  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setValidationResult(null);
    setImportResult(null);
    setStep("upload");
    setIsLoading(false);
    setParseError(null);
    onClose();
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);
    setValidationResult(null);

    try {
      const content = await readFileAsText(selectedFile);
      const data = parseCSV(content);
      
      if (data.length === 0) {
        setParseError("File is empty or has no data rows");
        return;
      }
      
      setParsedData(data);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse file");
      setParsedData([]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Validate (dry-run)
  const handleValidate = async () => {
    if (parsedData.length === 0) return;

    setIsLoading(true);
    try {
      const result = await onImport(parsedData, true);
      setValidationResult(result);
      setStep("validate");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Import (actual)
  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsLoading(true);
    try {
      const result = await onImport(parsedData, false);
      setImportResult(result);
      setStep("result");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  // ============== RENDER ==============

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Template download */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800">
                      Download Template First
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Use our template to ensure your data is formatted correctly.
                    </p>
                    <a
                      href={templateUrl}
                      download
                      className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </a>
                  </div>
                </div>
              </div>

              {/* File upload area */}
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors hover:border-indigo-400 hover:bg-indigo-50
                  ${file ? "border-green-400 bg-green-50" : "border-slate-300"}
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                    <p className="text-sm font-medium text-green-700">
                      {file.name}
                    </p>
                    <p className="text-xs text-green-600">
                      {parsedData.length} rows detected
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setParsedData([]);
                        setParseError(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-slate-400 mx-auto" />
                    <p className="text-sm text-slate-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">
                      CSV or Excel files (.csv, .xlsx)
                    </p>
                  </div>
                )}
              </div>

              {/* Parse error */}
              {parseError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">
                        Error Reading File
                      </h4>
                      <p className="text-xs text-red-700 mt-1">{parseError}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Validation Results */}
          {step === "validate" && validationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-semibold text-slate-900">
                    {validationResult.totalRows}
                  </p>
                  <p className="text-xs text-slate-600">Total Rows</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-2xl font-semibold text-green-600">
                    {validationResult.successCount}
                  </p>
                  <p className="text-xs text-green-700">Valid</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-2xl font-semibold text-red-600">
                    {validationResult.errorCount}
                  </p>
                  <p className="text-xs text-red-700">Errors</p>
                </div>
              </div>

              {/* Error list */}
              {validationResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                    <h4 className="text-sm font-medium text-red-800">
                      Validation Errors
                    </h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700">
                            Row
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {validationResult.errors.map((error) => (
                          <tr key={error.row}>
                            <td className="px-4 py-2 text-red-600">
                              {error.row}
                            </td>
                            <td className="px-4 py-2 text-red-700">
                              {error.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Success message */}
              {validationResult.errorCount === 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="text-sm font-medium text-green-800">
                        All rows are valid!
                      </h4>
                      <p className="text-xs text-green-700 mt-1">
                        Click Import to proceed with the import.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Import Results */}
          {step === "result" && importResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div
                className={`rounded-lg p-6 text-center ${
                  importResult.errorCount === 0
                    ? "bg-green-50 border border-green-200"
                    : "bg-amber-50 border border-amber-200"
                }`}
              >
                {importResult.errorCount === 0 ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                    <h3 className="text-lg font-semibold text-green-800 mt-3">
                      Import Successful
                    </h3>
                    <p className="text-sm text-green-700 mt-1">
                      {importResult.successCount} {entityName.toLowerCase()}(s) imported successfully
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
                    <h3 className="text-lg font-semibold text-amber-800 mt-3">
                      Import Completed with Errors
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">
                      {importResult.successCount} imported, {importResult.errorCount} failed
                    </p>
                  </>
                )}
              </div>

              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                    <h4 className="text-sm font-medium text-red-800">
                      Failed Rows
                    </h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700">
                            Row
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {importResult.errors.map((error) => (
                          <tr key={error.row}>
                            <td className="px-4 py-2 text-red-600">
                              {error.row}
                            </td>
                            <td className="px-4 py-2 text-red-700">
                              {error.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleValidate}
                disabled={parsedData.length === 0 || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate"
                )}
              </Button>
            </>
          )}

          {step === "validate" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validationResult?.successCount === 0 || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validationResult?.successCount ?? 0} Row(s)
                  </>
                )}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== UTILITIES ==============

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1);
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });

    data.push(row);
  }

  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export default MasterImportDialog;
