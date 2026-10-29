'use client';
import { useState, useEffect, useCallback } from 'react';
import { companyApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, ExternalLink, Trash2,
  Globe, MapPin, Tag, RefreshCw, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUSES = ['not_started', 'researching', 'ready', 'emailed', 'replied', 'closed'];
const STATUS_COLORS: Record<string, string> = {
  not_started: 'badge-gray',
  researching: 'badge-yellow',
  ready: 'badge-blue',
  emailed: 'badge-purple',
  replied: 'badge-green',
  closed: 'badge-red',
};

function AddCompanyModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', website: '', industry: '', domain: '',
    location: '', size: 'startup', priority: 'medium', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await companyApi.create(form);
      toast.success('Company added!');
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg animate-slide-up">
        <h3 className="font-semibold text-white mb-4">Add Company</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Company Name *</label>
              <input className="input" placeholder="e.g. Google DeepMind" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required id="add-company-name" />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" placeholder="https://..." value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <label className="label">Industry</label>
              <input className="input" placeholder="AI, SaaS, FinTech..." value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div>
              <label className="label">Domain / Focus</label>
              <input className="input" placeholder="Machine Learning, Analytics..." value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="Bangalore, Remote..." value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Company Size</label>
              <select className="input" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                <option value="startup">Startup (1-50)</option>
                <option value="mid">Mid-size (50-500)</option>
                <option value="enterprise">Enterprise (500+)</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input h-16 resize-none" placeholder="Any notes about this company..."
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Add Company</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await companyApi.list({ search: search || undefined });
      setCompanies(data);
    } catch {}
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this company?')) return;
    try {
      await companyApi.delete(id);
      toast.success('Company deleted');
      fetchCompanies();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-gray-400 text-sm mt-1">{companies.length} companies in your outreach list</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" id="add-company-btn">
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          className="input pl-9"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="company-search"
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No companies yet</p>
            <p className="text-gray-600 text-sm mt-1">Add your first target company to get started</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Add Company
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Domain</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{c.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.location && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3 h-3" />{c.location}</span>}
                        {c.website && (
                          <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                            <Globe className="w-3 h-3" /> Website
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-300">{c.industry}</p>
                      {c.domain && <p className="text-xs text-gray-500">{c.domain}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge', STATUS_COLORS[c.outreach_status] || 'badge-gray')}>
                      {c.outreach_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'badge',
                      c.priority === 'high' ? 'badge-red' : c.priority === 'medium' ? 'badge-yellow' : 'badge-gray'
                    )}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddCompanyModal onClose={() => setShowModal(false)} onAdded={fetchCompanies} />}
    </div>
  );
}
