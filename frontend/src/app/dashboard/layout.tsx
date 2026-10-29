'use client';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
