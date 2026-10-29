'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Send,
  Download,
  Trash2,
  Edit3,
  RefreshCw,
  FileText,
  Building2,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { batchApi, candidateApi, bulkAutomationApi, emailPluginApi } from '@/lib/api';
import { Zap, Wifi, WifiOff } from 'lucide-react';

interface BatchRow {
  company_name: string;
  hr_email: string;
  hr_name?: string;
  job_role?: string;
  is_valid_email: boolean;
  is_duplicate: boolean;
  is_already_contacted: boolean;
  raw_data?: Record<string, any>;
}

interface ValidationData {
  filename: string;
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  already_contacted_count: number;
  all_columns?: string[];
  rows: BatchRow[];
}

interface DraftResult {
  draft_id: number;
  company_name: string;
  recipient_email: string;
  recipient_name?: string;
  target_role?: string;
  subject: string;
  body: string;
  word_count: number;
  confidence_score: number;
  status: string;
}

export default function ExcelAutomationPage() {
  const [activeResume, setActiveResume] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Upload & validation state
  const [validating, setValidating] = useState(false);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('professional');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<DraftResult[]>([]);

  // Sending & Throttling state
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [dailyLimit, setDailyLimit] = useState(40);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Load active candidate profile & email plugin status
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await candidateApi.getProfile();
      setActiveResume(data);
    } catch {}
    finally {
      setLoadingProfile(false);
    }

    try {
      const pStatus = await emailPluginApi.getStatus();
      setEmailStatus(pStatus);
    } catch {}
  }, []);

  const handleInlineResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      await candidateApi.uploadResume(file, 'Imported Resume');
      toast.success('Resume uploaded & parsed successfully!');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Resume upload failed');
    } finally {
      setUploadingResume(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    loadProfile();

    // Check if data was forwarded from Data Extractor
    try {
      const stored = sessionStorage.getItem('pending_batch_rows');
      if (stored) {
        sessionStorage.removeItem('pending_batch_rows');
        const rows = JSON.parse(stored);
        if (Array.isArray(rows) && rows.length > 0) {
          const batchRows: BatchRow[] = rows.map((r) => ({
            company_name: r.company_name,
            hr_email: r.hr_email,
            hr_name: r.hr_name || '',
            job_role: r.job_role || '',
            is_valid_email: true,
            is_duplicate: false,
            is_already_contacted: false,
            raw_data: r.raw_data,
          }));
          setValidationData({
            filename: 'Extracted Leads',
            total_rows: batchRows.length,
            valid_count: batchRows.length,
            invalid_count: 0,
            duplicate_count: 0,
            already_contacted_count: 0,
            rows: batchRows,
          });
          toast.success(`Imported ${batchRows.length} contacts from Data Extractor!`);
        }
      }
    } catch {
      // Ignored
    }
  }, [loadProfile]);

  // Handle Sheet Upload
  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidating(true);
    try {
      const res = await batchApi.validateSheet(file);
      setValidationData(res);
      setDrafts([]);
      toast.success(`Validated ${res.total_rows} rows from ${file.name}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to validate sheet');
    } finally {
      setValidating(false);
    }
  };

  // Handle Batch Generation
  const handleGenerateAll = async () => {
    if (!validationData || validationData.rows.length === 0) return;

    setGenerating(true);
    try {
      const res = await batchApi.processBatch({
        rows: validationData.rows,
        skip_duplicates: skipDuplicates,
        skip_invalid: skipInvalid,
        style: selectedStyle,
      });
      setDrafts(res);
      toast.success(`Generated ${res.length} personalized emails!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate drafts');
    } finally {
      setGenerating(false);
    }
  };

  // Handle Single Draft Update
  const handleUpdateDraft = (id: number, field: 'subject' | 'body', value: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.draft_id === id) {
          const updated = { ...d, [field]: value };
          if (field === 'body') updated.word_count = value.split(/\s+/).filter(Boolean).length;
          return updated;
        }
        return d;
      })
    );
  };

  // Handle Single Draft Approval
  const handleApproveDraft = (id: number) => {
    setDrafts((prev) =>
      prev.map((d) => (d.draft_id === id ? { ...d, status: 'approved' } : d))
    );
    toast.success('Draft approved!');
  };

  // Handle Approve All
  const handleApproveAll = () => {
    setDrafts((prev) => prev.map((d) => ({ ...d, status: 'approved' })));
    toast.success('All drafts approved and ready to send!');
  };

  // Handle Batch Dispatch with Throttling via Bulk Automation Engine
  const handleStartDispatch = async () => {
    const approved = drafts.filter((d) => d.status === 'approved');
    if (approved.length === 0) {
      toast.error('No approved drafts to send. Approve drafts first.');
      return;
    }

    setSending(true);
    setSendProgress(0);

    try {
      const res = await bulkAutomationApi.start({
        draft_ids: approved.map((d) => d.draft_id),
        delay_seconds: delaySeconds,
        random_jitter: 2,
        daily_limit: dailyLimit,
        dry_run: false,
      });

      setActiveJob(res);
      toast.success('Bulk automation engine started in background!');

      // Poll progress every 1.5s
      const timer = setInterval(async () => {
        try {
          const status = await bulkAutomationApi.getJobStatus(res.job_id);
          setActiveJob(status);
          setSendProgress(status.progress_percent || 0);
          if (status.results && status.results.length > 0) {
            setDeliveryLogs(status.results);
          }
          if (status.status === 'completed' || status.status === 'cancelled' || status.status === 'failed') {
            clearInterval(timer);
            setSending(false);
            if (status.status === 'completed') {
              toast.success(`Automation complete! Sent ${status.sent_count} emails.`);
            }
            // Update local drafts
            const sentIds = new Set(
              (status.results || []).filter((r: any) => r.status === 'sent').map((r: any) => r.draft_id)
            );
            setDrafts((prev) =>
              prev.map((d) => (sentIds.has(d.draft_id) ? { ...d, status: 'sent' } : d))
            );
          }
        } catch {
          clearInterval(timer);
          setSending(false);
        }
      }, 1500);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Dispatch failed');
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 shadow-xl shadow-brand-500/20 text-white">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Excel & CSV Email Automation
                <span className="badge badge-purple text-xs">Direct Workflow</span>
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Upload your resume once, upload an Excel file of HR contacts, and automatically generate company-personalized emails.
              </p>
            </div>
          </div>
        </div>

        {/* Download Sample Template */}
        <a
          href={batchApi.getTemplateUrl()}
          download="sample_hr_contacts.csv"
          className="btn-secondary text-xs flex items-center gap-2 px-4 py-2.5 self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-brand-400" />
          <span>Download Sample Excel / CSV</span>
        </a>
      </div>

      {/* Email Sender Plugin Status */}
      <div className="card p-4 border border-surface-border bg-surface/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Email Sender Plugin:</span>
              {emailStatus?.connected ? (
                <span className="badge badge-green text-[10px] flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5" /> Connected ({emailStatus.sender_email})
                </span>
              ) : (
                <span className="badge badge-yellow text-[10px] flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" /> Not Connected (Save as Drafts)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {emailStatus?.connected
                ? `Using ${emailStatus.plugin_type?.toUpperCase()} plugin to send bulk emails from "${emailStatus.from_name || 'Alex Candidate'}".`
                : 'Connect your Gmail (App Password), Outlook, or SMTP server in Settings to dispatch directly.'}
            </p>
          </div>
        </div>

        <a
          href="/dashboard/settings"
          className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 self-start sm:self-auto border-brand-500/30 text-brand-300 hover:text-white"
        >
          {emailStatus?.connected ? 'Manage Plugin' : 'Connect Email Plugin →'}
        </a>
      </div>

      {/* Step 1: Candidate Resume Status */}
      <div className="card p-5 border border-surface-border bg-surface/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Step 1: Active Resume Ground Truth</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeResume?.full_name ? (
                  <>
                    Using profile: <span className="text-brand-300 font-semibold">{activeResume.full_name}</span> ({activeResume.email || 'No email set'})
                    {activeResume.technical_skills?.length > 0 && (
                      <span className="ml-2 text-gray-500">
                        • {activeResume.technical_skills.slice(0, 4).join(', ')}
                      </span>
                    )}
                  </>
                ) : (
                  'No resume profile detected. Emails will use default profile information.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer text-brand-300 border-brand-500/30 hover:bg-surface-elevated">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingResume ? 'Uploading...' : 'Upload Resume Document'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.rtf,.md"
                className="hidden"
                disabled={uploadingResume}
                onChange={handleInlineResumeUpload}
              />
            </label>
            <a href="/dashboard/profile" className="text-xs text-gray-400 hover:text-white underline font-medium">
              Profile Details →
            </a>
          </div>
        </div>
      </div>

      {/* Step 2: Upload Excel / CSV */}
      <div className="card p-6 border border-surface-border bg-surface/80">
        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-400" />
          <span>Step 2: Upload Excel or CSV Sheet</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Expected headers: <code className="px-1.5 py-0.5 rounded bg-surface-elevated text-brand-300">Company Name</code>,{' '}
          <code className="px-1.5 py-0.5 rounded bg-surface-elevated text-brand-300">HR Email</code>,{' '}
          <code className="px-1.5 py-0.5 rounded bg-surface-elevated text-gray-400">HR Name (optional)</code>,{' '}
          <code className="px-1.5 py-0.5 rounded bg-surface-elevated text-gray-400">Job Role (optional)</code>.
        </p>

        <label className="border-2 border-dashed border-surface-border hover:border-brand-500/60 transition-colors rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-surface/40 hover:bg-surface-elevated/40">
          <FileSpreadsheet className="w-10 h-10 text-gray-500 mb-3" />
          <p className="text-sm font-semibold text-white">
            {validating ? 'Validating spreadsheet...' : 'Click to upload or drag and drop Excel (.xlsx, .xls) or CSV'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Automatic duplicate & format validation</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleSheetUpload}
            className="hidden"
            disabled={validating}
          />
        </label>
      </div>

      {/* Step 3: Validation Preview & Stats */}
      {validationData && (
        <div className="card p-6 border border-surface-border bg-surface/90 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Step 3: Preview & Validate Imported Sheet</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                File: <span className="text-white font-medium">{validationData.filename}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                />
                <span>Auto-skip duplicates ({validationData.duplicate_count})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={skipInvalid}
                  onChange={(e) => setSkipInvalid(e.target.checked)}
                  className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                />
                <span>Auto-skip invalid ({validationData.invalid_count})</span>
              </label>
            </div>
          </div>

          {/* KPI metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card-sm bg-surface-elevated/50 p-3">
              <span className="text-[11px] text-gray-400 font-semibold uppercase">Total Rows</span>
              <p className="text-xl font-bold text-white mt-1">{validationData.total_rows}</p>
            </div>
            <div className="card-sm bg-surface-elevated/50 p-3">
              <span className="text-[11px] text-emerald-400 font-semibold uppercase">Valid Emails</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">{validationData.valid_count}</p>
            </div>
            <div className="card-sm bg-surface-elevated/50 p-3">
              <span className="text-[11px] text-amber-400 font-semibold uppercase">Duplicates</span>
              <p className="text-xl font-bold text-amber-400 mt-1">{validationData.duplicate_count}</p>
            </div>
            <div className="card-sm bg-surface-elevated/50 p-3">
              <span className="text-[11px] text-red-400 font-semibold uppercase">Invalid Emails</span>
              <p className="text-xl font-bold text-red-400 mt-1">{validationData.invalid_count}</p>
            </div>
            <div className="card-sm bg-surface-elevated/50 p-3">
              <span className="text-[11px] text-purple-400 font-semibold uppercase">Past Contacts</span>
              <p className="text-xl font-bold text-purple-400 mt-1">{validationData.already_contacted_count}</p>
            </div>
          </div>

          {/* Validation Table Preview */}
          <div className="border border-surface-border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-elevated text-gray-400 border-b border-surface-border sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">HR Email</th>
                  <th className="px-4 py-2.5">HR Name</th>
                  <th className="px-4 py-2.5">Job Role</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface/50">
                {validationData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated/40">
                    <td className="px-4 py-2 text-white font-medium">{row.company_name}</td>
                    <td className="px-4 py-2 font-mono text-gray-300">{row.hr_email}</td>
                    <td className="px-4 py-2 text-gray-400">{row.hr_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{row.job_role || '—'}</td>
                    <td className="px-4 py-2">
                      {!row.is_valid_email ? (
                        <span className="badge badge-red text-[10px]">Invalid Email</span>
                      ) : row.is_duplicate ? (
                        <span className="badge badge-yellow text-[10px]">Duplicate</span>
                      ) : row.is_already_contacted ? (
                        <span className="badge badge-purple text-[10px]">Previously Contacted</span>
                      ) : (
                        <span className="badge badge-green text-[10px]">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Generate Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-border">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 font-semibold">Email Style:</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="input py-1.5 px-3 text-xs bg-surface-elevated border-surface-border text-white"
              >
                <option value="professional">Professional (100–140 words)</option>
                <option value="formal">Formal</option>
                <option value="conversational">Conversational</option>
              </select>
            </div>

            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="btn-primary flex items-center gap-2 text-xs py-2.5 px-5 shadow-lg shadow-brand-500/20"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Personalizing Emails for All Companies...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Customized Emails for All Valid Rows →</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Generated Drafts Review & Inline Edit */}
      {drafts.length > 0 && (
        <div className="card p-6 border border-surface-border bg-surface/90 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-400" />
                <span>Step 4: Review, Edit & Approve Emails ({drafts.length})</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Every company receives a unique email tailored with your resume's actual skills and achievements.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleApproveAll}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-brand-600 shadow-md shadow-emerald-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve All Drafts</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {drafts.map((d) => (
              <div
                key={d.draft_id}
                className={`p-4 rounded-xl border transition-all ${
                  d.status === 'approved'
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : d.status === 'sent'
                    ? 'border-brand-500/30 bg-brand-950/10'
                    : 'border-surface-border bg-surface/60'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{d.company_name}</span>
                      <span className="text-xs font-mono text-gray-400">({d.recipient_email})</span>
                      <span
                        className={`badge text-[10px] ${
                          d.status === 'approved'
                            ? 'badge-green'
                            : d.status === 'sent'
                            ? 'badge-blue'
                            : 'badge-yellow'
                        }`}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    {d.target_role && (
                      <p className="text-xs text-brand-300 mt-0.5">Target Role: {d.target_role}</p>
                    )}
                  </div>

                  {d.status === 'draft' && (
                    <button
                      onClick={() => handleApproveDraft(d.draft_id)}
                      className="btn-secondary text-[11px] py-1 px-3 flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={d.subject}
                    onChange={(e) => handleUpdateDraft(d.draft_id, 'subject', e.target.value)}
                    className="input text-xs w-full bg-surface-elevated text-white border-surface-border"
                    placeholder="Subject line"
                  />
                  <textarea
                    rows={4}
                    value={d.body}
                    onChange={(e) => handleUpdateDraft(d.draft_id, 'body', e.target.value)}
                    className="input text-xs w-full bg-surface-elevated text-gray-200 border-surface-border leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span>
                      Word count: <strong className="text-gray-300">{d.word_count}</strong> words{' '}
                      {d.word_count >= 100 && d.word_count <= 150 ? '✅ (Ideal: 100-150)' : ''}
                    </span>
                    <span>Confidence Score: {d.confidence_score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Throttled Sending & Rate Limit Safeguards */}
      {drafts.length > 0 && (
        <div className="card p-6 border border-surface-border bg-surface/90 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Step 5: Controlled Sending & Quota Safeguards</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Emails are sent with safe delays between messages to prevent hitting provider limits or quotas.
              </p>
            </div>

            <div className="text-xs text-right text-gray-400">
              Approved to Send:{' '}
              <strong className="text-emerald-400 font-bold text-sm">
                {drafts.filter((d) => d.status === 'approved').length}
              </strong>{' '}
              / {drafts.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-elevated/40 border border-surface-border">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Delay Between Emails ({delaySeconds} seconds)
              </label>
              <input
                type="range"
                min="5"
                max="60"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                className="w-full accent-brand-500"
              />
              <span className="text-[11px] text-gray-500">Recommended: 10–15 seconds to avoid provider flagging</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Maximum Daily Send Limit ({dailyLimit} emails)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                className="w-full accent-brand-500"
              />
              <span className="text-[11px] text-gray-500">Conservative daily threshold below Gmail's maximum quota</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400">
              Only approved drafts will be dispatched. Default is preview-only until you click Start Sending.
            </span>

            <button
              onClick={handleStartDispatch}
              disabled={sending || drafts.filter((d) => d.status === 'approved').length === 0}
              className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-brand-600 shadow-lg shadow-emerald-500/20"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching with Safe Delays...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Start Sending Approved Emails →</span>
                </>
              )}
            </button>
          </div>

          {/* Delivery logs */}
          {deliveryLogs.length > 0 && (
            <div className="pt-4 border-t border-surface-border">
              <h4 className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wider">
                Live Delivery Logs
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
                {deliveryLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-surface border border-surface-border flex items-center justify-between"
                  >
                    <span className="text-gray-300">{log.email}</span>
                    <span
                      className={`badge text-[10px] ${
                        log.status === 'sent' ? 'badge-green' : 'badge-red'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
