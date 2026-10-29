'use client';
import { useState, useEffect, useCallback } from 'react';
import { candidateApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Upload, User, CheckCircle, AlertCircle, Loader2, X, RefreshCw, BookOpen, Award, Briefcase, Code, GraduationCap, ExternalLink } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { clsx } from 'clsx';

const SKILL_FIELDS = [
  { key: 'programming_languages', label: 'Programming Languages' },
  { key: 'frameworks', label: 'Frameworks & Libraries' },
  { key: 'technical_skills', label: 'Technical & Domain Skills' },
  { key: 'tools', label: 'Developer Tools & Platforms' },
];

function TagList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-500 italic mt-1">None listed</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {items.map((item, i) => (
        <span key={i} className="badge badge-blue group cursor-default text-xs py-1 px-2.5">
          {item}
          <button onClick={() => onRemove(i)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [resumes, setResumes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'experience' | 'projects' | 'publications' | 'achievements'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([candidateApi.getProfile(), candidateApi.listResumes()]);
      setProfile(p);
      setResumes(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await candidateApi.uploadResume(file, 'My Resume');
      toast.success(`Resume uploaded and parsed successfully!`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReparse = async (resumeId?: number) => {
    setReparsing(true);
    try {
      await candidateApi.reparseResume(resumeId);
      toast.success('Resume re-analyzed & profile updated!');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Re-parse failed');
    } finally {
      setReparsing(false);
    }
  };

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (file) handleUploadFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const err = fileRejections[0]?.errors[0]?.message || 'Please upload a PDF, Word (.docx, .doc), or Text document';
      toast.error(`File not accepted: ${err}`);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'application/rtf': ['.rtf'],
      'text/rtf': ['.rtf'],
      'application/octet-stream': ['.pdf', '.docx', '.doc', '.txt', '.rtf'],
    },
    maxFiles: 1,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await candidateApi.updateProfile(profile);
      toast.success('Profile saved!');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeTag = (field: string, index: number) => {
    setProfile({ ...profile, [field]: (profile[field] || []).filter((_: any, i: number) => i !== index) });
  };

  const addTag = (field: string, value: string) => {
    if (!value.trim()) return;
    setProfile({ ...profile, [field]: [...(profile[field] || []), value.trim()] });
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="text-sm text-gray-400">Loading your profile data...</p>
      </div>
    );
  }

  const publicationsCount = (profile?.publications || []).length;
  const awardsCount = (profile?.awards || []).length;
  const certsCount = (profile?.certifications || []).length;
  const projectsCount = (profile?.projects || []).length;
  const workExpCount = (profile?.work_experience || []).length + (profile?.internships || []).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-brand-400" />
            My Candidate Profile & Resume
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Data extracted from your resume is used directly to craft personalized cold emails
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resumes.length > 0 && (
            <button
              onClick={() => handleReparse()}
              disabled={reparsing}
              className="btn-secondary flex items-center gap-2 text-sm border-brand-500/30 hover:border-brand-500/60"
              title="Re-extract and sync all sections from your latest uploaded resume"
            >
              <RefreshCw className={clsx("w-4 h-4 text-brand-400", reparsing && "animate-spin")} />
              {reparsing ? 'Re-parsing...' : 'Re-Sync from Resume'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Save Profile
          </button>
        </div>
      </div>

      {/* Resume Upload Box */}
      <div className="card mb-6 border border-surface-border/80">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
          <Upload className="w-4 h-4 text-brand-400" /> Upload & Parse Resume
        </h2>
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
            isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border hover:border-brand-500/50 hover:bg-surface-hover'
          )}
        >
          <input {...getInputProps()} id="resume-upload" />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <span className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-300 font-medium">Extracting structured sections from document...</p>
              <p className="text-xs text-gray-500">Reading Education, Experience, Projects, Research Papers & Skills</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-brand-400/80" />
              <p className="text-sm text-gray-200 font-medium">{isDragActive ? 'Drop document here' : 'Drag & drop your resume or document'}</p>
              <p className="text-xs text-gray-400">PDF, Word (.docx, .doc), or Text (.txt, .rtf) · Max 10MB</p>
              <label
                onClick={(e) => e.stopPropagation()}
                className="mt-2 btn-secondary text-xs py-1.5 px-4 cursor-pointer hover:bg-surface-elevated text-brand-300 border-brand-500/30"
              >
                <span>Browse Document from Device</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.rtf,.md"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFile(f);
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Uploaded Resumes List */}
        {resumes.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded Documents ({resumes.length})</p>
            {resumes.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-brand-500/10 text-brand-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{r.label} — {r.filename}</p>
                    <p className="text-xs text-gray-400">{r.file_type.toUpperCase()} · {r.file_size_kb} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('badge text-xs', r.extraction_status === 'done' ? 'badge-green' : r.extraction_status === 'failed' ? 'badge-red' : 'badge-yellow')}>
                    {r.extraction_status}
                  </span>
                  <button
                    onClick={() => handleReparse(r.id)}
                    disabled={reparsing}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 border-brand-500/30 hover:border-brand-500/60 text-brand-300"
                    title="Re-extract profile details from this document"
                  >
                    <RefreshCw className={clsx("w-3 h-3", reparsing && "animate-spin")} />
                    Re-extract
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Navigation Tabs */}
      {profile && (
        <>
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 border-b border-surface-border">
            {[
              { id: 'overview', label: 'Overview & Education', count: null },
              { id: 'skills', label: 'Skills', count: (profile.technical_skills || []).length + (profile.programming_languages || []).length },
              { id: 'experience', label: 'Experience & Internships', count: workExpCount },
              { id: 'projects', label: 'Projects', count: projectsCount },
              { id: 'publications', label: 'Research Publications', count: publicationsCount },
              { id: 'achievements', label: 'Certifications & Awards', count: awardsCount + certsCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'px-3.5 py-2 text-xs sm:text-sm rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5',
                  activeTab === tab.id ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-surface'
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={clsx('text-[11px] px-1.5 py-0.5 rounded-full', activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-elevated text-gray-300')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="card space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="e.g. Keshav Gupta" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="e.g. k.gupta2101@gmail.com" />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="e.g. +91-9411782595" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input className="input" value={profile.location || ''} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="e.g. Chennai / Dehradun, India" />
                </div>
                <div>
                  <label className="label">University / College</label>
                  <input className="input" value={profile.university || ''} onChange={(e) => setProfile({ ...profile, university: e.target.value })} placeholder="e.g. SRM Institute of Science and Technology" />
                </div>
                <div>
                  <label className="label">Degree</label>
                  <input className="input" value={profile.degree || ''} onChange={(e) => setProfile({ ...profile, degree: e.target.value })} placeholder="e.g. Bachelor of Technology (B.Tech)" />
                </div>
                <div>
                  <label className="label">Field of Study / Major</label>
                  <input className="input" value={profile.field_of_study || ''} onChange={(e) => setProfile({ ...profile, field_of_study: e.target.value })} placeholder="e.g. Computer Science and Engineering" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Graduation Year</label>
                    <input className="input" type="number" value={profile.graduation_year || ''} onChange={(e) => setProfile({ ...profile, graduation_year: parseInt(e.target.value) || null })} placeholder="2027" />
                  </div>
                  <div>
                    <label className="label">GPA / Grade</label>
                    <input className="input" value={profile.gpa || ''} onChange={(e) => setProfile({ ...profile, gpa: e.target.value })} placeholder="e.g. 8.86 / 10" />
                  </div>
                </div>
                <div>
                  <label className="label">LinkedIn URL</label>
                  <input className="input" value={profile.linkedin_url || ''} onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/keshav-gupta..." />
                </div>
                <div>
                  <label className="label">GitHub URL</label>
                  <input className="input" value={profile.github_url || ''} onChange={(e) => setProfile({ ...profile, github_url: e.target.value })} placeholder="https://github.com/keshav-2101..." />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Portfolio / Research Profile URL</label>
                  <input className="input" value={profile.portfolio_url || ''} onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })} placeholder="https://scopus.com/authid/detail.uri?authorId=... or personal site" />
                </div>
              </div>

              <div>
                <label className="label">Professional Summary</label>
                <textarea
                  className="input h-28 resize-none leading-relaxed"
                  value={profile.professional_summary || ''}
                  onChange={(e) => setProfile({ ...profile, professional_summary: e.target.value })}
                  placeholder="Summary used for cold emails and tailored outreach..."
                />
              </div>
            </div>
          )}

          {/* Tab 2: Skills */}
          {activeTab === 'skills' && (
            <div className="card space-y-5 animate-fade-in">
              <p className="text-xs text-gray-400">These skills are matched against company job requirements and research initiatives.</p>
              {SKILL_FIELDS.map(({ key, label }) => (
                <div key={key} className="p-4 rounded-lg bg-surface border border-surface-border">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-white">{label}</label>
                    <span className="text-xs text-gray-500">{(profile[key] || []).length} items</span>
                  </div>
                  <TagList items={profile[key] || []} onRemove={(i) => removeTag(key, i)} />
                  <div className="flex gap-2 mt-3">
                    <input
                      className="input text-xs py-1.5"
                      placeholder={`Type and press Enter to add to ${label.toLowerCase()}...`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag(key, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Experience & Internships */}
          {activeTab === 'experience' && (
            <div className="space-y-4 animate-fade-in">
              {/* Work Experience */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-brand-400" />
                    Work Experience & Research Roles ({(profile.work_experience || []).length})
                  </h3>
                </div>
                {(profile.work_experience || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No work experience entries extracted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(profile.work_experience || []).map((exp: any, i: number) => (
                      <div key={i} className="p-3.5 rounded-lg bg-surface border border-surface-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-white">{exp.role} <span className="text-brand-400 font-normal">@ {exp.company}</span></p>
                          <span className="text-xs text-gray-400 font-mono">{exp.duration}</span>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-gray-300 mt-2 leading-relaxed whitespace-pre-line">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Internships */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    Internships ({(profile.internships || []).length})
                  </h3>
                </div>
                {(profile.internships || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No internship entries extracted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(profile.internships || []).map((exp: any, i: number) => (
                      <div key={i} className="p-3.5 rounded-lg bg-surface border border-surface-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-white">{exp.role} <span className="text-purple-400 font-normal">@ {exp.company}</span></p>
                          <span className="text-xs text-gray-400 font-mono">{exp.duration}</span>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-gray-300 mt-2 leading-relaxed whitespace-pre-line">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Projects */}
          {activeTab === 'projects' && (
            <div className="card animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  Extracted Projects ({(profile.projects || []).length})
                </h3>
              </div>
              {(profile.projects || []).length === 0 ? (
                <p className="text-gray-500 text-sm italic">No projects found. Re-sync your resume to extract projects.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(profile.projects || []).map((p: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between hover:border-surface-hover transition-colors">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{p.name}</p>
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 mt-2 leading-relaxed">{p.description}</p>
                      </div>
                      {p.technologies?.length > 0 && (
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {p.technologies.map((t: string) => (
                            <span key={t} className="badge badge-purple text-[10px] py-0.5 px-2">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Publications */}
          {activeTab === 'publications' && (
            <div className="card animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  Peer-Reviewed Research Publications ({(profile.publications || []).length})
                </h3>
              </div>
              {(profile.publications || []).length === 0 ? (
                <p className="text-gray-500 text-sm italic">No research publications listed on this resume.</p>
              ) : (
                <div className="space-y-3">
                  {(profile.publications || []).map((pub: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-surface border border-surface-border hover:border-amber-500/30 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white">{pub.title}</p>
                        {pub.year && <span className="badge badge-yellow text-xs">{pub.year}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 italic">{pub.journal || pub.publisher || pub.venue || 'Peer-reviewed venue'}</p>
                      {pub.doi && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] font-mono text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                            DOI: {pub.doi}
                          </span>
                          <a
                            href={`https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                          >
                            <span>View Paper</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Certifications & Awards */}
          {activeTab === 'achievements' && (
            <div className="space-y-4 animate-fade-in">
              {/* Certifications */}
              <div className="card">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-cyan-400" />
                  Certifications ({(profile.certifications || []).length})
                </h3>
                {(profile.certifications || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No certifications listed.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {(profile.certifications || []).map((c: any, i: number) => {
                      const name = typeof c === 'string' ? c : (c.name || JSON.stringify(c));
                      const issuer = typeof c === 'object' ? c.issuer : null;
                      return (
                        <div key={i} className="p-3 rounded-lg bg-surface border border-surface-border">
                          <p className="text-sm font-medium text-white">{name}</p>
                          {issuer && <p className="text-xs text-gray-400 mt-0.5">{issuer}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Awards */}
              <div className="card">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-yellow-400" />
                  Awards, Honors & Hackathons ({(profile.awards || []).length})
                </h3>
                {(profile.awards || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No awards listed.</p>
                ) : (
                  <div className="space-y-2">
                    {(profile.awards || []).map((award: any, i: number) => {
                      const text = typeof award === 'string' ? award : (award.title || JSON.stringify(award));
                      return (
                        <div key={i} className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-gray-200 leading-relaxed">{text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
