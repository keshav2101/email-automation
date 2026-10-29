'use client';
import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import {
  Building2,
  Users,
  Mail,
  CheckCircle,
  Send,
  MessageSquare,
  Clock,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { clsx } from 'clsx';

interface Stats {
  total_companies: number;
  total_contacts: number;
  emails_drafted: number;
  emails_approved: number;
  emails_sent: number;
  replies_received: number;
  followups_due: number;
  gmail_connected: boolean;
  email_connected?: boolean;
  connected_email?: string;
  plugin_type?: string;
  draft_only_mode: boolean;
  company_status_breakdown: Record<string, number>;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  sublabel?: string;
}) => (
  <div className="stat-card animate-fade-in">
    <div className={clsx('stat-icon', color)}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-gray-600 mt-0.5">{sublabel}</p>}
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    analyticsApi.getDashboard()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const isSenderConnected = Boolean(stats?.email_connected || stats?.gmail_connected || user?.email_connected);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 suppressHydrationWarning className="text-2xl font-bold text-white">
          {greeting}, {user?.full_name?.split(' ')[0] || 'Client'} 👋
        </h1>
        <p className="text-gray-400 mt-1">
          Here's your HR outreach overview.
        </p>
      </div>

      {/* Mailbox Connection Alerts */}
      {isSenderConnected ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-emerald-300">
                  Email Sender Active: <span className="text-white font-semibold">{stats?.connected_email || user?.smtp_user || user?.email || 'keshavg.connect@gmail.com'}</span>
                </p>
                <span className="badge badge-green text-[10px] uppercase">
                  {stats?.plugin_type || user?.email_plugin_type || 'Gmail Plugin'}
                </span>
              </div>
              <p className="text-xs text-emerald-400/80 mt-0.5">
                Ready for automated bulk dispatch. Emails are delivered directly through your verified mailbox.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-xs font-semibold text-emerald-300 hover:text-white underline whitespace-nowrap self-start sm:self-auto"
          >
            Manage Plugin Settings →
          </Link>
        </div>
      ) : (
        stats && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">Email sender not connected</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Connect your Gmail or mailbox in Settings to start sending automated bulk outreach.{' '}
                <Link href="/dashboard/settings" className="underline font-semibold text-white">Go to Settings →</Link>
              </p>
            </div>
          </div>
        )
      )}

      {stats?.draft_only_mode && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">Draft-Only Safety Mode Active</p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              Outreach emails are safely generated and staged as drafts for review. Toggle off in Settings for live sending.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-24 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Companies" value={stats?.total_companies ?? 0} icon={Building2} color="bg-blue-500/15 text-blue-400" />
          <StatCard label="HR Contacts" value={stats?.total_contacts ?? 0} icon={Users} color="bg-purple-500/15 text-purple-400" />
          <StatCard label="Drafts Generated" value={stats?.emails_drafted ?? 0} icon={Mail} color="bg-amber-500/15 text-amber-400" />
          <StatCard label="Approved" value={stats?.emails_approved ?? 0} icon={CheckCircle} color="bg-emerald-500/15 text-emerald-400" />
          <StatCard label="Emails Sent" value={stats?.emails_sent ?? 0} icon={Send} color="bg-brand-500/15 text-brand-400" />
          <StatCard label="Replies Received" value={stats?.replies_received ?? 0} icon={MessageSquare} color="bg-green-500/15 text-green-400" />
          <StatCard label="Follow-Ups Due" value={stats?.followups_due ?? 0} icon={Clock} color="bg-red-500/15 text-red-400" />
          <StatCard
            label="Response Rate"
            value={stats?.emails_sent ? `${Math.round((stats.replies_received / stats.emails_sent) * 100)}%` : '—'}
            icon={TrendingUp}
            color="bg-cyan-500/15 text-cyan-400"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Link href="/dashboard/data-extractor" className="card border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent hover:border-emerald-500/70 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="badge badge-green text-[10px] px-1.5 py-0 font-semibold">New</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Data Extractor</h3>
          <p className="text-xs text-gray-400">Extract all columns, rows & sheets from Excel or CSV. Inspect quality & sync to CRM</p>
        </Link>

        <Link href="/dashboard/excel-automation" className="card border-brand-500/40 bg-gradient-to-b from-brand-500/5 to-transparent hover:border-brand-500/70 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="badge badge-purple text-[10px] px-1.5 py-0 font-semibold">Outreach</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Excel Batch Outreach</h3>
          <p className="text-xs text-gray-400">Upload Resume + Excel sheet to validate, draft & safely dispatch company-tailored emails</p>
        </Link>

        <Link href="/dashboard/studio" className="card hover:border-purple-500/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
          </div>
          <h3 className="font-semibold text-white mb-1">AI Email Studio</h3>
          <p className="text-xs text-gray-400">Interactive workspace to research & craft custom outreach for individual contacts</p>
        </Link>

        <Link href="/dashboard/companies" className="card hover:border-blue-500/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
          </div>
          <h3 className="font-semibold text-white mb-1">Target Companies</h3>
          <p className="text-xs text-gray-400">Manage your company CRM, view hiring statuses, and add recruiter notes</p>
        </Link>
      </div>

      {/* Workflow */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Outreach Workflow</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { step: '1', label: 'Upload Resume', status: 'done' },
            { step: '2', label: 'Add Companies', status: 'active' },
            { step: '3', label: 'AI Research', status: 'pending' },
            { step: '4', label: 'Generate Drafts', status: 'pending' },
            { step: '5', label: 'Review & Approve', status: 'pending' },
            { step: '6', label: 'Send Emails', status: 'pending' },
            { step: '7', label: 'Track Follow-Ups', status: 'pending' },
          ].map(({ step, label, status }, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <div className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
                status === 'done' && 'bg-emerald-500/15 text-emerald-400',
                status === 'active' && 'bg-brand-500/15 text-brand-400 border border-brand-500/30',
                status === 'pending' && 'bg-surface text-gray-500',
              )}>
                <span className={clsx(
                  'w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold',
                  status === 'done' && 'bg-emerald-500 text-white',
                  status === 'active' && 'bg-brand-500 text-white',
                  status === 'pending' && 'bg-surface-border text-gray-600',
                )}>{step}</span>
                {label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-gray-700 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
