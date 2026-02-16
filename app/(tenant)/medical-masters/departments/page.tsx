"use client";

/**
 * HMS Medical Masters - Departments Management Page
 * 
 * Main UI for Department master operations following HMS patterns.
 * 
 * IMPORTANT: Departments are SYSTEM MASTERS (predefined).
 * - Departments are seeded automatically for each tenant
 * - Admin can only ACTIVATE/DEACTIVATE and edit description
 * - Cannot create or delete departments
 * - Code and Name are READ-ONLY
 * 
 * Route: /medical-masters/departments
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import { DepartmentDrawer, DepartmentFormData } from "@/components/masters/DepartmentDrawer";
import { AuditHistoryDrawer } from "@/components/masters/AuditHistoryDrawer";
import {
  Search,
  Download,
  RefreshCw,
  MoreHorizontal,
  Edit,
  History,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Home,
  ChevronRight as ChevronRightIcon,
  Info,
} from "lucide-react";
import { format } from "date-fns";

// ============== TYPES ==============

interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  isDeleted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
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
      <span className="text-slate-900 font-medium">Departments</span>
    </nav>
  );
}

// ============== COMPONENT ==============

export default function DepartmentsPage() {
  // State
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
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer/Dialog State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string>("");
  const [auditEntityName, setAuditEntityName] = useState<string>("");

  // Toast
  const { addToast } = useToast();

  // ============== DATA FETCHING ==============

  const fetchDepartments = useCallback(async () => {
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

      const response = await fetch(`/api/masters/departments?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        setDepartments(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setDepartments([]);
        addToast("error", result.message || "Failed to load departments");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setDepartments([]);
      addToast("error", "Network error loading departments");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, searchQuery, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============== HANDLERS ==============

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department);
    setIsDrawerOpen(true);
  };

  const handleViewAudit = (department: Department) => {
    setAuditEntityId(department.id);
    setAuditEntityName(`${department.code} - ${department.name}`);
    setIsAuditDrawerOpen(true);
  };

  const handleDrawerSuccess = () => {
    setIsDrawerOpen(false);
    setSelectedDepartment(null);
    fetchDepartments();
    addToast("success", "Department updated successfully");
  };

  const handleUpdateDepartment = async (data: DepartmentFormData) => {
    try {
      const response = await fetch(`/api/masters/departments/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: data.description,
          status: data.status,
          version: data.version,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update department");
      }

      handleDrawerSuccess();
    } catch (error) {
      console.error("Update error:", error);
      addToast("error", error instanceof Error ? error.message : "Failed to update department");
      throw error;
    }
  };

  const handleExport = async (format: "csv" | "excel" | "json") => {
    try {
      const params = new URLSearchParams({
        format,
      });

      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/masters/departments/export?${params}`);
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `departments-export.${format === "excel" ? "xlsx" : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast("success", "Export completed successfully");
    } catch (error) {
      console.error("Export error:", error);
      addToast("error", "Failed to export departments");
    }
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
      `/api/masters/departments/${entityId}/audit?${params}`
    );
    return response.json();
  };

  // ============== TABLE COLUMNS ==============

  const columns = [
    {
      key: "code" as keyof Department,
      header: "Code",
      sortable: true,
    },
    {
      key: "name" as keyof Department,
      header: "Name",
      sortable: true,
    },
    {
      key: "description" as keyof Department,
      header: "Description",
      render: (value: string | null) => (
        <span className="text-slate-500 truncate max-w-[200px] block">
          {value || "-"}
        </span>
      ),
    },
    {
      key: "status" as keyof Department,
      header: "Status",
      render: (value: "ACTIVE" | "INACTIVE") => (
        <Badge
          variant={value === "ACTIVE" ? "default" : "secondary"}
          className={
            value === "ACTIVE"
              ? "bg-green-100 text-green-800"
              : "bg-slate-100 text-slate-600"
          }
        >
          {value}
        </Badge>
      ),
    },
    {
      key: "updatedAt" as keyof Department,
      header: "Updated",
      render: (value: Date) => (
        <span className="text-slate-500 text-sm">
          {format(new Date(value), "PP")}
        </span>
      ),
    },
    {
      key: "id" as keyof Department,
      header: "Actions",
      render: (_value: string, row: Department) => (
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
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Departments
              </h1>
              <p className="text-sm text-slate-500">
                Activate or deactivate hospital departments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">System Departments</p>
            <p className="mt-1 text-blue-700">
              Departments are predefined medical standards. You can activate/deactivate them 
              and edit descriptions, but cannot create new ones or change department codes/names.
            </p>
          </div>
        </div>

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchDepartments()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </GlassCard>

        {/* Data Table */}
        <GlassCard className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            data={departments}
            loading={isLoading}
            emptyMessage="No departments found"
            onSort={(column, order) => {
              setSortBy(column);
              setSortOrder(order);
            }}
          />

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-slate-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} departments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Drawers & Dialogs */}
        <DepartmentDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedDepartment(null);
          }}
          onSubmit={handleUpdateDepartment}
          initialData={selectedDepartment}
        />

        <AuditHistoryDrawer
          isOpen={isAuditDrawerOpen}
          onClose={() => setIsAuditDrawerOpen(false)}
          entityId={auditEntityId}
          entityName={auditEntityName}
          fetchAuditHistory={fetchAuditHistory}
        />
      </div>
    </PageTransition>
  );
}
