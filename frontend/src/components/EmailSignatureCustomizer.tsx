'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { userApi, candidateApi, emailPluginApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  PenTool, Sparkles, Copy, Check, Eye, Code, Palette,
  Send, Save, RefreshCw, Mail, Phone, Globe,
  GraduationCap, Briefcase, Shield, CheckCircle, ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';

const TEMPLATES = [
  { id: 'modern', label: 'Modern Accent', desc: 'Sleek accent bar with inline badges and links', popular: true },
  { id: 'corporate', label: 'Corporate Card', desc: 'Formal divider, title hierarchy & confidentiality', popular: false },
  { id: 'developer', label: 'Tech & Dev', desc: 'Monospace, developer badges, GitHub & Portfolio focus', popular: false },
  { id: 'academic', label: 'Academic & Research', desc: 'Serif typography, degree, university & publication links', popular: false },
  { id: 'minimal', label: 'Minimalist', desc: 'Clean, distraction-free 2-line sign-off', popular: false },
  { id: 'custom', label: 'Raw HTML Editor', desc: 'Full custom HTML with custom styling', popular: false },
];

const ACCENT_COLORS = [
  { name: 'Electric Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Slate Gray', hex: '#64748b' },
];

const GREETINGS = [
  'Best regards,',
  'Warmly,',
  'Sincerely,',
  'Thanks & regards,',
  'Kind regards,',
  'Cheers,',
];

