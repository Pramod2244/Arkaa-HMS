"use client";

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
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  Store,
  Home,
  ChevronRight as ChevronRightIcon,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { StoreFormDrawer } from "@/components/pharmacy/store-form-drawer";

// ============== TYPES ==============

interface StoreRecord {
  id: string;
  code: string;
  name: string;
  type: "CENTRAL" | "OP" | "IP" | "SUB";
  licenseNumber: string | null;
  gstNumber: string | null;
  address: string | null;
  managerName: string | null;
  contactNumber: string | null;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

// ============== BREADCRUMB ==============

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1">
        <Home className="h-4 w-4" />
        Dashboard
      </Link>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Stores</span>
    </nav>
  );
}

// ============== COMPONENT ==============

export default function PharmacyStoresPage() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limit] = useState(20);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);

  const { addToast } = useToast();

  // ============== DATA FETCHING ==============

  const fetchStores = useCallback(async (pageCursor?: string | null, retryCount = 0) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);

      const response = await fetch(`/api/pharmacy/masters/stores?${params}`);
      const result = await response.json();

      if (result.success) {
        setStores(result.data || []);
        setCursor(result.pagination?.cursor || null);
        setHasMore(result.pagination?.hasMore || false);
      } else if (response.status === 500 && retryCount < 2) {
        // Retry once on 500 (cold-compile race condition in dev)
        setTimeout(() => fetchStores(pageCursor, retryCount + 1), 1000);
        return;
      } else {
        setStores([]);
        addToast("error", result.message || "Failed to load stores");
      }
    } catch {
      setStores([]);
      addToast("error", "Network error loading stores");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, limit, addToast]);

  useEffect(() => {
    setCursorHistory([]);
    setCursor(null);
    fetchStores(null);
  }, [fetchStores]);

  // Debounced search reset
  useEffect(() => {
    const timer = setTimeout(() => {
      setCursorHistory([]);
      setCursor(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============== PAGINATION ==============

  const handleNextPage = () => {
    if (cursor) {
      setCursorHistory((prev) => [...prev, cursor]);
      fetchStores(cursor);
    }
  };

  const handlePrevPage = () => {
    const prev = [...cursorHistory];
    prev.pop();
    setCursorHistory(prev);
    fetchStores(prev[prev.length - 1] || null);
  };

  // ============== HANDLERS ==============

  const handleAdd = () => {
    setSelectedStore(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (store: StoreRecord) => {
    setSelectedStore(store);
    setIsDrawerOpen(true);
  };

  const handleDelete = async (store: StoreRecord) => {
    if (!confirm(`Delete store "${store.name}"?`)) return;
    try {
      const response = await fetch(`/api/pharmacy/masters/stores?id=${store.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        addToast("success", "Store deleted");
        fetchStores(null);
      } else {
        addToast("error", result.message || "Failed to delete");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  const handleDrawerSuccess = () => {
    setIsDrawerOpen(false);
    setSelectedStore(null);
    fetchStores(null);
  };

  // ============== COLUMNS ==============

  const columns = [
    { key: "code" as keyof StoreRecord, header: "Code" },
    { key: "name" as keyof StoreRecord, header: "Name" },
    {
      key: "type" as keyof StoreRecord,
      header: "Type",
      render: (value: string) => (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      ),
    },
    {
      key: "managerName" as keyof StoreRecord,
      header: "Manager",
      render: (value: string | null) => <span className="text-slate-500">{value || "-"}</span>,
    },
    {
      key: "status" as keyof StoreRecord,
      header: "Status",
      render: (value: "ACTIVE" | "INACTIVE") => (
        <Badge
          variant={value === "ACTIVE" ? "default" : "secondary"}
          className={value === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}
        >
          {value}
        </Badge>
      ),
    },
    {
      key: "updatedAt" as keyof StoreRecord,
      header: "Updated",
      render: (value: string) => (
        <span className="text-slate-500 text-sm">{format(new Date(value), "PP")}</span>
      ),
    },
    {
      key: "id" as keyof StoreRecord,
      header: "Actions",
      render: (_value: string, row: StoreRecord) => (
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
            <DropdownMenuItem onClick={() => handleDelete(row)} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
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
        <Breadcrumb />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Pharmacy Stores</h1>
              <p className="text-sm text-slate-500">Manage pharmacy store locations</p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Store
          </Button>
        </div>

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
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
            <Button variant="ghost" size="icon" onClick={() => fetchStores(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        {/* Data Table */}
        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={stores} loading={isLoading} emptyMessage="No stores found" />

          {/* Cursor Pagination */}
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={cursorHistory.length === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </GlassCard>

        {/* Drawer */}
        <StoreFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setSelectedStore(null); }}
          onSuccess={handleDrawerSuccess}
          initialData={selectedStore}
        />
      </div>
    </PageTransition>
  );
}
