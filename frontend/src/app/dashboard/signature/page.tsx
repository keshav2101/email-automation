'use client';
import EmailSignatureCustomizer from '@/components/EmailSignatureCustomizer';

export default function SignaturePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          Email Signature Customizer
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Design, customize, and manage your verified email signature across all cold email outreach campaigns and drafts.
        </p>
      </div>

      <EmailSignatureCustomizer />
    </div>
  );
}
