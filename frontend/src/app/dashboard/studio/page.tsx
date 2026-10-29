'use client';
import { useState, useEffect } from 'react';
import {
  Sparkles, Building2, User, Briefcase, RefreshCw,
  CheckCircle, Send, Eye, Edit3, AlertTriangle, FileText,
  ChevronDown, ChevronUp, Copy, ThumbsUp, PenTool,
} from 'lucide-react';
import { companyApi, contactApi, draftApi, researchApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const styles = ['professional', 'formal', 'conversational'] as const;
const appTypes = [
  { value: 'full-time', label: 'Full-Time Job' },
  { value: 'internship', label: 'Internship' },
  { value: 'referral', label: 'Referral Request' },
  { value: 'speculative', label: 'Speculative (No Vacancy)' },
];

export default function StudioPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [research, setResearch] = useState<any>(null);

  const [form, setForm] = useState({
    target_role: '',
    job_description: '',
    style: 'professional' as typeof styles[number],
    application_type: 'speculative',
    attach_resume: true,
  });

  const [draft, setDraft] = useState<any>(null);
  const [editedBody, setEditedBody] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [activeVersion, setActiveVersion] = useState<'main' | 'formal' | 'concise' | 'conversational'>('main');

  const [stepResearching, setStepResearching] = useState(false);
  const [stepGenerating, setStepGenerating] = useState(false);
  const [stepApproving, setStepApproving] = useState(false);
  const [showJD, setShowJD] = useState(false);

  useEffect(() => {
    companyApi.list().then(setCompanies).catch(() => {});
  }, []);

  const handleSelectCompany = async (company: any) => {
    setSelectedCompany(company);
    setSelectedContact(null);
    setDraft(null);
    setResearch(null);

    contactApi.list({ company_id: company.id }).then(setContacts).catch(() => setContacts([]));

    // Try to load existing research
    try {
      const r = await researchApi.get(company.id);
      setResearch(r);
    } catch {}
  };

  const handleRunResearch = async () => {
    if (!selectedCompany) return;
    setStepResearching(true);
    try {
      const r = await researchApi.run(selectedCompany.id);
      setResearch(r);
      toast.success('AI research complete!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Research failed');
    } finally {
      setStepResearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCompany || !form.target_role) {
      toast.error('Select a company and enter a target role');
      return;
    }
    setStepGenerating(true);
    setDraft(null);
    try {
      const result = await draftApi.generate({
        company_id: selectedCompany.id,
        hr_contact_id: selectedContact?.id ?? null,
        target_role: form.target_role,
        job_description: form.job_description || null,
        style: form.style,
        attach_resume: form.attach_resume,
        application_type: form.application_type,
      });
      setDraft(result);
      setEditedBody(result.body || '');
      setEditedSubject(result.subject || '');
      setActiveVersion('main');
      toast.success('Personalized email generated!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally {
      setStepGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!draft?.draft_id) return;
    setStepApproving(true);
    try {
      // Save edits first
      await draftApi.update(draft.draft_id, {
        subject: editedSubject,
        body: editedBody,
      });
      await draftApi.approve(draft.draft_id);
      toast.success('Draft approved! Ready to send.');
      setDraft({ ...draft, status: 'approved' });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Approval failed');
    } finally {
      setStepApproving(false);
    }
  };

  const handleAppendSignature = async () => {
    try {
      const sig = await userApi.getSignature();
      const text = sig?.signature_text;
      if (text) {
        setEditedBody((prev) => `${prev.trim()}\n\n--\n${text}`);
        toast.success('Custom email signature attached!');
      } else {
        toast.error('No custom signature found. Configure in Settings!');
      }
    } catch {
      toast.error('Failed to load signature');
    }
  };

  const getVersionBody = () => {
    if (!draft) return '';
    if (activeVersion === 'formal') return draft.formal_version || draft.body;
    if (activeVersion === 'concise') return draft.concise_version || draft.body;
    if (activeVersion === 'conversational') return draft.conversational_version || draft.body;
    return editedBody;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/15">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">AI Email Studio</h1>
          <span className="badge badge-purple">Gemini Powered</span>
        </div>
        <p className="text-gray-400 text-sm">
          Generate a unique, company-specific email for every HR contact. Each email is tailored to the company's domain, the job requirements, and your verified profile.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel: Config */}
        <div className="col-span-5 space-y-4">
          {/* Step 1: Select Company */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">1</span>
              Target Company
            </h3>
            <select
              className="input"
              value={selectedCompany?.id || ''}
              onChange={(e) => {
                const c = companies.find((c) => c.id === parseInt(e.target.value));
                if (c) handleSelectCompany(c);
              }}
              id="studio-company-select"
            >
              <option value="">Select a company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.domain ? `— ${c.domain}` : ''}</option>
              ))}
            </select>

            {selectedCompany && (
              <div className="mt-3 p-3 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{selectedCompany.name}</p>
                    <p className="text-xs text-gray-500">{selectedCompany.industry} · {selectedCompany.location}</p>
                  </div>
                  <span className={clsx(
                    'badge text-[10px]',
                    selectedCompany.priority === 'high' ? 'badge-red' : selectedCompany.priority === 'medium' ? 'badge-yellow' : 'badge-gray'
                  )}>{selectedCompany.priority}</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: AI Research */}
          {selectedCompany && (
            <div className="card animate-fade-in">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                AI Company Research
              </h3>

              {research ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-400 font-medium mb-1">Research Complete</p>
                    <p className="text-xs text-gray-300">{research.business_summary?.slice(0, 150)}...</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(research.matching_skills || []).slice(0, 4).map((s: string) => (
                      <span key={s} className="badge badge-blue text-[10px]">{s}</span>
                    ))}
                  </div>
                  {research.match_confidence && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-brand transition-all"
                          style={{ width: `${Math.round(research.match_confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round(research.match_confidence * 100)}% match</span>
                    </div>
                  )}
                  <button onClick={handleRunResearch} disabled={stepResearching} className="btn-secondary text-xs py-1.5">
                    <RefreshCw className={clsx('w-3 h-3', stepResearching && 'animate-spin')} />
                    Re-run Research
                  </button>
                </div>
              ) : (
                <button onClick={handleRunResearch} disabled={stepResearching} className="btn-primary w-full justify-center">
                  {stepResearching ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Researching...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Run AI Research</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 3: HR Contact */}
          {selectedCompany && (
            <div className="card animate-fade-in">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                HR Contact <span className="text-gray-500 font-normal">(optional)</span>
              </h3>
              <select
                className="input"
                value={selectedContact?.id || ''}
                onChange={(e) => {
                  const c = contacts.find((c) => c.id === parseInt(e.target.value));
                  setSelectedContact(c || null);
                }}
                id="studio-contact-select"
              >
                <option value="">No specific contact (Hiring Team)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Unknown'} {c.title ? `— ${c.title}` : ''} {c.email_verified ? '✓' : '⚠'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 4: Role & Style */}
          {selectedCompany && (
            <div className="card animate-fade-in">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">4</span>
                Role & Email Style
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="label">Target Role *</label>
                  <input
                    className="input"
                    placeholder="e.g. AI/ML Engineer, SDE Intern, Data Analyst"
                    value={form.target_role}
                    onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                    id="studio-role-input"
                  />
                </div>

                <div>
                  <label className="label">Application Type</label>
                  <select
                    className="input"
                    value={form.application_type}
                    onChange={(e) => setForm({ ...form, application_type: e.target.value })}
                  >
                    {appTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Email Style</label>
                  <div className="flex gap-2">
                    {styles.map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, style: s })}
                        className={clsx(
                          'flex-1 py-1.5 text-xs rounded-lg capitalize font-medium transition-all',
                          form.style === s
                            ? 'bg-brand-500 text-white'
                            : 'bg-surface text-gray-400 hover:text-gray-200 border border-surface-border'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setShowJD(!showJD)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
                  >
                    {showJD ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Add Job Description (optional)
                  </button>
                  {showJD && (
                    <textarea
                      className="input mt-2 h-24 resize-none"
                      placeholder="Paste the job description here for more precise personalization..."
                      value={form.job_description}
                      onChange={(e) => setForm({ ...form, job_description: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {selectedCompany && (
            <button
              onClick={handleGenerate}
              disabled={stepGenerating || !form.target_role}
              className="btn-primary w-full justify-center py-3 text-base animate-fade-in"
              id="studio-generate-btn"
            >
              {stepGenerating ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Personalized Email</>
              )}
            </button>
          )}
        </div>

        {/* Right Panel: Draft Preview */}
        <div className="col-span-7">
          {!draft && !stepGenerating && (
            <div className="card h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Email Studio</h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Select a company, run AI research, then click Generate to create a personalized email tailored to that specific company and role.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-gray-600">
                {['Reads your resume', 'Analyzes company domain', 'Matches your strongest skills', 'Highlights relevant projects', 'Generates unique subject', 'Produces 3 style variants'].map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stepGenerating && (
            <div className="card h-full flex flex-col items-center justify-center">
              <span className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
              <p className="text-white font-medium">Generating personalized email...</p>
              <p className="text-gray-500 text-sm mt-1">Analyzing company profile and matching your skills</p>
            </div>
          )}

          {draft && !stepGenerating && (
            <div className="space-y-4 animate-slide-up">
              {/* Personalization Notes */}
              {draft.personalization_notes && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-brand-300 mb-0.5">Personalization Rationale</p>
                    <p className="text-xs text-gray-400">{draft.personalization_notes}</p>
                  </div>
                </div>
              )}

              {/* Confidence + Highlighted Project */}
              <div className="flex items-center gap-3">
                <div className="badge badge-green">
                  <CheckCircle className="w-3 h-3" />
                  {draft.confidence_score}% confidence
                </div>
                {draft.highlighted_project && (
                  <div className="badge badge-purple">
                    <FileText className="w-3 h-3" />
                    Featuring: {draft.highlighted_project}
                  </div>
                )}
                {draft.status === 'approved' && (
                  <div className="badge badge-green">
                    <ThumbsUp className="w-3 h-3" /> Approved
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="card">
                <label className="label">Subject Line</label>
                <input
                  className="input"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  id="studio-subject-input"
                />
              </div>

              {/* Version Tabs */}
              <div className="card">
                <div className="flex gap-2 mb-3">
                  {(['main', 'formal', 'concise', 'conversational'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        setActiveVersion(v);
                        if (v === 'main') setEditedBody(draft.body);
                        else if (v === 'formal') setEditedBody(draft.formal_version || draft.body);
                        else if (v === 'concise') setEditedBody(draft.concise_version || draft.body);
                        else setEditedBody(draft.conversational_version || draft.body);
                      }}
                      className={clsx(
                        'px-3 py-1.5 text-xs rounded-lg capitalize font-medium transition-all',
                        activeVersion === v
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface text-gray-400 hover:text-gray-200 border border-surface-border'
                      )}
                    >
                      {v === 'main' ? form.style : v}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAppendSignature}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-brand-300 hover:text-white border-brand-500/30"
                      title="Attach your customized signature from settings"
                    >
                      <PenTool className="w-3 h-3 text-brand-400" />
                      <span>+ Signature</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(editedBody); toast.success('Copied!'); }}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                </div>

                <label className="label">Email Body</label>
                <textarea
                  className="input h-64 resize-none font-mono text-xs leading-relaxed"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  id="studio-body-textarea"
                />
                <p className="text-xs text-gray-600 mt-1.5">{editedBody.split(' ').length} words</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {draft.status !== 'approved' ? (
                  <button
                    onClick={handleApprove}
                    disabled={stepApproving}
                    className="btn-primary flex-1 justify-center"
                    id="studio-approve-btn"
                  >
                    {stepApproving ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Approve & Save</>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">Approved — go to Drafts to send</span>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={stepGenerating}
                  className="btn-secondary"
                  id="studio-regenerate-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>

              {draft.status !== 'approved' && (
                <div className="flex items-start gap-2 text-xs text-amber-400/70">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Review the email carefully before approving. Go to Settings to connect Gmail and enable sending.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
