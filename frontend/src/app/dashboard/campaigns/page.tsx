'use client';
import { useState, useEffect, useRef } from 'react';
import { draftApi, gmailApi, emailPluginApi, bulkAutomationApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  Mail, CheckCircle, Send, Eye, Trash2, Clock,
  ThumbsUp, AlertTriangle, Filter, Zap, Play, Square,
  RefreshCw, Check, CheckSquare, Square as UncheckedSquare,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray',
  approved: 'badge-blue',
  sent: 'badge-green',
  failed: 'badge-red',
  suppressed: 'badge-yellow',
  scheduled: 'badge-purple',
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuthStore();

  // Multi-selection for bulk automation
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk automation state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [randomJitter, setRandomJitter] = useState(3);
  const [dryRun, setDryRun] = useState(false);

  // Active bulk job execution
  const [activeJob, setActiveJob] = useState<any>(null);
  const [jobPolling, setJobPolling] = useState(false);
  const pollTimerRef = useRef<any>(null);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const data = await draftApi.list({ status: statusFilter || undefined });
      setDrafts(data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDrafts(); }, [statusFilter]);

  // Clean up poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await draftApi.approve(id);
      toast.success('Draft approved!');
      fetchDrafts();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed'); }
  };

  const handlePushToGmail = async (id: number) => {
    try {
      await gmailApi.pushDraft(id);
      toast.success('Pushed to Gmail Drafts!');
      fetchDrafts();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Gmail push failed'); }
  };

  const handleSend = async (id: number) => {
    if (!confirm('Send this email now? This cannot be undone.')) return;
    try {
      await gmailApi.send(id);
      toast.success('Email sent!');
      fetchDrafts();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Send failed'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this draft?')) return;
    try {
      await draftApi.delete(id);
      toast.success('Deleted');
      setSelectedDraft(null);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      fetchDrafts();
    } catch { toast.error('Delete failed'); }
  };

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllApproved = () => {
    const approvedIds = drafts.filter((d) => d.status === 'approved').map((d) => d.id);
    setSelectedIds(approvedIds);
  };

  const clearSelection = () => setSelectedIds([]);

  // Launch Bulk Automation
  const handleStartBulkAutomation = async () => {
    const targetIds = selectedIds.length > 0
      ? selectedIds
      : drafts.filter((d) => d.status === 'approved').map((d) => d.id);

    if (targetIds.length === 0) {
      toast.error('No drafts selected for bulk sending.');
      return;
    }

    try {
      const res = await bulkAutomationApi.start({
        draft_ids: targetIds,
        delay_seconds: delaySeconds,
        random_jitter: randomJitter,
        daily_limit: dailyLimit,
        dry_run: dryRun,
      });

      setActiveJob(res);
      setJobPolling(true);
      toast.success('Bulk automation started in background!');

      // Poll job progress every 1.5 seconds
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await bulkAutomationApi.getJobStatus(res.job_id);
          setActiveJob(status);
          if (status.status === 'completed' || status.status === 'cancelled' || status.status === 'failed') {
            clearInterval(pollTimerRef.current);
            setJobPolling(false);
            fetchDrafts();
            if (status.status === 'completed') {
              toast.success(`Bulk automation complete: ${status.sent_count} sent!`);
            }
          }
        } catch {
          clearInterval(pollTimerRef.current);
          setJobPolling(false);
        }
      }, 1500);

    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start bulk automation');
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob?.job_id) return;
    try {
      await bulkAutomationApi.cancelJob(activeJob.job_id);
      toast.success('Cancellation signal sent.');
    } catch {
      toast.error('Failed to cancel job');
    }
  };

  const approvedCount = drafts.filter((d) => d.status === 'approved').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Email Campaigns & Bulk Automation
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Review, approve, and automate rate-limited bulk email sending directly to recruiters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={approvedCount === 0 && selectedIds.length === 0}
            className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-brand-600 shadow-lg shadow-emerald-500/20"
          >
            <Zap className="w-4 h-4" />
            <span>Automated Bulk Send ({selectedIds.length > 0 ? selectedIds.length : approvedCount})</span>
          </button>
        </div>
      </div>

      {/* Filter & Batch Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'approved', 'sent'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-lg font-medium transition-all capitalize',
                statusFilter === s ? 'bg-brand-500 text-white' : 'bg-surface-card text-gray-400 border border-surface-border hover:text-gray-200'
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={selectAllApproved}
            className="text-brand-400 hover:text-brand-300 font-medium px-2 py-1"
          >
            Select All Approved ({approvedCount})
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-gray-400 hover:text-gray-200 px-2 py-1"
            >
              Clear ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Draft List */}
        <div className="col-span-5 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : drafts.length === 0 ? (
            <div className="card text-center py-12">
              <Mail className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400">No drafts yet</p>
              <p className="text-xs text-gray-600 mt-1">Use Excel Automation or AI Studio to generate personalized emails</p>
            </div>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                className={clsx(
                  'card-sm cursor-pointer hover:border-brand-500/40 transition-all flex items-start gap-3',
                  selectedDraft?.id === d.id && 'border-brand-500/60 bg-brand-500/5',
                  selectedIds.includes(d.id) && 'ring-1 ring-emerald-500/50'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(d.id);
                  }}
                  className="mt-1 text-gray-400 hover:text-white"
                >
                  {selectedIds.includes(d.id) ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <UncheckedSquare className="w-4 h-4" />
                  )}
                </button>

                <div
                  className="min-w-0 flex-1"
                  onClick={async () => {
                    const full = await draftApi.get(d.id);
                    setSelectedDraft(full);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{d.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {d.recipient_name ? `To: ${d.recipient_name}` : 'No contact'} · {d.target_role}
                      </p>
                    </div>
                    <span className={clsx('badge flex-shrink-0', STATUS_BADGE[d.status] || 'badge-gray')}>{d.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">{format(new Date(d.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Draft Detail */}
        <div className="col-span-7">
          {!selectedDraft ? (
            <div className="card h-full flex items-center justify-center py-20 text-center">
              <div>
                <Eye className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400">Select a draft to preview</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-slide-up">
              <div className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={clsx('badge mb-2', STATUS_BADGE[selectedDraft.status] || 'badge-gray')}>{selectedDraft.status}</span>
                    <p className="text-xs text-gray-500">
                      To: {selectedDraft.recipient_name || 'Hiring Team'} {selectedDraft.recipient_email ? `<${selectedDraft.recipient_email}>` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Role: {selectedDraft.target_role}</p>
                  </div>
                  <button onClick={() => handleDelete(selectedDraft.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-surface border border-surface-border mb-3">
                  <p className="text-xs text-gray-500 mb-1">Subject</p>
                  <p className="text-sm font-medium text-white">{selectedDraft.subject}</p>
                </div>

                {selectedDraft.personalization_notes && (
                  <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 mb-3">
                    <p className="text-xs text-brand-300 font-medium mb-0.5">Why this email is personalized</p>
                    <p className="text-xs text-gray-400">{selectedDraft.personalization_notes}</p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-surface border border-surface-border">
                  <p className="text-xs text-gray-500 mb-2">Email Body</p>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{selectedDraft.body}</pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {selectedDraft.status === 'draft' && (
                  <button onClick={() => handleApprove(selectedDraft.id)} className="btn-success" id="approve-draft-btn">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                )}
                {selectedDraft.status === 'approved' && (
                  <>
                    <button onClick={() => handlePushToGmail(selectedDraft.id)} className="btn-secondary" id="push-gmail-btn">
                      <Mail className="w-4 h-4" /> Push to Gmail Draft
                    </button>
                    <button onClick={() => handleSend(selectedDraft.id)} className="btn-primary" id="send-email-btn">
                      <Send className="w-4 h-4" /> Send Single Now
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BULK AUTOMATION MODAL / DRAWER */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-surface-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Automated Bulk Email Sending</h3>
                  <p className="text-xs text-gray-400">
                    Dispatches personalized emails sequentially with anti-spam delays and quota protection.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Config Controls */}
            {!jobPolling && (!activeJob || activeJob.status === 'completed' || activeJob.status === 'cancelled') ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-surface-border flex items-center justify-between">
                  <span className="text-gray-300">Selected Drafts to Dispatch:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {selectedIds.length > 0 ? selectedIds.length : approvedCount} emails
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-semibold mb-1">
                      Delay Between Emails ({delaySeconds}s + ±{randomJitter}s jitter)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                      className="w-full accent-brand-500"
                    />
                    <span className="text-[11px] text-gray-500">Natural spacing prevents spam folder placement</span>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-semibold mb-1">
                      Max Daily Limit ({dailyLimit} emails/day)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                      className="w-full accent-brand-500"
                    />
                    <span className="text-[11px] text-gray-500">Stops immediately if daily ceiling reached</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                    />
                    <span>Dry run simulation (simulate timings and logs without sending)</span>
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border">
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleStartBulkAutomation}
                    className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-brand-600 shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Automated Dispatch</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Live Progress & Logs Monitor */
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-semibold">
                      Status: <span className="uppercase text-brand-400 font-bold">{activeJob?.status || 'running'}</span>
                    </span>
                    <span className="font-mono text-gray-400">
                      {activeJob?.sent_count || 0} / {activeJob?.total || 0} sent ({activeJob?.progress_percent || 0}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-surface-border">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${activeJob?.progress_percent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Real-time Event Log */}
                <div className="border border-surface-border rounded-xl bg-surface p-3 font-mono text-[11px] max-h-56 overflow-y-auto space-y-1">
                  {(activeJob?.logs || []).map((l: string, i: number) => (
                    <div key={i} className="text-gray-300 leading-tight">
                      {l}
                    </div>
                  ))}
                  {(!activeJob?.logs || activeJob.logs.length === 0) && (
                    <div className="text-gray-500">Starting worker thread...</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                  <span className="text-xs text-gray-400">
                    Background job ID: <span className="font-mono text-gray-200">{activeJob?.job_id}</span>
                  </span>

                  {jobPolling && (
                    <button
                      onClick={handleCancelJob}
                      className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Automation</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
