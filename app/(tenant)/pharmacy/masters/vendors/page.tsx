"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import {
  Search, RefreshCw, MoreHorizontal, Edit, Trash2, Plus,
  Truck, Home, ChevronRight as ChevronRightIcon, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { VendorFormDrawer } from "@/components/pharmacy/vendor-form-drawer";

interface VendorRecord {
  id: string;
  code: string;
  name: string;
  gstNumber: string | null;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Vendors</span>
    </nav>
  );
}

export default function VendorsPage() {
  const [records, setRecords] = useState<VendorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<VendorRecord | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/masters/vendors?${params}`);
      const result = await res.json();
      if (result.success) { setRecords(result.data || []); setCursor(result.pagination?.cursor || null); setHasMore(result.pagination?.hasMore || false); }
      else { setRecords([]); addToast("error", result.message || "Failed to load"); }
    } catch { setRecords([]); addToast("error", "Network error"); }
    finally { setIsLoading(false); }
  }, [searchQuery, statusFilter, limit, addToast]);

  useEffect(() => { setCursorHistory([]); setCursor(null); fetchData(null); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setCursorHistory([]); setCursor(null); }, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleNext = () => { if (cursor) { setCursorHistory(p => [...p, cursor]); fetchData(cursor); } };
  const handlePrev = () => { const h = [...cursorHistory]; h.pop(); setCursorHistory(h); fetchData(h[h.length - 1] || null); };

  const handleDelete = async (rec: VendorRecord) => {
    if (!confirm(`Delete "${rec.name}"?`)) return;
    try {
      const res = await fetch(`/api/pharmacy/masters/vendors?id=${rec.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { addToast("success", "Deleted"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const columns = [
    { key: "code" as keyof VendorRecord, header: "Code" },
    { key: "name" as keyof VendorRecord, header: "Name" },
    { key: "contactPerson" as keyof VendorRecord, header: "Contact Person", render: (v: string | null) => <span className="text-slate-500">{v || "-"}</span> },
    { key: "contactNumber" as keyof VendorRecord, header: "Phone", render: (v: string | null) => <span className="text-slate-500">{v || "-"}</span> },
    { key: "gstNumber" as keyof VendorRecord, header: "GST", render: (v: string | null) => <span className="text-slate-500">{v || "-"}</span> },
    {
      key: "status" as keyof VendorRecord, header: "Status",
      render: (v: "ACTIVE" | "INACTIVE") => <Badge className={v === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}>{v}</Badge>,
    },
    {
      key: "updatedAt" as keyof VendorRecord, header: "Updated",
      render: (v: string) => <span className="text-slate-500 text-sm">{format(new Date(v), "PP")}</span>,
    },
    {
      key: "id" as keyof VendorRecord, header: "Actions",
      render: (_v: string, row: VendorRecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelected(row); setIsDrawerOpen(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Truck className="h-6 w-6 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Vendors</h1>
              <p className="text-sm text-slate-500">Manage pharmacy vendors & suppliers</p>
            </div>
          </div>
          <Button onClick={() => { setSelected(null); setIsDrawerOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No vendors found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <VendorFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setSelected(null); }}
          onSuccess={() => { setIsDrawerOpen(false); setSelected(null); fetchData(null); }}
          initialData={selected}
        />
      </div>
    </PageTransition>
  );
}
