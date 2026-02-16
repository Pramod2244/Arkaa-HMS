"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import {
  Search, RefreshCw, CreditCard, Home, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface CreditRecord {
  id: string;
  patientId: string;
  patientName: string;
  uhid: string;
  invoiceId: string | null;
  referenceType: string;
  referenceId: string;
  debitAmount: string;
  creditAmount: string;
  balance: string;
  notes: string | null;
  createdAt: string;
  createdBy: string;
}

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Credit Ledger</span>
    </nav>
  );
}

export default function CreditLedgerPage() {
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchPatientId, setSearchPatientId] = useState("");
  const [limit] = useState(20);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchPatientId) params.append("patientId", searchPatientId);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/credit-ledger?${params}`);
      const result = await res.json();
      if (result.success) {
        setRecords(result.data || []);
        setCursor(result.pagination?.cursor || null);
        setHasMore(result.pagination?.hasMore || false);
      } else {
        setRecords([]);
        addToast("error", result.message || "Failed to load");
      }
    } catch {
      setRecords([]);
      addToast("error", "Network error");
    } finally {
      setIsLoading(false);
    }
  }, [searchPatientId, limit, addToast]);

  useEffect(() => { setCursorHistory([]); setCursor(null); fetchData(null); }, [fetchData]);

  const handleNext = () => { if (cursor) { setCursorHistory((p) => [...p, cursor]); fetchData(cursor); } };
  const handlePrev = () => { const h = [...cursorHistory]; h.pop(); setCursorHistory(h); fetchData(h[h.length - 1] || null); };

  const columns = [
    { key: "patientName" as keyof CreditRecord, header: "Patient", render: (v: string, row: CreditRecord) => (
      <div><div className="font-medium">{v}</div><div className="text-xs text-slate-500">{row.uhid}</div></div>
    ) },
    { key: "referenceType" as keyof CreditRecord, header: "Type", render: (v: string) => <span className="text-sm">{v.replace("_", " ")}</span> },
    { key: "debitAmount" as keyof CreditRecord, header: "Debit", render: (v: string) => {
      const val = parseFloat(v);
      return val > 0 ? <span className="text-red-600 font-medium">&#8377;{val.toFixed(2)}</span> : <span className="text-slate-400">-</span>;
    } },
    { key: "creditAmount" as keyof CreditRecord, header: "Credit", render: (v: string) => {
      const val = parseFloat(v);
      return val > 0 ? <span className="text-green-600 font-medium">&#8377;{val.toFixed(2)}</span> : <span className="text-slate-400">-</span>;
    } },
    { key: "balance" as keyof CreditRecord, header: "Balance", render: (v: string) => <span className="font-semibold">&#8377;{parseFloat(v).toFixed(2)}</span> },
    { key: "notes" as keyof CreditRecord, header: "Notes", render: (v: string | null) => <span className="text-sm text-slate-500">{v || "-"}</span> },
    { key: "createdAt" as keyof CreditRecord, header: "Date", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP p")}</span> },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg"><CreditCard className="h-6 w-6 text-red-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Credit Ledger</h1>
            <p className="text-sm text-slate-500">Track patient credit balances from pharmacy sales</p>
          </div>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Filter by Patient ID..." value={searchPatientId} onChange={(e) => setSearchPatientId(e.target.value)} className="pl-9" />
            </div>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No credit records found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
