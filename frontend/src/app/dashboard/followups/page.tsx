'use client';
import { useEffect, useState } from 'react';
import { followupApi, draftApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Send, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    original_draft_id: '',
    sequence_number: 1,
    days_after: 7,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fu, dr] = await Promise.all([
        followupApi.list(),
        draftApi.list({ status: 'sent' }),
      ]);
      setFollowups(fu);
      setDrafts(dr);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await followupApi.schedule({
        ...scheduleForm,
        original_draft_id: parseInt(scheduleForm.original_draft_id),
      });
      toast.success('Follow-up scheduled!');
      setShowSchedule(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Schedule failed');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await followupApi.cancel(id);
      toast.success('Follow-up cancelled');
      fetchData();
    } catch { toast.error('Cancel failed'); }
  };

  const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-yellow',
    sent: 'badge-green',
    cancelled: 'badge-red',
    skipped: 'badge-gray',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-Ups</h1>
          <p className="text-gray-400 text-sm mt-1">
            AI-generated follow-up emails. Automatically cancelled when a reply is detected.
          </p>
        </div>
        <button onClick={() => setShowSchedule(!showSchedule)} className="btn-primary">
          <Plus className="w-4 h-4" /> Schedule Follow-Up
        </button>
      </div>

      {/* Schedule Form */}
      {showSchedule && (
        <div className="card mb-6 animate-slide-up">
          <h3 className="font-semibold text-white mb-3">Schedule a Follow-Up</h3>
          <form onSubmit={handleSchedule} className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Original Sent Email</label>
              <select className="input" value={scheduleForm.original_draft_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, original_draft_id: e.target.value })} required>
                <option value="">Select email...</option>
                {drafts.map((d) => <option key={d.id} value={d.id}>{d.subject?.slice(0, 40)}...</option>)}
              </select>
            </div>
            <div>
              <label className="label">Follow-Up Number</label>
              <select className="input" value={scheduleForm.sequence_number}
                onChange={(e) => setScheduleForm({ ...scheduleForm, sequence_number: parseInt(e.target.value) })}>
                <option value={1}>First Follow-Up</option>
                <option value={2}>Final Follow-Up</option>
              </select>
            </div>
            <div>
              <label className="label">Days After</label>
              <input className="input" type="number" min={1} max={30} value={scheduleForm.days_after}
                onChange={(e) => setScheduleForm({ ...scheduleForm, days_after: parseInt(e.target.value) })} />
            </div>
            <div className="col-span-3 flex gap-2">
              <button type="submit" className="btn-primary">
                <Clock className="w-4 h-4" /> Schedule
              </button>
              <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : followups.length === 0 ? (
        <div className="card text-center py-16">
          <Clock className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No follow-ups scheduled</p>
          <p className="text-xs text-gray-600 mt-1">Schedule follow-ups for sent emails to stay top of mind</p>
        </div>
      ) : (
        <div className="space-y-3">
          {followups.map((fu) => (
            <div key={fu.id} className="card flex items-start gap-4">
              <div className={clsx(
                'p-2 rounded-lg flex-shrink-0',
                fu.status === 'pending' ? 'bg-amber-500/15' : fu.status === 'sent' ? 'bg-emerald-500/15' : 'bg-gray-500/15'
              )}>
                <Clock className={clsx(
                  'w-4 h-4',
                  fu.status === 'pending' ? 'text-amber-400' : fu.status === 'sent' ? 'text-emerald-400' : 'text-gray-500'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('badge', STATUS_BADGE[fu.status] || 'badge-gray')}>{fu.status}</span>
                  <span className="text-xs text-gray-500">Follow-up #{fu.sequence_number}</span>
                </div>
                <p className="text-sm font-medium text-white">{fu.subject}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scheduled: {format(new Date(fu.scheduled_for), 'MMM d, yyyy HH:mm')}
                </p>
                {fu.cancel_reason && (
                  <p className="text-xs text-gray-600 mt-0.5">Reason: {fu.cancel_reason}</p>
                )}
                {fu.body && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{fu.body}</p>
                )}
              </div>
              {fu.status === 'pending' && (
                <button onClick={() => handleCancel(fu.id)} className="btn-danger text-xs py-1.5 flex-shrink-0">
                  <XCircle className="w-3 h-3" /> Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 card bg-surface-card/50">
        <h3 className="text-sm font-semibold text-white mb-2">Follow-Up Rules</h3>
        <ul className="space-y-1 text-xs text-gray-400">
          <li>• Suggested sequence: Initial → +5-7 days (1st follow-up) → +7-10 days (final)</li>
          <li>• Follow-ups are automatically cancelled when a reply is detected via Gmail sync</li>
          <li>• Follow-ups are suppressed if the contact has opted out</li>
          <li>• No follow-up is ever sent if the conversation is marked closed</li>
        </ul>
      </div>
    </div>
  );
}
