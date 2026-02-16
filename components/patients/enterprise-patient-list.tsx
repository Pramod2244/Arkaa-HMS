"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  RefreshCw,
  Download,
  ChevronDown,
  AlertTriangle,
  Crown,
  Siren,
  Phone,
  Calendar,
  X,
  Printer,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PatientRegistrationDrawer } from "./patient-registration-drawer";
import { PatientDetailsDrawer } from "./patient-details-drawer";
import { useToast } from "@/components/ui/Toast";
import { calculateAge } from "@/lib/utils/date-utils";
import { TITLE_CODES, BLOOD_GROUPS } from "@/lib/schemas/patient-registration-schema";

// ============== INTERFACES ==============

interface PatientFlag {
  flagType: "VIP" | "MLC" | "EMERGENCY" | "ALLERGY_ALERT";
}

interface PatientRegistration {
  id: string;
  registrationNumber: string;
  registrationDate: string;
}

interface Patient {
  id: string;
  uhid: string;
  titleCode?: number;
  firstName: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageYears?: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  primaryMobile?: string;
  phoneNumber?: string;
  email?: string;
  bloodGroup?: string;
  isVip?: boolean;
  isMlc?: boolean;
  isEmergency?: boolean;
  status: "ACTIVE" | "INACTIVE" | "DECEASED";
  createdAt: string;
  flags?: PatientFlag[];
  registrations?: PatientRegistration[];
}

interface PaginationInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ============== COMPONENT ==============

