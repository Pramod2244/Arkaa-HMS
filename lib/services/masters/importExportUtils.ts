/**
 * HMS Medical Masters - Import/Export Utilities
 * 
 * Reusable utilities for importing and exporting master data
 * in CSV, Excel, and JSON formats.
 */

import { ExportFormat } from "./types";

// ============== CSV UTILITIES ==============

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  
  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const lines: string[] = [];
  
  // Header row
  lines.push(headers.map(escapeCSVValue).join(','));
  
  // Data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return escapeCSVValue(value);
    });
    lines.push(values.join(','));
  }
  
  return lines.join('\n');
}

/**
 * Escape a value for CSV output
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // If value contains comma, newline, or quote, wrap in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

// ============== EXCEL UTILITIES ==============

/**
 * Parse Excel file (XLSX) - uses simple XML parsing for .xlsx files
 * For production, consider using a library like SheetJS (xlsx)
 */
export async function parseExcel(_file: File): Promise<Record<string, string>[]> {
  // For now, we'll handle Excel files on the client side
  // This is a placeholder - actual implementation would use a library
  throw new Error('Excel parsing requires client-side implementation with xlsx library');
}

/**
 * Convert data to Excel format
 * Returns a base64 string that can be used to create a downloadable file
 */
export function toExcelCSV(data: Record<string, unknown>[]): string {
  // For Excel, we use CSV with BOM for proper encoding
  const csv = toCSV(data);
  return '\ufeff' + csv; // BOM for Excel UTF-8 compatibility
}

// ============== JSON UTILITIES ==============

/**
 * Parse JSON string to array of objects
 */
export function parseJSON(jsonContent: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(jsonContent);
    
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    // If it's an object with a data array, use that
    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    
    // Single object, wrap in array
    return [parsed];
  } catch {
    throw new Error('Invalid JSON format');
  }
}

/**
 * Convert array of objects to JSON string
 */
export function toJSON(data: Record<string, unknown>[]): string {
  return JSON.stringify({ data, exportedAt: new Date().toISOString() }, null, 2);
}

// ============== FILE HANDLING ==============

/**
 * Read file content as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Determine file format from file name
 */
export function getFileFormat(fileName: string): ExportFormat | null {
  const ext = fileName.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'csv':
      return 'csv';
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'json':
      return 'json';
    default:
      return null;
  }
}

/**
 * Create downloadable file blob
 */
export function createDownloadBlob(
  content: string,
  format: ExportFormat
): { blob: Blob; mimeType: string; extension: string } {
  switch (format) {
    case 'csv':
      return {
        blob: new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' }),
        mimeType: 'text/csv',
        extension: 'csv',
      };
    case 'excel':
      return {
        blob: new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' }),
        mimeType: 'application/vnd.ms-excel',
        extension: 'csv', // Using CSV with Excel mime type for compatibility
      };
    case 'json':
      return {
        blob: new Blob([content], { type: 'application/json' }),
        mimeType: 'application/json',
        extension: 'json',
      };
  }
}

/**
 * Trigger browser download
 */
export function downloadFile(
  blob: Blob,
  fileName: string
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============== TEMPLATE GENERATION ==============

/**
 * Generate import template CSV
 */
export function generateImportTemplate(
  columns: string[],
  sampleRow: Record<string, string>
): string {
  const lines: string[] = [];
  
  // Header
  lines.push(columns.join(','));
  
  // Sample row
  const values = columns.map((col) => escapeCSVValue(sampleRow[col] ?? ''));
  lines.push(values.join(','));
  
  return '\ufeff' + lines.join('\n');
}

// ============== VALIDATION ==============

/**
 * Validate import file structure
 */
export function validateImportStructure(
  data: Record<string, unknown>[],
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  if (data.length === 0) {
    return { valid: false, missingFields: requiredFields };
  }
  
  const headers = Object.keys(data[0]).map((h) => h.toLowerCase());
  const missingFields = requiredFields.filter(
    (field) => !headers.includes(field.toLowerCase())
  );
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
