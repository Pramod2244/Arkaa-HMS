"use client";

/**
 * HMS Medical Masters - Doctors Management Page
 * 
 * Main UI for Doctor master operations following HMS patterns.
 * 
 * Features:
 * - List doctors with pagination
 * - Filter by status, department
 * - Search by name, code, mobile, registration
 * - Create/Edit doctor (drawer form)
 * - View audit history
 * - Disable doctor
 * 
 * Route: /medical-masters/doctors
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import { DoctorDrawer } from "@/components/masters/DoctorDrawer";
import { AuditHistoryDrawer } from "@/components/masters/AuditHistoryDrawer";
import {
  Search,
  Download,
  RefreshCw,
  MoreHorizontal,
  Edit,
  History,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Home,
  ChevronRight as ChevronRightIcon,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";

// ============== TYPES ==============

interface Department {
  id: string;
  code: string;
  name: string;
}

interface DoctorDepartment {
  id: string;
  departmentId: string;
  isPrimary: boolean;
  department: Department;
}

interface Doctor {
  id: string;
  doctorCode: string;
  userId: string;
  registrationNumber: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  mobile: string;
  email: string | null;
  qualifications: string[];
  specializations: string[];
  consultationFee: number;
  primaryDepartmentId: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  isSchedulable: boolean;
  allowWalkIn: boolean;
  isDeleted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  primaryDepartment?: Department;
  departments?: DoctorDepartment[];
  user?: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
  };
}

// ============== BREADCRUMB COMPONENT ==============

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1">
        <Home className="h-4 w-4" />
        Dashboard
      </Link>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-400">Medical Masters</span>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Doctors</span>
    </nav>
  );
}

// ============== STATUS BADGE COMPONENT ==============

function StatusBadge({ status }: { status: Doctor["status"] }) {
  const config = {
    ACTIVE: {
      icon: CheckCircle2,
      className: "bg-green-100 text-green-800",
      label: "Active",
    },
    INACTIVE: {
      icon: XCircle,
      className: "bg-slate-100 text-slate-600",
      label: "Inactive",
    },
    ON_LEAVE: {
      icon: PauseCircle,
      className: "bg-amber-100 text-amber-800",
      label: "On Leave",
    },
  }[status];

  const Icon = config.icon;

  return (
    <Badge className={`${config.className} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ============== COMPONENT ==============

export default function DoctorsPage() {
  // State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState("fullName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer/Dialog State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string>("");
  const [auditEntityName, setAuditEntityName] = useState<string>("");

  // Toast
  const { addToast } = useToast();

  // ============== DATA FETCHING ==============

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/masters/departments?limit=100&status=ACTIVE");
      const result = await response.json();
      if (result.success && result.data) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error("Fetch departments error:", error);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (departmentFilter && departmentFilter !== "ALL") {
        params.append("departmentId", departmentFilter);
      }

      const response = await fetch(`/api/masters/doctors?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        setDoctors(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setDoctors([]);
        addToast("error", result.error || "Failed to load doctors");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setDoctors([]);
      addToast("error", "Network error loading doctors");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, searchQuery, statusFilter, departmentFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============== HANDLERS ==============

  const handleCreate = () => {
    setSelectedDoctor(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsDrawerOpen(true);
  };

  const handleViewAudit = (doctor: Doctor) => {
    setAuditEntityId(doctor.id);
    setAuditEntityName(`${doctor.doctorCode} - ${doctor.fullName}`);
    setIsAuditDrawerOpen(true);
  };

  const handleDisable = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to disable ${doctor.fullName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/masters/doctors/${doctor.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to disable doctor");
      }

      fetchDoctors();
      addToast("success", "Doctor disabled successfully");
    } catch (error) {
      console.error("Disable error:", error);
      addToast("error", error instanceof Error ? error.message : "Failed to disable doctor");
    }
  };

  const handleStatusChange = async (doctor: Doctor, newStatus: Doctor["status"]) => {
    try {
      const response = await fetch(`/api/masters/doctors/${doctor.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          version: doctor.version,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update status");
      }

      fetchDoctors();
      addToast("success", `Doctor status updated to ${newStatus}`);
    } catch (error) {
      console.error("Status update error:", error);
      addToast("error", error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleDrawerSuccess = () => {
    setIsDrawerOpen(false);
    setSelectedDoctor(null);
    fetchDoctors();
    addToast("success", selectedDoctor ? "Doctor updated successfully" : "Doctor created successfully");
  };

  const fetchAuditHistory = async (
    entityId: string,
    options: { page?: number; limit?: number; action?: string }
  ) => {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });

    if (options.action) {
      params.append("action", options.action);
    }

    const response = await fetch(
      `/api/masters/doctors/${entityId}/audit?${params}`
    );
    return response.json();
  };

  // ============== TABLE COLUMNS ==============

  const columns = [
    {
      key: "doctorCode" as keyof Doctor,
      header: "Code",
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      ),
    },
    {
      key: "fullName" as keyof Doctor,
      header: "Doctor",
      sortable: true,
      render: (_value: string, row: Doctor) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.fullName}</span>
          <span className="text-xs text-slate-500">
            Reg: {row.registrationNumber}
          </span>
        </div>
      ),
    },
    {
      key: "primaryDepartment" as keyof Doctor,
      header: "Department",
      render: (_value: Department | undefined, row: Doctor) => (
        <div className="flex flex-col">
          <span>{row.primaryDepartment?.name || "-"}</span>
          {row.departments && row.departments.length > 1 && (
            <span className="text-xs text-slate-500">
              +{row.departments.length - 1} more
            </span>
          )}
        </div>
      ),
    },
    {
      key: "qualifications" as keyof Doctor,
      header: "Qualifications",
      render: (value: string[]) => (
        <span className="text-sm">{value?.join(", ") || "-"}</span>
      ),
    },
    {
      key: "mobile" as keyof Doctor,
      header: "Contact",
      render: (_value: string, row: Doctor) => (
        <div className="flex flex-col text-sm">
          <span>{row.mobile}</span>
          {row.email && (
            <span className="text-xs text-slate-500 truncate max-w-[150px]">
              {row.email}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "consultationFee" as keyof Doctor,
      header: "Fee",
      render: (value: number) => (
        <span className="font-medium">₹{value?.toLocaleString() || 0}</span>
      ),
    },
    {
      key: "status" as keyof Doctor,
      header: "Status",
      render: (value: Doctor["status"]) => <StatusBadge status={value} />,
    },
    {
      key: "isSchedulable" as keyof Doctor,
      header: "Schedulable",
      render: (value: boolean) => (
        <Badge
          variant={value ? "default" : "secondary"}
          className={value ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}
        >
          {value ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "id" as keyof Doctor,
      header: "Actions",
      render: (_value: string, row: Doctor) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewAudit(row)}>
              <History className="h-4 w-4 mr-2" />
              View History
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.status !== "ACTIVE" && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, "ACTIVE")}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Set Active
              </DropdownMenuItem>
            )}
            {row.status !== "ON_LEAVE" && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, "ON_LEAVE")}>
                <PauseCircle className="h-4 w-4 mr-2 text-amber-600" />
                Mark On Leave
              </DropdownMenuItem>
            )}
            {row.status !== "INACTIVE" && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, "INACTIVE")}>
                <XCircle className="h-4 w-4 mr-2 text-slate-600" />
                Set Inactive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDisable(row)}
              className="text-red-600"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Disable
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ============== RENDER ==============

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Stethoscope className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Doctors</h1>
              <p className="text-sm text-slate-500">
                Manage doctor profiles, departments, and scheduling
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDoctors}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem>Export as Excel</DropdownMenuItem>
                <DropdownMenuItem>Export as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleCreate}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Doctor
            </Button>
          </div>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, code, mobile, registration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pagination.total}</p>
                <p className="text-xs text-slate-500">Total Doctors</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {doctors.filter((d) => d.status === "ACTIVE").length}
                </p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <PauseCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {doctors.filter((d) => d.status === "ON_LEAVE").length}
                </p>
                <p className="text-xs text-slate-500">On Leave</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <XCircle className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {doctors.filter((d) => d.status === "INACTIVE").length}
                </p>
                <p className="text-xs text-slate-500">Inactive</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Data Table */}
        <GlassCard>
          <DataTable
            columns={columns}
            data={doctors}
            isLoading={isLoading}
            onSort={(key, order) => {
              setSortBy(key);
              setSortOrder(order);
            }}
            sortKey={sortBy}
            sortOrder={sortOrder}
          />

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <p className="text-sm text-slate-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} doctors
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Doctor Drawer */}
        <DoctorDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedDoctor(null);
          }}
          onSuccess={handleDrawerSuccess}
          doctor={selectedDoctor}
          departments={departments}
        />

        {/* Audit History Drawer */}
        <AuditHistoryDrawer
          isOpen={isAuditDrawerOpen}
          onClose={() => setIsAuditDrawerOpen(false)}
          entityType="DOCTOR"
          entityId={auditEntityId}
          entityName={auditEntityName}
          fetchAuditHistory={fetchAuditHistory}
        />
      </div>
    </PageTransition>
  );
}
