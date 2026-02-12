"use client";

/**
 * HMS Medical Masters - Audit History Drawer
 * 
 * Displays audit trail for a master entity with filtering capabilities.
 */

import React, { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Input import removed - not currently used
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import { format } from "date-fns";

// ============== TYPES ==============

interface AuditEntry {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  performedBy: string | null;
  performedAt: Date;
  performerName?: string;
}

interface AuditQueryOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  action?: string;
}

interface AuditHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  fetchAuditHistory: (
    entityId: string,
    options: AuditQueryOptions
  ) => Promise<{
    data: AuditEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>;
}

// ============== COMPONENT ==============

export function AuditHistoryDrawer({
  isOpen,
  onClose,
  entityId,
  entityName,
  fetchAuditHistory,
}: AuditHistoryDrawerProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<AuditQueryOptions>({
    page: 1,
    limit: 10,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Fetch audit history
  useEffect(() => {
    const loadAuditHistory = async () => {
      setIsLoading(true);
      try {
        const result = await fetchAuditHistory(entityId, filters);
        setAuditEntries(result.data);
        setPagination(result.pagination);
      } catch (error) {
        console.error("Failed to load audit history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && entityId) {
      loadAuditHistory();
    }
  }, [isOpen, entityId, filters, fetchAuditHistory]);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleActionFilter = (action: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      action: action === "ALL" ? undefined : action,
      page: 1,
    }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 10 });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Plus className="h-4 w-4" />;
      case "UPDATE":
        return <Edit className="h-4 w-4" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-green-100 text-green-800 border-green-200";
      case "UPDATE":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "DELETE":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const renderChanges = (entry: AuditEntry) => {
    if (entry.action === "CREATE") {
      return (
        <div className="mt-2 text-xs">
          <span className="text-slate-500">Created with values:</span>
          <pre className="mt-1 p-2 bg-slate-50 rounded text-slate-700 overflow-x-auto">
            {JSON.stringify(entry.newValue, null, 2)}
          </pre>
        </div>
      );
    }

    if (entry.action === "DELETE") {
      return (
        <div className="mt-2 text-xs">
          <span className="text-slate-500">Deleted record:</span>
          <pre className="mt-1 p-2 bg-red-50 rounded text-red-700 overflow-x-auto">
            {JSON.stringify(entry.oldValue, null, 2)}
          </pre>
        </div>
      );
    }

    // For UPDATE, show diff
    const changes = getChanges(entry.oldValue, entry.newValue);
    return (
      <div className="mt-2 space-y-2">
        {changes.map((change, idx) => (
          <div key={idx} className="text-xs">
            <span className="font-medium text-slate-700">{change.field}:</span>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 p-1 bg-red-50 rounded">
                <span className="text-red-600 line-through">
                  {String(change.oldValue ?? "(empty)")}
                </span>
              </div>
              <span className="text-slate-400">→</span>
              <div className="flex-1 p-1 bg-green-50 rounded">
                <span className="text-green-600">
                  {String(change.newValue ?? "(empty)")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ============== RENDER ==============

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Audit History - ${entityName}`}
      width="w-[560px]"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {(filters.action || filters.startDate || filters.endDate) && (
              <Badge className="ml-2" variant="secondary">
                Active
              </Badge>
            )}
          </Button>

          {(filters.action || filters.startDate || filters.endDate) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">
                  Action Type
                </label>
                <Select
                  value={filters.action ?? "ALL"}
                  onValueChange={handleActionFilter}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="CREATE">Create</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Audit Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : auditEntries.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500 mt-2">No audit records found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() =>
                    setExpandedEntry(
                      expandedEntry === entry.id ? null : entry.id
                    )
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${getActionColor(
                          entry.action
                        )}`}
                      >
                        {getActionIcon(entry.action)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {entry.action}
                        </p>
                        <p className="text-xs text-slate-500">
                          by {entry.performerName ?? "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 text-right">
                      {format(new Date(entry.performedAt), "PPp")}
                    </div>
                  </div>

                  {expandedEntry === entry.id && renderChanges(entry)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600">
                {pagination.page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ============== UTILITIES ==============

function getChanges(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  
  if (!oldValue || !newValue) return changes;

  // Fields to skip in comparison
  const skipFields = ["id", "tenantId", "createdAt", "updatedAt", "version"];

  const allKeys = new Set([
    ...Object.keys(oldValue),
    ...Object.keys(newValue),
  ]);

  allKeys.forEach((key) => {
    if (skipFields.includes(key)) return;

    const oldVal = oldValue[key];
    const newVal = newValue[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  });

  return changes;
}

export default AuditHistoryDrawer;
