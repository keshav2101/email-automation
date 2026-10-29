'use client';
import { useEffect, useState } from 'react';
import { contactApi, companyApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Plus, Trash2, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react';
import { clsx } from 'clsx';

function AddContactModal({ companies, onClose, onAdded }: any) {
  const [form, setForm] = useState({
    company_id: '', name: '', title: '', email: '',
    email_verified: false, email_source: '', linkedin_url: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await contactApi.create({ ...form, company_id: parseInt(form.company_id) });
      toast.success('HR Contact added!');
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-slide-up">
        <h3 className="font-semibold text-white mb-4">Add HR Contact</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Company *</label>
            <select className="input" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} required>
              <option value="">Select company...</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="HR Manager" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="hr@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="email-verified" checked={form.email_verified} onChange={(e) => setForm({ ...form, email_verified: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="email-verified" className="text-xs text-gray-400">Email is verified / publicly sourced</label>
          </div>
          <div>
            <label className="label">Email Source URL</label>
            <input className="input" placeholder="https://..." value={form.email_source} onChange={(e) => setForm({ ...form, email_source: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Add Contact</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, co] = await Promise.all([contactApi.list(), companyApi.list()]);
      setContacts(c);
      setCompanies(co);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await contactApi.delete(id);
      toast.success('Contact deleted');
      fetchAll();
    } catch { toast.error('Delete failed'); }
  };

  const filtered = contacts.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const getCompanyName = (id: number) => companies.find((c) => c.id === id)?.name || `Company #${id}`;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">HR Contacts</h1>
          <p className="text-gray-400 text-sm mt-1">{contacts.length} contacts in your database</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" id="add-contact-btn">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input pl-9" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">No contacts yet</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{c.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{c.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-300">{getCompanyName(c.company_id)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.email_verified ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span title="Unverified"><AlertCircle className="w-3.5 h-3.5 text-amber-400" /></span>
                      )}
                      <span className="text-xs text-gray-300">{c.email || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'badge',
                      c.reply_received ? 'badge-green' :
                      c.opted_out ? 'badge-red' :
                      c.outreach_status === 'not_contacted' ? 'badge-gray' : 'badge-blue'
                    )}>
                      {c.reply_received ? 'replied' : c.opted_out ? 'opted out' : c.outreach_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddContactModal companies={companies} onClose={() => setShowModal(false)} onAdded={fetchAll} />}
    </div>
  );
}
