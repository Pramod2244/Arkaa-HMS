"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Image,
  File,
  ChevronDown,
  ChevronRight,
  Upload,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Document type options
const DOCUMENT_TYPES = [
  { value: "AADHAAR", label: "Aadhaar Card" },
  { value: "PASSPORT", label: "Passport" },
  { value: "PAN", label: "PAN Card" },
  { value: "DRIVING_LICENSE", label: "Driving License" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "INSURANCE_CARD", label: "Insurance Card" },
  { value: "EMPLOYEE_ID", label: "Employee ID" },
  { value: "MLC_DOCUMENT", label: "MLC Document" },
  { value: "OTHER", label: "Other" },
] as const;

export interface PatientDocument {
  id?: string;
  documentName: string;
  documentType: string;
  documentNumber?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileData?: string; // Base64 for new uploads
  fileUrl?: string; // URL for existing documents
  isNew?: boolean;
  isDeleted?: boolean;
}

interface PatientDocumentRepeaterProps {
  documents: PatientDocument[];
  onChange: (documents: PatientDocument[]) => void;
  disabled?: boolean;
}

export function PatientDocumentRepeater({
  documents,
  onChange,
  disabled = false,
}: PatientDocumentRepeaterProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const addDocument = () => {
    const newDoc: PatientDocument = {
      documentName: "",
      documentType: "OTHER",
      isNew: true,
    };
    onChange([...documents, newDoc]);
    setExpandedRows(new Set([...expandedRows, documents.length]));
  };

  const removeDocument = (index: number) => {
    const doc = documents[index];
    if (doc.id) {
      // Mark existing document as deleted
      const updated = [...documents];
      updated[index] = { ...doc, isDeleted: true };
      onChange(updated);
    } else {
      // Remove new document entirely
      onChange(documents.filter((_, i) => i !== index));
    }
  };

  const updateDocument = (index: number, field: keyof PatientDocument, value: string | null) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF, JPG, and PNG files are allowed");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const updated = [...documents];
      updated[index] = {
        ...updated[index],
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileData: event.target?.result as string,
      };
      onChange(updated);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const updated = [...documents];
    updated[index] = {
      ...updated[index],
      fileName: undefined,
      fileSize: undefined,
      mimeType: undefined,
      fileData: undefined,
    };
    onChange(updated);
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <File className="w-4 h-4" />;
    if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
    if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const visibleDocuments = documents.filter((d) => !d.isDeleted);

  return (
    <div className="space-y-3">
      {/* Documents List */}
      {visibleDocuments.length === 0 ? (
        <div className="text-center py-6 text-gray-500 border-2 border-dashed rounded-lg">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documents added</p>
          <p className="text-xs text-gray-400">Click the button below to add a document</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, index) => {
            if (doc.isDeleted) return null;
            const isExpanded = expandedRows.has(index);

            return (
              <div
                key={index}
                className="border rounded-lg overflow-hidden bg-white"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleRow(index)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    {getFileIcon(doc.mimeType)}
                    <span className="font-medium text-sm">
                      {doc.documentName || `Document ${index + 1}`}
                    </span>
                    {doc.fileName && (
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(doc.fileSize)})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(doc.fileData || doc.fileUrl) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDoc(doc);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDocument(index);
                      }}
                      disabled={disabled}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                {isExpanded && (
                  <div className="p-3 space-y-3 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Document Name */}
                      <div>
                        <Label className="text-xs">Document Name *</Label>
                        <Input
                          value={doc.documentName}
                          onChange={(e) => updateDocument(index, "documentName", e.target.value)}
                          placeholder="Enter document name"
                          disabled={disabled}
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Document Type */}
                      <div>
                        <Label className="text-xs">Document Type</Label>
                        <Select
                          value={doc.documentType}
                          onValueChange={(value) => updateDocument(index, "documentType", value)}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Document Number (optional) */}
                    <div>
                      <Label className="text-xs">Document Number (optional)</Label>
                      <Input
                        value={doc.documentNumber || ""}
                        onChange={(e) => updateDocument(index, "documentNumber", e.target.value)}
                        placeholder="Enter document number if applicable"
                        disabled={disabled}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* File Upload */}
                    <div>
                      <Label className="text-xs">File Upload</Label>
                      {doc.fileName ? (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                          {getFileIcon(doc.mimeType)}
                          <span className="text-sm flex-1 truncate">{doc.fileName}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            disabled={disabled}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`flex items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ${
                            disabled ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          onClick={() => !disabled && fileInputRefs.current.get(index)?.click()}
                        >
                          <div className="text-center">
                            <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                            <p className="text-xs text-gray-500">Click to upload (PDF, JPG, PNG - Max 2MB)</p>
                          </div>
                        </div>
                      )}
                      <input
                        ref={(el) => {
                          if (el) fileInputRefs.current.set(index, el);
                        }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(index, e)}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addDocument}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Document
      </Button>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.documentName || "Document Preview"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {previewDoc?.mimeType === "application/pdf" ? (
              <iframe
                src={previewDoc.fileData || previewDoc.fileUrl}
                className="w-full h-[60vh]"
                title="PDF Preview"
              />
            ) : previewDoc?.mimeType?.startsWith("image/") ? (
              <img
                src={previewDoc.fileData || previewDoc.fileUrl}
                alt={previewDoc.documentName}
                className="max-w-full h-auto mx-auto"
              />
            ) : (
              <div className="text-center py-10 text-gray-500">
                <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Preview not available for this file type</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
