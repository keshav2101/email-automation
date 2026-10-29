'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Database,
  User,
  Building2,
  Users,
  Briefcase,
  Sparkles,
  Send,
  Clock,
  BarChart3,
  Settings,
  Mail,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { clsx } from 'clsx';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Data Extractor', href: '/dashboard/data-extractor', icon: Database, isNew: true },
  { label: 'Excel Automation', href: '/dashboard/excel-automation', icon: FileSpreadsheet },
  { label: 'My Profile', href: '/dashboard/profile', icon: User },
  { label: 'Companies', href: '/dashboard/companies', icon: Building2 },
  { label: 'HR Contacts', href: '/dashboard/contacts', icon: Users },
  { label: 'Job Opportunities', href: '/dashboard/jobs', icon: Briefcase },
  { label: 'AI Email Studio', href: '/dashboard/studio', icon: Sparkles },
  { label: 'Campaigns', href: '/dashboard/campaigns', icon: Send },
  { label: 'Follow-Ups', href: '/dashboard/followups', icon: Clock },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-card border-r border-surface-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white">HR Outreach AI</p>
            <p className="text-[10px] text-gray-500">Personalized Outreach</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'nav-item group',
                isActive ? 'nav-item-active' : 'nav-item-inactive'
              )}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300')} />
              <span>{label}</span>
              {label === 'Data Extractor' && (
                <span className="ml-auto badge badge-green text-[10px] px-1.5 py-0 font-semibold">New</span>
              )}
              {label === 'AI Email Studio' && (
                <span className="ml-auto badge badge-purple text-[10px] px-1.5 py-0">AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-surface-border">
        <div className="card-sm mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-gray-200 truncate">{user?.full_name || 'Client User'}</p>
                <span className="badge badge-purple text-[9px] px-1.5 py-0 font-bold uppercase">Client</span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">{user?.smtp_user || user?.email || 'client@outreach.local'}</p>
            </div>
          </div>
        </div>
        <div className="px-2 py-1 flex items-center justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            Direct Client Mode
          </span>
          <span className="badge badge-green text-[9px] px-1.5 py-0 font-medium">
            {user?.email_connected ? 'Gmail Active' : 'Plugin Ready'}
          </span>
        </div>
      </div>
    </aside>
  );
}