export function EnterprisePatientList() {
  // State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Selection state
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Import/Export state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Search & Filters
  const [searchType, setSearchType] = useState<"all" | "uhid" | "mobile" | "aadhaar">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Drawers
  const [showRegistrationDrawer, setShowRegistrationDrawer] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);

  const { addToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ============== FETCH PATIENTS ==============

  const fetchPatients = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        limit: "20",
      });

      if (isLoadMore && cursor) {
        params.append("cursor", cursor);
      }

      // Search parameters
      if (searchQuery.trim()) {
        if (searchType === "uhid") {
          params.append("uhid", searchQuery.trim());
        } else if (searchType === "mobile") {
          params.append("mobile", searchQuery.trim());
        } else if (searchType === "aadhaar") {
          params.append("aadhaar", searchQuery.trim());
        } else {
          params.append("search", searchQuery.trim());
        }
      }

      // Filters
      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (dateFrom) {
        params.append("registrationDateFrom", dateFrom);
      }
      if (dateTo) {
        params.append("registrationDateTo", dateTo);
      }

      const response = await fetch(`/api/patients?${params}`);
      const data = await response.json();

      if (data.success) {
        const newPatients = data.data.patients || [];
        const pagination: PaginationInfo = data.data.pagination || {};

        if (isLoadMore) {
          setPatients((prev) => [...prev, ...newPatients]);
        } else {
          setPatients(newPatients);
        }

        setCursor(pagination.nextCursor);
        setHasMore(pagination.hasMore || false);
      } else {
        addToast("error", data.message || "Failed to fetch patients");
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      addToast("error", "Failed to fetch patients");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, searchType, statusFilter, dateFrom, dateTo, cursor, addToast]);

  // Initial load
  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCursor(null);
      fetchPatients();
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchType, statusFilter, dateFrom, dateTo]);

  // ============== HANDLERS ==============

  const handleRefresh = () => {
    setCursor(null);
    fetchPatients();
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      fetchPatients(true);
    }
  };

  const handleNewPatient = () => {
    setEditingPatient(null);
    setShowRegistrationDrawer(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setShowRegistrationDrawer(true);
  };

  const handleViewPatient = (patient: Patient) => {
    setViewingPatient(patient);
    setShowDetailsDrawer(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationDrawer(false);
    setEditingPatient(null);
    setCursor(null);
    fetchPatients();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSearchType("all");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  // ============== SELECTION HANDLERS ==============

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedPatients(new Set(patients.map((p) => p.id)));
    } else {
      setSelectedPatients(new Set());
    }
  };

  const handleSelectPatient = (patientId: string, checked: boolean) => {
    const newSelected = new Set(selectedPatients);
    if (checked) {
      newSelected.add(patientId);
    } else {
      newSelected.delete(patientId);
    }
    setSelectedPatients(newSelected);
    setSelectAll(newSelected.size === patients.length);
  };

  // ============== EXPORT HANDLERS ==============

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      setExporting(true);
      
      // Get all selected patients or all patients if none selected
      const patientIds = selectedPatients.size > 0 
        ? Array.from(selectedPatients) 
        : patients.map((p) => p.id);
      
      const response = await fetch("/api/patients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          patientIds: patientIds.length > 0 ? patientIds : undefined,
          format,
          // Include current filters for server-side filtering
          filters: {
            search: searchQuery,
            searchType,
            status: statusFilter !== "ALL" ? statusFilter : undefined,
            dateFrom,
            dateTo,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patients_${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast("success", `Exported ${patientIds.length} patients to ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export failed:", error);
      addToast("error", "Failed to export patients");
    } finally {
      setExporting(false);
    }
  };

  // ============== IMPORT HANDLERS ==============

  const handleImport = async () => {
    if (!importFile) return;
    
    try {
      setImporting(true);
      
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/patients/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", `Imported ${result.data.success} patients. ${result.data.errors || 0} errors.`);
        setShowImportDialog(false);
        setImportFile(null);
        handleRefresh();
      } else {
        addToast("error", result.message || "Import failed");
      }
    } catch (error) {
      console.error("Import failed:", error);
      addToast("error", "Failed to import patients");
    } finally {
      setImporting(false);
    }
  };

  // ============== PRINT HANDLER ==============

  const handlePrint = (patientId: string) => {
    window.open(`/print/patient-registration/${patientId}`, "_blank");
  };

  // ============== KEYBOARD SHORTCUTS ==============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New Patient
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewPatient();
      }
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape: Clear search
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ============== HELPERS ==============

  const getFullName = (patient: Patient) => {
    const title = patient.titleCode ? TITLE_CODES[patient.titleCode as keyof typeof TITLE_CODES]?.label || "" : "";
    const parts = [title, patient.firstName, patient.middleName, patient.lastName].filter(Boolean);
    return parts.join(" ");
  };

  const getAge = (patient: Patient) => {
    if (patient.ageYears !== undefined && patient.ageYears !== null) {
      if (patient.ageYears === 0) {
        return `<1Y`;
      }
      return `${patient.ageYears}Y`;
    }
    if (patient.dateOfBirth) {
      return `${calculateAge(new Date(patient.dateOfBirth))}Y`;
    }
    return "-";
  };

  const getMobile = (patient: Patient) => {
    return patient.primaryMobile || patient.phoneNumber || "-";
  };

  const hasActiveFilters = searchQuery || statusFilter !== "ALL" || dateFrom || dateTo;

  // ============== RENDER ==============

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Registration</h1>
          <p className="text-gray-600 text-sm">
            Manage patient registrations and records
            {selectedPatients.size > 0 && (
              <span className="ml-2 text-blue-600">
                ({selectedPatients.size} selected)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <Download className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleNewPatient}>
            <Plus className="h-4 w-4 mr-1" />
            New Patient
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Type Selector */}
          <Select value={searchType} onValueChange={(v: typeof searchType) => setSearchType(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Search by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="uhid">UHID</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="aadhaar">Aadhaar</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder={`Search ${searchType === "all" ? "by UHID, name, or mobile" : `by ${searchType}`}... (Ctrl+K)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                Active
              </span>
            )}
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectAll && patients.length > 0}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
              </TableHead>
              <TableHead className="w-[120px]">UHID</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead className="w-[80px]">Age/Sex</TableHead>
              <TableHead className="w-[130px]">Mobile</TableHead>
              <TableHead className="w-[100px]">Blood Group</TableHead>
              <TableHead className="w-[120px]">Reg. Date</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Flags</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Loading patients...
                  </div>
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10">
                  <div className="text-gray-500">
                    <p className="font-medium">No patients found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow
                  key={patient.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedPatients.has(patient.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => handleViewPatient(patient)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedPatients.has(patient.id)}
                      onCheckedChange={(checked) => handleSelectPatient(patient.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">{patient.uhid}</TableCell>
                  <TableCell>
                    <div className="font-medium">{getFullName(patient)}</div>
                    {patient.email && (
                      <div className="text-xs text-gray-500">{patient.email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {getAge(patient)}/{patient.gender?.charAt(0) || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {getMobile(patient)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {patient.bloodGroup ? (
                      <Badge variant="secondary" className="text-xs">
                        {BLOOD_GROUPS.find((b) => b.value === patient.bloodGroup)?.label || patient.bloodGroup}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-3 w-3" />
                      {new Date(patient.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={patient.status === "ACTIVE" ? "default" : "secondary"}
                      className={
                        patient.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : patient.status === "INACTIVE"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {patient.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(patient.isVip || patient.flags?.some((f) => f.flagType === "VIP")) && (
                        <span title="VIP"><Crown className="h-4 w-4 text-yellow-500" /></span>
                      )}
                      {(patient.isMlc || patient.flags?.some((f) => f.flagType === "MLC")) && (
                        <span title="MLC"><AlertTriangle className="h-4 w-4 text-orange-500" /></span>
                      )}
                      {(patient.isEmergency || patient.flags?.some((f) => f.flagType === "EMERGENCY")) && (
                        <span title="Emergency"><Siren className="h-4 w-4 text-red-500" /></span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Edit"
                        onClick={() => handleEditPatient(patient)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Print"
                        onClick={() => handlePrint(patient.id)}
                      >
                        <Printer className="h-4 w-4 text-gray-600" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditPatient(patient)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Patient
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handlePrint(patient.id)}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Registration
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t text-center">
            <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Load More
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="text-xs text-gray-400 text-center">
        Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+N</kbd> New Patient,{" "}
        <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+K</kbd> Search
      </div>

      {/* Drawers */}
      <PatientRegistrationDrawer
        open={showRegistrationDrawer}
        onClose={() => {
          setShowRegistrationDrawer(false);
          setEditingPatient(null);
        }}
        patient={editingPatient as any}
        onSuccess={handleRegistrationSuccess}
      />

      {viewingPatient && (
        <PatientDetailsDrawer
          open={showDetailsDrawer}
          onClose={() => {
            setShowDetailsDrawer(false);
            setViewingPatient(null);
          }}
          patientId={viewingPatient.id}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Patients</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import patients. Download the template for the required format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="import-file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">CSV, XLS, XLSX (max 5MB)</p>
                </div>
                <input
                  id="import-file"
                  type="file"
                  className="hidden"
                  accept=".csv,.xls,.xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            {importFile && (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700">{importFile.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setImportFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Download className="h-4 w-4" />
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => {
                  // Download template CSV
                  const template = "firstName,middleName,lastName,dateOfBirth,gender,bloodGroup,mobile,email,address,city,state,pincode,idType,idNumber\nJohn,,Doe,1990-01-15,MALE,O_POSITIVE,9876543210,john@example.com,123 Main St,Mumbai,Maharashtra,400001,AADHAR,123456789012";
                  const blob = new Blob([template], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "patient_import_template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download template
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || importing}
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
