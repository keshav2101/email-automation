'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Upload,
  Table as TableIcon,
  Search,
  Download,
  Send,
  Database,
  CheckCircle,
  AlertCircle,
  Columns,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { extractorApi, batchApi } from '@/lib/api';
import { clsx } from 'clsx';

interface ColumnInfo {
  name: string;
  data_type: string;
  non_null_count: number;
  total_count: number;
  fill_rate_percent: number;
  unique_count: number;
  sample_values: string[];
  suggested_mapping?: string;
}

interface ValidationSummary {
  total_rows: number;
  total_columns: number;
  total_cells: number;
  non_empty_cells: number;
  overall_fill_rate: number;
  detected_email_column?: string;
  valid_email_count: number;
  invalid_email_count: number;
  duplicate_email_count: number;
}

interface ExtractResponse {
  filename: string;
  file_type: string;
  file_size_bytes: number;
  sheets: string[];
  current_sheet: string;
  total_rows: number;
  total_columns: number;
  columns: ColumnInfo[];
  rows: Record<string, any>[];
  suggested_mapping: Record<string, string>;
  summary: ValidationSummary;
}

const CRM_FIELDS = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'hr_email', label: 'HR / Recruiter Email' },
  { key: 'hr_name', label: 'Recruiter Full Name' },
  { key: 'job_role', label: 'Job Role / Title' },
  { key: 'location', label: 'Location / City' },
  { key: 'website', label: 'Company Website' },
  { key: 'linkedin_url', label: 'LinkedIn Profile' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'industry', label: 'Industry' },
  { key: 'notes', label: 'Custom Notes / Details' },
];