export default function EmailSignatureCustomizer() {
  const { user, updateUser } = useAuthStore();
  const [template, setTemplate] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'visual' | 'text' | 'html'>('visual');
  const [sendingTest, setSendingTest] = useState(false);

  const [formData, setFormData] = useState({
    greeting: 'Best regards,',
    full_name: '',
    title: '',
    university: '',
    degree: '',
    email: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    accent_color: '#3b82f6',
    include_disclaimer: false,
    custom_html: '',
    append_default: true,
  });

  const [renderedHtml, setRenderedHtml] = useState('');
  const [renderedText, setRenderedText] = useState('');

  // Fetch current signature from backend on mount
  useEffect(() => {
    loadSignature();
  }, []);

  const loadSignature = async () => {
    setLoading(true);
    try {
      const res = await userApi.getSignature();
      if (res) {
        setTemplate(res.template || 'modern');
        if (res.signature_data) {
          setFormData((prev) => ({
            ...prev,
            ...res.signature_data,
            append_default: res.append_signature_default ?? true,
          }));
        }
        setRenderedHtml(res.email_signature || '');
        setRenderedText(res.signature_text || '');
      }
    } catch {
      // Fallback: populate from current user profile
      autoFillFromProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const autoFillFromProfile = async (showToast = true) => {
    try {
      const profile = await candidateApi.getProfile();
      if (profile) {
        setFormData((prev) => ({
          ...prev,
          full_name: profile.full_name || user?.full_name || prev.full_name,
          title: (profile.preferred_roles && profile.preferred_roles[0]) || (profile.field_of_study ? `${profile.field_of_study} Graduate` : 'Software & AI Engineer'),
          university: profile.university || prev.university,
          degree: profile.degree || prev.degree,
          email: profile.email || user?.email || prev.email,
          phone: profile.phone || prev.phone,
          linkedin_url: profile.linkedin_url || prev.linkedin_url,
          github_url: profile.github_url || prev.github_url,
          portfolio_url: profile.portfolio_url || prev.portfolio_url,
        }));
        if (showToast) {
          toast.success('Signature fields populated from candidate profile & resume!');
        }
      }
    } catch {
      if (showToast) {
        toast.error('Could not load candidate profile data');
      }
    }
  };

  // Re-render live preview whenever form or template changes
  useEffect(() => {
    updatePreview();
  }, [formData, template]);

  const updatePreview = async () => {
    try {
      const res = await userApi.previewSignature({
        ...formData,
        template,
      });
      if (res) {
        setRenderedHtml(res.html);
        setRenderedText(res.text);
      }
    } catch {
      // Fallback internal generator
      setRenderedHtml(localRenderHtml(formData, template));
      setRenderedText(localRenderText(formData));
    }
  };

  const localRenderHtml = (data: typeof formData, tmpl: string) => {
    const greeting = data.greeting || 'Best regards,';
    const name = data.full_name || 'Your Name';
    const title = data.title || 'Software Engineer';
    const uni = data.university || '';
    const degree = data.degree || '';
    const color = data.accent_color || '#3b82f6';
    const edu = degree && uni ? `${degree} • ${uni}` : (degree || uni);
    const links = [
      data.email && `<a href="mailto:${data.email}" style="color:${color};text-decoration:none;">${data.email}</a>`,
      data.phone && `<span style="color:#64748b;">${data.phone}</span>`,
      data.linkedin_url && `<a href="${data.linkedin_url}" style="color:${color};text-decoration:none;font-weight:600;">LinkedIn</a>`,
      data.github_url && `<a href="${data.github_url}" style="color:${color};text-decoration:none;font-weight:600;">GitHub</a>`,
      data.portfolio_url && `<a href="${data.portfolio_url}" style="color:${color};text-decoration:none;font-weight:600;">Portfolio</a>`,
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');

    return `
      <div style="font-family:sans-serif;color:#0f172a;line-height:1.5;margin-top:16px;">
        <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">${greeting}</p>
        <div style="border-left:3px solid ${color};padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:#0f172a;">${name}</div>
          <div style="font-size:13px;color:#475569;margin-top:1px;">${title}</div>
          ${edu ? `<div style="font-size:12px;color:#64748b;margin-top:1px;">${edu}</div>` : ''}
          <div style="font-size:12px;margin-top:6px;">${links}</div>
        </div>
      </div>
    `;
  };

  const localRenderText = (data: typeof formData) => {
    return `${data.greeting}\n\n${data.full_name}\n${data.title}\n${data.degree ? `${data.degree} | ` : ''}${data.university}\n${data.email} | ${data.phone}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await userApi.saveSignature({
        ...formData,
        template,
      });
      if (res) {
        updateUser({
          email_signature: res.email_signature,
          signature_template: res.template,
          signature_data: res.signature_data,
          append_signature_default: res.append_signature_default,
        });
        toast.success('Email signature saved & active across platform!');
      }
    } catch {
      toast.error('Failed to save signature');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = previewTab === 'text' ? renderedText : renderedHtml;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success(previewTab === 'text' ? 'Copied plain text signature!' : 'Copied HTML signature to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const testEmail = formData.email || user?.email;
      await emailPluginApi.sendTestEmail(testEmail);
      toast.success(`Test email dispatched with your signature to ${testEmail}!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to dispatch test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="card p-6 border border-surface-border bg-surface/90 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500/20 to-indigo-500/10 border border-brand-500/30 text-brand-400">
            <PenTool className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Email Signature Studio
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                Live Customizer
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Customize professional sign-offs with verified credentials, contact badges, and social links
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => autoFillFromProfile(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-brand-300 hover:text-white border-brand-500/30 hover:bg-brand-500/10"
            title="Auto-fill with details extracted from your active resume"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Auto-Fill from Resume</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-md shadow-brand-500/20"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving...' : 'Save Signature'}</span>
          </button>
        </div>
      </div>

      {/* Preset Style Tabs */}
      <div>
        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2.5">
          1. Choose Signature Template Style:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={clsx(
                'relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                template === t.id
                  ? 'border-brand-500 bg-brand-500/15 text-white shadow-md shadow-brand-500/10 ring-1 ring-brand-500'
                  : 'border-surface-border bg-surface-elevated/40 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              )}
            >
              {t.popular && (
                <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-brand-500 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                  Popular
                </span>
              )}
              <span className="text-xs font-bold text-white">{t.label}</span>
              <span className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Form Controls (Left) & Real-Time Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Controls Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-border space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-brand-400" />
              <span>2. Personalize Information & Links</span>
            </h3>

            {/* Greeting & Accent Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Sign-off Greeting
                </label>
                <select
                  value={formData.greeting}
                  onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                  className="input text-xs w-full bg-surface text-white border-surface-border py-2"
                >
                  {GREETINGS.map((g) => (
                    <option key={g} value={g} className="bg-surface-elevated text-white">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-1.5 pt-1">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setFormData({ ...formData, accent_color: c.hex })}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={clsx(
                        'w-6 h-6 rounded-full transition-transform',
                        formData.accent_color === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'
                      )}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="w-6 h-6 rounded-full bg-transparent cursor-pointer border-0 p-0 ml-1"
                    title="Custom Color"
                  />
                </div>
              </div>
            </div>

            {/* Full Name & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Keshav Gupta"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Professional Title / Role *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. AI/ML Engineer | Full-Stack Developer"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>
            </div>

            {/* University & Degree */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={formData.university}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  placeholder="e.g. SRMIST Kattankulathur"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Degree / Major
                </label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="e.g. B.Tech Computer Science"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="keshavg.connect@gmail.com"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input text-xs w-full bg-surface text-white border-surface-border"
                />
              </div>
            </div>

            {/* Social / Portfolio Links */}
            <div className="space-y-2 pt-1">
              <label className="block text-[11px] font-semibold text-gray-400">
                Professional Web Links
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="LinkedIn URL"
                  className="input text-[11px] w-full bg-surface text-white border-surface-border"
                />
                <input
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  placeholder="GitHub URL"
                  className="input text-[11px] w-full bg-surface text-white border-surface-border"
                />
                <input
                  type="url"
                  value={formData.portfolio_url}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="Portfolio / Web URL"
                  className="input text-[11px] w-full bg-surface text-white border-surface-border"
                />
              </div>
            </div>

            {/* Custom HTML editor if selected */}
            {template === 'custom' && (
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                  Custom HTML Source Code
                </label>
                <textarea
                  value={formData.custom_html}
                  onChange={(e) => setFormData({ ...formData, custom_html: e.target.value })}
                  rows={5}
                  placeholder="<div><p>Best regards,</p><strong>Alex Candidate</strong>...</div>"
                  className="input text-xs w-full font-mono bg-surface text-amber-200 border-surface-border"
                />
              </div>
            )}

            {/* Options & Disclaimers */}
            <div className="pt-2 border-t border-surface-border/60 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.include_disclaimer}
                  onChange={(e) => setFormData({ ...formData, include_disclaimer: e.target.checked })}
                  className="rounded border-gray-600 bg-surface text-brand-500 focus:ring-0"
                />
                <span>Include legal email confidentiality disclaimer note</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-300 font-medium">
                <input
                  type="checkbox"
                  checked={formData.append_default}
                  onChange={(e) => setFormData({ ...formData, append_default: e.target.checked })}
                  className="rounded border-gray-600 bg-surface text-emerald-500 focus:ring-0"
                />
                <span>Automatically attach this signature to all outgoing cold email drafts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-3 sticky top-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-400" />
              <span>Real-Time Inbox Preview</span>
            </h3>

            {/* Preview View Switcher */}
            <div className="flex items-center bg-surface border border-surface-border rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewTab('visual')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  previewTab === 'visual' ? 'bg-brand-500 text-white font-semibold' : 'text-gray-400 hover:text-white'
                )}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('text')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  previewTab === 'text' ? 'bg-brand-500 text-white font-semibold' : 'text-gray-400 hover:text-white'
                )}
              >
                Plain Text
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('html')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  previewTab === 'html' ? 'bg-brand-500 text-white font-semibold' : 'text-gray-400 hover:text-white'
                )}
              >
                HTML Code
              </button>
            </div>
          </div>

          {/* Email Client Mock Frame */}
          <div className="rounded-2xl border border-surface-border bg-slate-900/90 shadow-2xl overflow-hidden">
            {/* Mock Email Client Window Header */}
            <div className="px-4 py-2.5 bg-slate-800/80 border-b border-surface-border flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 font-mono text-[11px] text-gray-300">Message Preview</span>
              </div>
              <span className="text-[10px] text-gray-400">Recipient View</span>
            </div>

            {/* Mock Email Content */}
            <div className="p-4 space-y-3 bg-white text-slate-800 text-xs min-h-[220px]">
              <div className="border-b border-slate-200 pb-2.5 text-[11px] text-slate-500 space-y-0.5">
                <div><strong>To:</strong> tech-recruiting@innovatech.io</div>
                <div><strong>Subject:</strong> Senior AI Engineer Application — {formData.full_name || 'Alex'}</div>
              </div>

              <div className="space-y-1.5 text-slate-700 leading-relaxed font-sans text-xs">
                <p>Hi Sarah,</p>
                <p>
                  I noticed your team’s recent breakthrough in distributed agentic inference. Given my background building production-grade LLM pipelines, I’d love to explore how I can contribute to your engineering roadmaps.
                </p>
                <p>Attached is my resume with full project specifications and benchmarks.</p>
              </div>

              {/* Rendered Signature Area */}
              <div className="pt-2 border-t border-slate-100">
                {previewTab === 'visual' && (
                  <div
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    className="overflow-x-auto text-slate-900"
                  />
                )}

                {previewTab === 'text' && (
                  <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {renderedText}
                  </pre>
                )}

                {previewTab === 'html' && (
                  <pre className="font-mono text-[10px] text-slate-800 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-[200px] overflow-y-auto">
                    {renderedHtml}
                  </pre>
                )}
              </div>
            </div>

            {/* Card Footer Controls */}
            <div className="p-3 bg-slate-800/90 border-t border-surface-border flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 text-gray-300 hover:text-white"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 text-brand-300 hover:text-brand-200 border-brand-500/30"
                title="Send a sample email to yourself to preview formatting in your mail app"
              >
                {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sendingTest ? 'Sending...' : 'Send Test to Inbox'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
