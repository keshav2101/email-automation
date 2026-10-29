'use client';
import { useState, useEffect } from 'react';
import { analyticsApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Mail, MessageSquare, Building2, Users } from 'lucide-react';

const COLORS = ['#4353f9', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getDashboard().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pipelineData = stats ? [
    { name: 'Companies', value: stats.total_companies },
    { name: 'Contacts', value: stats.total_contacts },
    { name: 'Drafts', value: stats.emails_drafted },
    { name: 'Approved', value: stats.emails_approved },
    { name: 'Sent', value: stats.emails_sent },
    { name: 'Replies', value: stats.replies_received },
  ] : [];

  const statusData = stats ? Object.entries(stats.company_status_breakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  })) : [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Track your outreach performance and pipeline health</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card h-64 skeleton" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Response Rate', value: stats?.emails_sent ? `${Math.round((stats.replies_received / stats.emails_sent) * 100)}%` : '—', icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/15' },
              { label: 'Emails Sent', value: stats?.emails_sent ?? 0, icon: Mail, color: 'text-brand-400 bg-brand-500/15' },
              { label: 'Replies', value: stats?.replies_received ?? 0, icon: MessageSquare, color: 'text-green-400 bg-green-500/15' },
              { label: 'Companies', value: stats?.total_companies ?? 0, icon: Building2, color: 'text-purple-400 bg-purple-500/15' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card flex items-center gap-4">
                <div className={`p-3 rounded-lg ${color.split(' ')[1]}`}>
                  <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-white mb-4">Outreach Pipeline</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2536" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#161b27', border: '1px solid #1e2536', borderRadius: '8px', color: '#f3f4f6' }}
                  />
                  <Bar dataKey="value" fill="#4353f9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-4">Company Status Breakdown</h3>
              {statusData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                  No data yet — add companies to see breakdown
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#161b27', border: '1px solid #1e2536', borderRadius: '8px', color: '#f3f4f6' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card bg-surface-card/50">
            <h3 className="font-semibold text-white mb-3 text-sm">📊 Analytics Notes</h3>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li>• Open and click tracking requires Gmail-specific third-party services and may not be available.</li>
              <li>• Email delivery confirmation is only shown when Gmail API confirms the send operation.</li>
              <li>• Response rate is calculated only for emails confirmed as sent by Gmail API.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