export default function DataExtractorPage() {
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  // Sheet navigation
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Column mapping state: maps CRM field key -> original column name
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Active view: 'grid' | 'schema'
  const [activeTab, setActiveTab] = useState<'grid' | 'schema'>('grid');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected rows
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Import to CRM modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importOptions, setImportOptions] = useState({
    create_companies: true,
    create_contacts: true,
    create_jobs: true,
    default_priority: 'medium',
  });

  // Handle file upload
  const handleFileUpload = async (file: File, sheetName?: string) => {
    setExtracting(true);
    setRawFile(file);
    try {
      const res: ExtractResponse = await extractorApi.extractData(file, sheetName);
      setData(res);
      setSelectedSheet(res.current_sheet);
      setMapping(res.suggested_mapping || {});
      setVisibleColumns(res.columns.map((c) => c.name));
      setPage(1);
      // Select all rows by default
      setSelectedRowIndices(new Set(res.rows.map((_, i) => i)));
      toast.success(`Extracted ${res.total_rows} rows & ${res.total_columns} columns successfully!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to extract data from spreadsheet');
    } finally {
      setExtracting(false);
    }
  };

  // Change Excel sheet
  const handleSheetChange = async (sheet: string) => {
    if (!rawFile || sheet === selectedSheet) return;
    await handleFileUpload(rawFile, sheet);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data.rows;
    const q = searchQuery.toLowerCase();
    return data.rows.filter((row) =>
      Object.values(row).some((val) => String(val || '').toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

  // Toggle single row selection
  const toggleRow = (idx: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Toggle all rows selection
  const toggleAll = () => {
    if (selectedRowIndices.size === filteredRows.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(filteredRows.map((_, i) => i)));
    }
  };

  // Update a field mapping
  const handleMappingChange = (fieldKey: string, colName: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!colName) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = colName;
      }
      return next;
    });
  };

  // Import to CRM
  const handleImportToCrm = async () => {
    if (!data) return;
    setImporting(true);
    try {
      // Use selected rows or all rows
      const targetRows = data.rows.filter((_, i) => selectedRowIndices.has(i));
      if (targetRows.length === 0) {
        toast.error('Please select at least one row to import');
        setImporting(false);
        return;
      }

      const res = await extractorApi.importCrm({
        rows: targetRows,
        mapping,
        ...importOptions,
      });

      toast.success(
        `Imported: ${res.companies_created} companies, ${res.contacts_created} contacts, ${res.jobs_created} jobs!`
      );
      setShowImportModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'CRM import failed');
    } finally {
      setImporting(false);
    }
  };

  // Send to Batch Email Outreach
  const handleSendToBatchOutreach = () => {
    if (!data) return;
    const companyCol = mapping['company_name'];
    const emailCol = mapping['hr_email'];
    const nameCol = mapping['hr_name'];
    const roleCol = mapping['job_role'];

    if (!companyCol || !emailCol) {
      toast.error('Please map both "Company Name" and "HR Email" columns before launching outreach');
      return;
    }

    const selectedRows = data.rows.filter((_, i) => selectedRowIndices.has(i));
    const normalizedRows = selectedRows
      .filter((r) => r[emailCol] && r[companyCol])
      .map((r) => ({
        company_name: String(r[companyCol]).trim(),
        hr_email: String(r[emailCol]).trim(),
        hr_name: nameCol ? String(r[nameCol] || '').trim() : '',
        job_role: roleCol ? String(r[roleCol] || '').trim() : '',
        raw_data: r,
      }));

    if (normalizedRows.length === 0) {
      toast.error('No valid rows found with both Company and Email');
      return;
    }

    // Save to sessionStorage and navigate
    sessionStorage.setItem('pending_batch_rows', JSON.stringify(normalizedRows));
    toast.success(`Loaded ${normalizedRows.length} contacts! Redirecting to Batch Outreach...`);
    router.push('/dashboard/excel-automation');
  };

  // Export Data
  const handleExport = (format: 'csv' | 'json') => {
    if (!data) return;
    const targetRows = data.rows.filter((_, i) => selectedRowIndices.has(i));
    extractorApi.exportCleaned(targetRows.length > 0 ? targetRows : data.rows, format);
    toast.success(`Exporting as ${format.toUpperCase()}...`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Excel & CSV Data Extractor</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Extract all columns, rows, and sheets from any spreadsheet. Inspect data quality, map fields, and sync to CRM or AI outreach.
              </p>
            </div>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-secondary text-xs flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <Database className="w-3.5 h-3.5" />
              Sync to CRM
            </button>
            <button
              onClick={handleSendToBatchOutreach}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Launch Batch AI Emails
            </button>
          </div>
        )}
      </div>

      {/* Upload Box */}
      {!data ? (
        <div className="card p-12 text-center border-dashed border-2 border-surface-border hover:border-brand-500/50 transition-colors">
          <input
            type="file"
            id="excel-extractor-input"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <label htmlFor="excel-extractor-input" className="cursor-pointer flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 hover:scale-105 transition-transform">
              {extracting ? (
                <RefreshCw className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              {extracting ? 'Extracting All Spreadsheet Data...' : 'Upload Excel or CSV Spreadsheet'}
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
              Drag and drop any <code className="text-brand-300">.xlsx</code>, <code className="text-brand-300">.xls</code>, or <code className="text-brand-300">.csv</code> file.
              All sheets, columns, and rows will be extracted with full schema detection.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>✓ Multi-sheet support</span>
              <span>•</span>
              <span>✓ Auto data-type inference</span>
              <span>•</span>
              <span>✓ Smart column mapping</span>
            </div>
          </label>
        </div>
      ) : (
        <>
          {/* Active File Bar & Sheet Tabs */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-500/15 text-brand-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{data.filename}</p>
                <p className="text-xs text-gray-400">
                  {(data.file_size_bytes / 1024).toFixed(1)} KB • {data.total_rows} rows • {data.total_columns} columns
                </p>
              </div>
            </div>

            {/* Sheets Selector */}
            {data.sheets.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-surface-card rounded-lg border border-surface-border">
                <span className="text-xs text-gray-400 px-2 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Sheets:
                </span>
                {data.sheets.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSheetChange(s)}
                    className={clsx(
                      'px-3 py-1 rounded text-xs font-medium transition-colors',
                      s === selectedSheet
                        ? 'bg-brand-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-surface-border'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Change File Button */}
            <label
              htmlFor="excel-extractor-reupload"
              className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Different File
              <input
                type="file"
                id="excel-extractor-reupload"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="stat-card">
              <p className="text-2xl font-bold text-white">{data.summary.total_rows}</p>
              <p className="text-xs text-gray-400 mt-1">Total Rows Extracted</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-blue-400">{data.summary.total_columns}</p>
              <p className="text-xs text-gray-400 mt-1">Total Columns Detected</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-emerald-400">{data.summary.overall_fill_rate}%</p>
              <p className="text-xs text-gray-400 mt-1">Data Fill Rate</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-brand-400">{data.summary.valid_email_count}</p>
              <p className="text-xs text-gray-400 mt-1">Valid Emails Found</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-amber-400">{data.summary.duplicate_email_count}</p>
              <p className="text-xs text-gray-400 mt-1">Duplicate Emails</p>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('grid')}
                className={clsx(
                  'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors',
                  activeTab === 'grid'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-surface-card'
                )}
              >
                <TableIcon className="w-4 h-4" />
                Data Grid ({filteredRows.length} rows)
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={clsx(
                  'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors',
                  activeTab === 'schema'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-surface-card'
                )}
              >
                <Columns className="w-4 h-4" />
                Schema & Field Mapping ({data.columns.length} columns)
              </button>
            </div>

            <div className="text-xs text-gray-400">
              Selected: <span className="text-white font-semibold">{selectedRowIndices.size}</span> of {data.rows.length} rows
            </div>
          </div>

          {/* TAB 1: DATA GRID */}
          {activeTab === 'grid' && (
            <div className="space-y-4">
              {/* Controls Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search across all columns..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="input pl-9 text-xs w-full py-2"
                    />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Select All / Deselect */}
                  <button
                    onClick={toggleAll}
                    className="btn btn-secondary text-xs py-1.5 px-3"
                  >
                    {selectedRowIndices.size === filteredRows.length ? 'Deselect All' : 'Select All'}
                  </button>

                  {/* Column Visibility Filter */}
                  <div className="relative">
                    <button
                      onClick={() => setShowColumnFilter(!showColumnFilter)}
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Columns ({visibleColumns.length})
                    </button>
                    {showColumnFilter && (
                      <div className="absolute right-0 mt-2 w-64 p-3 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-20 space-y-2 max-h-60 overflow-y-auto">
                        <div className="flex items-center justify-between pb-1 border-b border-surface-border">
                          <span className="text-xs font-semibold text-white">Show/Hide Columns</span>
                          <button
                            onClick={() => setVisibleColumns(data.columns.map((c) => c.name))}
                            className="text-[10px] text-brand-400 hover:underline"
                          >
                            Show All
                          </button>
                        </div>
                        {data.columns.map((c) => (
                          <label
                            key={c.name}
                            className="flex items-center gap-2 text-xs text-gray-300 hover:text-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns.includes(c.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setVisibleColumns([...visibleColumns, c.name]);
                                } else {
                                  if (visibleColumns.length > 1) {
                                    setVisibleColumns(visibleColumns.filter((col) => col !== c.name));
                                  }
                                }
                              }}
                              className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rows per page */}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="input text-xs py-1.5 px-2 bg-surface-card border-surface-border"
                  >
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                    <option value={100}>100 rows</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="card p-0 overflow-hidden border border-surface-border">
                <div className="overflow-x-auto max-h-[560px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-card/80 sticky top-0 z-10 border-b border-surface-border">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowIndices.size === filteredRows.length && filteredRows.length > 0}
                            onChange={toggleAll}
                            className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                          />
                        </th>
                        <th className="p-3 w-12 text-gray-500 font-mono text-[10px]">#</th>
                        {data.columns
                          .filter((c) => visibleColumns.includes(c.name))
                          .map((col) => (
                            <th key={col.name} className="p-3 font-semibold text-gray-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{col.name}</span>
                                <span className={clsx(
                                  'text-[9px] px-1 py-0.5 rounded font-mono uppercase',
                                  col.data_type === 'email' && 'bg-brand-500/20 text-brand-300',
                                  col.data_type === 'url' && 'bg-blue-500/20 text-blue-300',
                                  col.data_type === 'phone' && 'bg-purple-500/20 text-purple-300',
                                  col.data_type === 'number' && 'bg-emerald-500/20 text-emerald-300',
                                  col.data_type === 'date' && 'bg-amber-500/20 text-amber-300',
                                  col.data_type === 'text' && 'bg-gray-700/30 text-gray-400',
                                )}>
                                  {col.data_type}
                                </span>
                              </div>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={visibleColumns.length + 2} className="p-8 text-center text-gray-500">
                            No rows match your search query.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row, idx) => {
                          const originalIdx = (page - 1) * pageSize + idx;
                          const isSelected = selectedRowIndices.has(originalIdx);
                          return (
                            <tr
                              key={originalIdx}
                              className={clsx(
                                'hover:bg-surface-card/40 transition-colors',
                                isSelected ? 'bg-brand-500/5' : ''
                              )}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRow(originalIdx)}
                                  className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                                />
                              </td>
                              <td className="p-3 font-mono text-[10px] text-gray-500">{originalIdx + 1}</td>
                              {data.columns
                                .filter((c) => visibleColumns.includes(c.name))
                                .map((col) => {
                                  const cellVal = row[col.name];
                                  const strVal = cellVal !== null && cellVal !== undefined ? String(cellVal) : '';
                                  return (
                                    <td
                                      key={col.name}
                                      className="p-3 text-gray-300 max-w-xs truncate"
                                      title={strVal}
                                    >
                                      {strVal ? (
                                        col.data_type === 'url' ? (
                                          <a
                                            href={strVal.startsWith('http') ? strVal : `https://${strVal}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline"
                                          >
                                            {strVal}
                                          </a>
                                        ) : col.data_type === 'email' ? (
                                          <span className="font-mono text-brand-300">{strVal}</span>
                                        ) : (
                                          <span>{strVal}</span>
                                        )
                                      ) : (
                                        <span className="text-gray-600 italic">null</span>
                                      )}
                                    </td>
                                  );
                                })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 border-t border-surface-border flex items-center justify-between text-xs text-gray-400 bg-surface-card/40">
                  <span>
                    Showing {filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
                    {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} rows
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-gray-300 font-medium">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      disabled={page === totalPages}
                      className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEMA & FIELD MAPPING */}
          {activeTab === 'schema' && (
            <div className="space-y-6">
              <div className="card p-5 bg-gradient-to-r from-brand-500/10 to-transparent border-brand-500/30">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Smart Column Mapping</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      We automatically detected candidate fields from header names and content types.
                      Verify or re-map which column corresponds to each CRM outreach field below.
                    </p>
                  </div>
                </div>
              </div>

              {/* CRM Standard Fields Mapping Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {CRM_FIELDS.map((crm) => (
                  <div key={crm.key} className="card p-4 space-y-2 border-surface-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{crm.label}</span>
                        {(crm.key === 'company_name' || crm.key === 'hr_email') && (
                          <span className="text-[10px] text-amber-400 font-normal">(Required)</span>
                        )}
                      </label>
                      {mapping[crm.key] && (
                        <span className="badge badge-green text-[10px] py-0 px-1.5">Mapped</span>
                      )}
                    </div>

                    <select
                      value={mapping[crm.key] || ''}
                      onChange={(e) => handleMappingChange(crm.key, e.target.value)}
                      className="input text-xs w-full py-2 bg-surface"
                    >
                      <option value="">-- Unmapped / Skip --</option>
                      {data.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.data_type}, {c.fill_rate_percent}% filled)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Column Schema Deep Dive Cards */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">All Extracted Columns ({data.columns.length})</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  {data.columns.map((col) => (
                    <div key={col.name} className="card p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white truncate max-w-[180px]">{col.name}</span>
                        <span className="badge badge-purple text-[10px] py-0 px-1.5 uppercase font-mono">
                          {col.data_type}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>Fill Rate</span>
                          <span>{col.fill_rate_percent}% ({col.non_null_count}/{col.total_count})</span>
                        </div>
                        <div className="w-full bg-surface-border h-1.5 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              col.fill_rate_percent > 80 ? 'bg-emerald-400' : col.fill_rate_percent > 40 ? 'bg-amber-400' : 'bg-red-400'
                            )}
                            style={{ width: `${col.fill_rate_percent}%` }}
                          />
                        </div>
                      </div>

                      {col.sample_values && col.sample_values.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Sample Values:</p>
                          <div className="flex flex-wrap gap-1">
                            {col.sample_values.slice(0, 3).map((val, i) => (
                              <span key={i} className="text-[10px] bg-surface-border/50 text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                                {val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sync to CRM Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-5 animate-scale-in border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Import Extracted Data to CRM</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              This will ingest <span className="text-white font-semibold">{selectedRowIndices.size} selected rows</span> into your CRM database based on your mapped columns.
            </p>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Create / Update Companies</p>
                  <p className="text-[10px] text-gray-500">Sync company name, website, location, and industry</p>
                </div>
                <input
                  type="checkbox"
                  checked={importOptions.create_companies}
                  onChange={(e) =>
                    setImportOptions({ ...importOptions, create_companies: e.target.checked })
                  }
                  className="rounded border-surface-border bg-surface text-emerald-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Create / Update HR Contacts</p>
                  <p className="text-[10px] text-gray-500">Sync recruiter emails, names, LinkedIn, and phone</p>
                </div>
                <input
                  type="checkbox"
                  checked={importOptions.create_contacts}
                  onChange={(e) =>
                    setImportOptions({ ...importOptions, create_contacts: e.target.checked })
                  }
                  className="rounded border-surface-border bg-surface text-emerald-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Record Job Opportunities</p>
                  <p className="text-[10px] text-gray-500">Link target roles to target companies</p>
                </div>
                <input
                  type="checkbox"
                  checked={importOptions.create_jobs}
                  onChange={(e) =>
                    setImportOptions({ ...importOptions, create_jobs: e.target.checked })
                  }
                  className="rounded border-surface-border bg-surface text-emerald-500 focus:ring-0"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleImportToCrm}
                disabled={importing}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {importing ? 'Importing to CRM...' : 'Confirm & Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
