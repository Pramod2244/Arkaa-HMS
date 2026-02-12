"use client";

import React, { useRef } from 'react';
import { Upload, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImportExportToolbarProps {
  onImport?: (file: File) => void;
  onExport?: (format: 'csv' | 'excel') => void;
  importLoading?: boolean;
  exportLoading?: boolean;
  acceptTypes?: string;
}

export function ImportExportToolbar({
  onImport,
  onExport,
  importLoading = false,
  exportLoading = false,
  acceptTypes = ".csv,.xlsx,.xls"
}: ImportExportToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center space-x-3">
      {onImport && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            disabled={importLoading}
            className="flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>{importLoading ? 'Importing...' : 'Import'}</span>
          </Button>
        </>
      )}

      {onExport && (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('csv')}
            disabled={exportLoading}
            className="flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>{exportLoading ? 'Exporting...' : 'Export CSV'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('excel')}
            disabled={exportLoading}
            className="flex items-center space-x-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{exportLoading ? 'Exporting...' : 'Export Excel'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}