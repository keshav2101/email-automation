'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { jobApi, companyApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Sparkles,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  Filter,
  X,
  FileText,
} from 'lucide-react';

interface Company {
  id: number;
  name: string;
  industry?: string;
  location?: string;
}

interface JobOpportunity {
  id: number;
  company_id: number;
  title: string;
  description?: string;
  requirements?: string[];
  skills_required?: string[];
  location?: string;
  employment_type?: string;
  is_confirmed?: boolean;
  source_url?: string;
  application_type?: string;
  created_at?: string;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    company_id: '',
    title: '',
    description: '',
    requirements: '',
    skills_required: '',
    location: '',
    employment_type: 'full-time',
    is_confirmed: true,
    source_url: '',
    application_type: 'confirmed_posting',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, companiesData] = await Promise.all([
        jobApi.list(),
        companyApi.list({ limit: 100 }),
      ]);
      setJobs(jobsData || []);
      setCompanies(companiesData || []);
    } catch (err: any) {
      toast.error('Failed to load job opportunities: ' + (err?.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_id || !formData.title.trim()) {
      toast.error('Please select a company and provide a job title');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: parseInt(formData.company_id),
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        requirements: formData.requirements
          ? formData.requirements.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        skills_required: formData.skills_required
          ? formData.skills_required.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        location: formData.location.trim() || undefined,
        employment_type: formData.employment_type,
        is_confirmed: formData.application_type === 'confirmed_posting',
        source_url: formData.source_url.trim() || undefined,
        application_type: formData.application_type,
      };

      await jobApi.create(payload);
      toast.success('Job opportunity created successfully!');
      setShowAddModal(false);
      setFormData({
        company_id: '',
        title: '',
        description: '',
        requirements: '',
        skills_required: '',
        location: '',
        employment_type: 'full-time',
        is_confirmed: true,
        source_url: '',
        application_type: 'confirmed_posting',
      });
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create job opportunity');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this job opportunity?')) return;
    try {
      await jobApi.delete(id);
      toast.success('Job deleted');
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete job: ' + (err?.message || 'Error'));
    }
  };

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      (companyMap.get(job.company_id) || '').toLowerCase().includes(search.toLowerCase()) ||
      (job.location || '').toLowerCase().includes(search.toLowerCase());

    const matchesCompany =
      selectedCompanyFilter === 'all' || job.company_id.toString() === selectedCompanyFilter;

    const matchesType =
      selectedTypeFilter === 'all' || job.application_type === selectedTypeFilter;

    return matchesSearch && matchesCompany && matchesType;
  });

  const confirmedCount = jobs.filter((j) => j.application_type === 'confirmed_posting').length;
  const speculativeCount = jobs.filter((j) => j.application_type === 'speculative').length;
  const referralCount = jobs.filter((j) => j.application_type === 'referral_request').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-lg shadow-brand-500/20">
              <Briefcase className="w-6 h-6 text-white" />
            </span>
            Job Opportunities
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Track confirmed postings, speculative targets, and roles for AI-personalized outreach.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 self-start md:self-auto px-4 py-2.5 shadow-lg shadow-brand-500/20 hover:scale-[1.02] transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>Add Job Opportunity</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 border border-surface-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Tracked</span>
            <Briefcase className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{jobs.length}</p>
          <p className="text-xs text-gray-500 mt-1">Active targets</p>
        </div>
        <div className="card p-5 border border-surface-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Confirmed Openings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{confirmedCount}</p>
          <p className="text-xs text-emerald-400/80 mt-1">Verified career listings</p>
        </div>
        <div className="card p-5 border border-surface-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Speculative</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{speculativeCount}</p>
          <p className="text-xs text-amber-400/80 mt-1">Proactive inquiry</p>
        </div>
        <div className="card p-5 border border-surface-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Referral Inquiries</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{referralCount}</p>
          <p className="text-xs text-purple-400/80 mt-1">Network & HR referrals</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-surface-border bg-surface/50">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role, company, or location..."
            className="input pl-9 w-full bg-surface-elevated/70 border-surface-border text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="input py-1.5 px-3 bg-surface-elevated text-xs border-surface-border"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="input py-1.5 px-3 bg-surface-elevated text-xs border-surface-border"
          >
            <option value="all">All Outreach Types</option>
            <option value="confirmed_posting">Confirmed Postings</option>
            <option value="speculative">Speculative Roles</option>
            <option value="referral_request">Referral Inquiries</option>
          </select>
        </div>
      </div>

      {/* Job Cards List */}
      {loading ? (
        <div className="card text-center py-20 border border-surface-border">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mb-4"></div>
          <p className="text-gray-400 text-sm">Loading job opportunities...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card text-center py-20 border border-surface-border bg-surface/40">
          <Briefcase className="w-14 h-14 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No job opportunities found</h3>
          <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
            {jobs.length === 0
              ? 'Add target roles you want to apply for. The AI Email Studio will use these to craft tailored outreach emails.'
              : 'No opportunities match your search filters.'}
          </p>
          {jobs.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary mt-5 inline-flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Your First Target Role
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map((job) => {
            const companyName = companyMap.get(job.company_id) || 'Unknown Company';
            const typeBadgeStyle =
              job.application_type === 'confirmed_posting'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : job.application_type === 'referral_request'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

            const typeLabel =
              job.application_type === 'confirmed_posting'
                ? 'Confirmed Opening'
                : job.application_type === 'referral_request'
                ? 'Referral Request'
                : 'Speculative Inquiry';

            return (
              <div
                key={job.id}
                className="card border border-surface-border hover:border-brand-500/40 transition-all p-5 flex flex-col justify-between bg-surface/80 backdrop-blur-sm group hover:shadow-xl hover:shadow-brand-900/10"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border mb-2 ${typeBadgeStyle}`}>
                        {typeLabel}
                      </span>
                      <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-medium text-gray-300">{companyName}</span>
                        {job.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3.5 h-3.5 text-gray-500" />
                            <span>{job.location}</span>
                          </>
                        )}
                        {job.employment_type && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{job.employment_type}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete opportunity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {job.description && (
                    <p className="text-gray-400 text-xs line-clamp-3 mt-3 leading-relaxed bg-surface-elevated/40 p-3 rounded-lg border border-surface-border/50">
                      {job.description}
                    </p>
                  )}

                  {/* Skills tags */}
                  {job.skills_required && job.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.skills_required.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-brand-950/60 text-brand-300 border border-brand-800/40"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-surface-border/70 flex items-center justify-between">
                  {job.source_url ? (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5 transition-colors"
                    >
                      <span>Posting Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-500">Internal Target</span>
                  )}

                  <button
                    onClick={() => {
                      router.push(
                        `/dashboard/studio?company_id=${job.company_id}&role=${encodeURIComponent(
                          job.title
                        )}`
                      );
                    }}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-md shadow-brand-500/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Email</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto border border-surface-border bg-surface-elevated shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Add Job Opportunity</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Target Company <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="input w-full bg-surface border-surface-border text-sm"
                >
                  <option value="">Select a company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {companies.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No companies available yet. Add companies from the Companies page first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Role Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Machine Learning Engineer, AI Research Intern"
                  className="input w-full bg-surface border-surface-border text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Application Type
                  </label>
                  <select
                    value={formData.application_type}
                    onChange={(e) => setFormData({ ...formData, application_type: e.target.value })}
                    className="input w-full bg-surface border-surface-border text-xs"
                  >
                    <option value="confirmed_posting">Confirmed Job Ad</option>
                    <option value="speculative">Speculative Inquiry</option>
                    <option value="referral_request">Referral Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="input w-full bg-surface border-surface-border text-xs"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="internship">Internship</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Remote, San Francisco, CA"
                    className="input w-full bg-surface border-surface-border text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Source URL
                  </label>
                  <input
                    type="url"
                    value={formData.source_url}
                    onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                    placeholder="https://company.com/careers/job-123"
                    className="input w-full bg-surface border-surface-border text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.skills_required}
                  onChange={(e) => setFormData({ ...formData, skills_required: e.target.value })}
                  placeholder="e.g. PyTorch, LLMs, Distributed Training, FastAPI"
                  className="input w-full bg-surface border-surface-border text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Job Description / Role Requirements
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Paste the key responsibilities or qualifications here. The AI Email Studio will analyze this to highlight relevant experience."
                  className="input w-full bg-surface border-surface-border text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : 'Save Job Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
