"use client";

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal, Download, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowSelect?: (selectedRows: T[]) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onAudit?: (row: T) => void;
  onExport?: (format: 'csv' | 'excel', selectedOnly?: boolean) => void;
  onImport?: () => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  loading = false,
  emptyMessage = "No data available",
  onRowSelect,
  onSort,
  onEdit,
  onDelete,
  onAudit,
  onExport,
  onImport,
  pagination,
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const hasActions = onEdit || onDelete || onAudit;
  const hasBulkActions = selectedRows.size > 0;
  const hasImportExport = onExport || onImport;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data.map(row => row.id));
      setSelectedRows(allIds);
      onRowSelect?.(data);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.([]);
    }
  };

  const handleRowSelect = (rowId: string | number, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);

    const selectedData = data.filter(row => newSelected.has(row.id));
    onRowSelect?.(selectedData);
  };

  const handleSort = (key: string) => {
    if (!onSort) return;

    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    onSort(key, newDirection);
  };

  const renderCell = (row: T, column: Column<T>) => {
    // Handle nested keys like "_count.userRoles"
    const getNestedValue = (obj: any, path: string | undefined) => {
      if (!path) return undefined;
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    const value = getNestedValue(row, column.key as string);
    return column.render ? column.render(value, row) : value;
  };

  const renderSkeleton = () => (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-200">
          <td className="px-4 py-3">
            <div className="h-4 bg-slate-200 rounded w-4"></div>
          </td>
          <td className="px-4 py-3">
            <div className="h-4 bg-slate-200 rounded w-8"></div>
          </td>
          {columns.map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-slate-200 rounded w-20"></div>
            </td>
          ))}
          {hasActions && (
            <td className="px-4 py-3">
              <div className="h-8 bg-slate-200 rounded w-8"></div>
            </td>
          )}
        </tr>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Import/Export Toolbar */}
      {hasImportExport && (
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {hasBulkActions && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">
                  {selectedRows.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const selectedData = data.filter(row => selectedRows.has(row.id));
                    onDelete?.(selectedData[0]); // For simplicity, handle first selected
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onImport && (
              <Button variant="outline" size="sm" onClick={onImport}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            )}
            {onExport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExport('csv', false)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
                {selectedRows.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport('csv', true)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={selectedRows.size === data.length && data.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                S.No
              </th>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-slate-100' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              renderSkeleton()
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2 + (hasActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    selectedRows.has(row.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedRows.has(row.id)}
                      onCheckedChange={(checked) => handleRowSelect(row.id, checked as boolean)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {pagination
                      ? (pagination.currentPage - 1) * pagination.pageSize + index + 1
                      : index + 1
                    }
                  </td>
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-4 py-3 text-sm text-slate-900">
                      {renderCell(row, column)}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(row)}
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(row)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              Showing {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalRecords)} to{' '}
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords)} of{' '}
              {pagination.totalRecords} results
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Rows per page:</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}