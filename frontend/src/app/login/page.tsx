'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="card text-center p-8 max-w-sm w-full space-y-4 shadow-2xl border border-surface-border">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-brand text-white mx-auto">
          <Zap className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">HR Outreach AI</h2>
        <p className="text-xs text-gray-400">Loading Client Workspace directly without login...</p>
        <div className="flex justify-center pt-2">
          <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
        </div>
      </div>
    </div>
  );
}
