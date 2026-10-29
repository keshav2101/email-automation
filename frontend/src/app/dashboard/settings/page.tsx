'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { userApi, gmailApi, emailPluginApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Settings, Mail, Shield, Bell,
  ExternalLink, CheckCircle, AlertCircle, Wifi, WifiOff,
  Zap, Key, Server, Lock, Send, RefreshCw, Check, Info, HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import EmailSignatureCustomizer from '@/components/EmailSignatureCustomizer';

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [saving, setSaving] = useState(false);

  // Email Plugin state
  const [pluginStatus, setPluginStatus] = useState<any>(null);
  const [selectedPreset, setSelectedPreset] = useState<'gmail' | 'outlook' | 'yahoo' | 'zoho' | 'custom' | 'oauth'>('gmail');
  const [pluginEmail, setPluginEmail] = useState('');
  const [pluginPassword, setPluginPassword] = useState('');
  const [pluginFromName, setPluginFromName] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState(587);
  const [customTls, setCustomTls] = useState(true);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const fetchPluginStatus = async () => {
    try {
      const status = await emailPluginApi.getStatus();
      setPluginStatus(status);
      const email = status.sender_email || status.email;
      if (email && !pluginEmail) {
        setPluginEmail(email);
      }
      if (status.from_name && !pluginFromName) {
        setPluginFromName(status.from_name);
      }
      if (status.connected) {
        updateUser({
          email_connected: true,
          email_plugin_type: status.plugin_type,
          smtp_user: status.email,
          send_enabled: status.send_enabled,
          draft_only_mode: status.draft_only_mode,
        });
      }
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchPluginStatus();
  }, []);

  const handleToggle = async (field: string, value: boolean) => {
    setSaving(true);
    try {
      await userApi.updateMe({ [field]: value });
      updateUser({ [field]: value });
      toast.success('Settings saved');
      fetchPluginStatus();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const isAlreadyConnected = Boolean(pluginStatus?.connected || user?.email_connected || user?.gmail_connected);
    const emailToTest = (pluginEmail || pluginStatus?.sender_email || pluginStatus?.email || user?.email || '').trim();
    if (!emailToTest) {
      toast.error('Please enter your email address first');
      return;
    }
    const cleanPassword = pluginPassword ? pluginPassword.trim().replace(/\s+/g, '') : undefined;
    if (selectedPreset !== 'oauth' && !cleanPassword && !isAlreadyConnected) {
      toast.error('Please enter your 16-character App Password');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await emailPluginApi.testConnection({
        provider: selectedPreset,
        email: emailToTest,
        username: emailToTest,
        password: cleanPassword,
        host: selectedPreset === 'custom' ? customHost : undefined,
        port: selectedPreset === 'custom' ? customPort : undefined,
        use_tls: customTls,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message || 'Handshake successful! Mail server verified.');
      } else {
        toast.error(res.message || 'Connection test failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Handshake test failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConnectPlugin = async () => {
    const isAlreadyConnected = Boolean(pluginStatus?.connected || user?.email_connected || user?.gmail_connected);
    const emailToConnect = (pluginEmail || pluginStatus?.sender_email || pluginStatus?.email || user?.email || '').trim();
    if (!emailToConnect) {
      toast.error('Please enter an email address');
      return;
    }
    const cleanPassword = pluginPassword ? pluginPassword.trim().replace(/\s+/g, '') : undefined;
    if (selectedPreset !== 'oauth' && !cleanPassword && !isAlreadyConnected) {
      toast.error('Please enter your 16-character App Password');
      return;
    }

    setConnecting(true);
    try {
      const res = await emailPluginApi.connectSmtp({
        provider: selectedPreset,
        email: emailToConnect,
        password: cleanPassword,
        from_name: pluginFromName || user?.full_name || 'Alex Candidate',
        custom_host: selectedPreset === 'custom' ? customHost : undefined,
        custom_port: selectedPreset === 'custom' ? customPort : undefined,
        use_tls: customTls,
        test_before_saving: true,
      });

      toast.success(`Successfully connected ${res.email}! Ready for automated sending.`);
      updateUser({
        email_connected: true,
        email_plugin_type: res.plugin_type,
        send_enabled: true,
      });
      fetchPluginStatus();
      setPluginPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to connect email plugin');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectPlugin = async () => {
    if (!confirm('Disconnect this email sender? Automated bulk sending will be paused.')) return;
    try {
      await emailPluginApi.disconnect();
      updateUser({ email_connected: false, email_plugin_type: null });
      toast.success('Email sender disconnected');
      fetchPluginStatus();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const res = await emailPluginApi.sendTestEmail();
      toast.success(res.message || 'Test email dispatched successfully! Check your inbox.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleConnectGmailOAuth = async () => {
    try {
      const { auth_url } = await gmailApi.getAuthUrl();
      window.location.href = auth_url;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
        'Google Cloud OAuth requires Google Cloud Console setup. Switched to Gmail App Password (1-Click setup) below!'
      );
      setSelectedPreset('gmail');
    }
  };

  const isConnected = pluginStatus?.connected || user?.email_connected || user?.gmail_connected;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          Settings & Integrations
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Connect your sender mailbox through the Email Plugin, configure automated bulk sending, and manage safety controls.
        </p>
      </div>

      <div className="space-y-6">
        {/* EMAIL PLUGIN CONNECTION HUB */}
        <div className="card p-6 border border-surface-border bg-surface/90 shadow-xl shadow-brand-500/5">
          <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-surface-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Email Connection Plugin</span>
                  {isConnected ? (
                    <span className="badge badge-green text-[10px] flex items-center gap-1">
                      <Wifi className="w-2.5 h-2.5" /> Connected
                    </span>
                  ) : (
                    <span className="badge badge-yellow text-[10px] flex items-center gap-1">
                      <WifiOff className="w-2.5 h-2.5" /> Not Connected
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400">
                  Plug in your personal or work email to send personalized bulk emails directly from your domain.
                </p>
              </div>
            </div>

            {isConnected && (
              <button
                onClick={handleDisconnectPlugin}
                className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                Disconnect Sender
              </button>
            )}
          </div>

          {/* Active Connection Banner */}
          {isConnected ? (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-300">
                      {pluginStatus?.sender_email || user?.email || 'Connected'}
                    </span>
                    <span className="badge badge-green text-[10px] uppercase">
                      {pluginStatus?.plugin_type || 'SMTP Plugin'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    Sender: <span className="font-semibold text-white">{pluginStatus?.from_name || 'Alex Candidate'}</span> • Ready for automated bulk delivery
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || sendingTestEmail}
                  className="btn-secondary text-xs py-1.5 px-3 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                >
                  {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Test Handshake'}
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || testingConnection}
                  className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  {sendingTestEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs text-amber-300">
                <strong className="font-semibold">No sender connected:</strong> Connect your Gmail, Outlook, or custom mailbox using an App Password below to enable bulk automated sending.
              </div>
            </div>
          )}

          {/* Provider Selection Tabs */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
              Select Email Plugin Provider:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { id: 'gmail', label: 'Gmail', sub: 'App Password', popular: true },
                { id: 'outlook', label: 'Outlook', sub: 'Office 365', popular: false },
                { id: 'yahoo', label: 'Yahoo', sub: 'App Password', popular: false },
                { id: 'zoho', label: 'Zoho Mail', sub: 'App Password', popular: false },
                { id: 'custom', label: 'Custom SMTP', sub: 'Any Host', popular: false },
                { id: 'oauth', label: 'Gmail OAuth', sub: 'GCP Cloud', popular: false },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(p.id as any);
                    setTestResult(null);
                  }}
                  className={clsx(
                    'relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                    selectedPreset === p.id
                      ? 'border-brand-500 bg-brand-500/15 text-white shadow-md shadow-brand-500/10 ring-1 ring-brand-500'
                      : 'border-surface-border bg-surface-elevated/40 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-brand-500 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                      Popular
                    </span>
                  )}
                  <span className="text-xs font-bold text-white">{p.label}</span>
                  <span className="text-[10px] text-gray-400 mt-1">{p.sub}</span>
                </button>
              ))}
            </div>

            {/* Provider Forms */}
            {selectedPreset === 'oauth' ? (
              <div className="p-5 rounded-2xl bg-surface-elevated/40 border border-surface-border space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Why did Google show an OAuth error?</span>
                  </div>
                  <p className="text-amber-200/80 leading-relaxed">
                    Google blocks OAuth authorization (<code className="px-1 py-0.5 rounded bg-surface text-amber-300">invalid_client</code> or <code className="px-1 py-0.5 rounded bg-surface text-amber-300">Access Blocked</code>) unless you have set up a verified Google Cloud Console project with OAuth Consent screens and client IDs.
                  </p>
                  <p className="text-emerald-300 font-semibold pt-1">
                    👉 <strong>Zero-Setup Solution:</strong> Switch to the <strong>Gmail (App Password)</strong> tab! It bypasses all Google Cloud barriers and connects in 15 seconds.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedPreset('gmail')}
                    className="btn-primary text-xs py-2 px-4 mt-2 flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-brand-600 shadow-md shadow-emerald-500/20"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Switch to 1-Click Gmail App Password (Recommended) →</span>
                  </button>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Google Cloud OAuth 2.0 (For Enterprise Developers)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      If you already have a configured Google Cloud Project with published consent screens, set <code className="px-1 py-0.5 rounded bg-surface text-brand-300">GOOGLE_CLIENT_ID</code> and <code className="px-1 py-0.5 rounded bg-surface text-brand-300">GOOGLE_CLIENT_SECRET</code> in your <code className="px-1 py-0.5 rounded bg-surface text-brand-300">.env</code> file.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleConnectGmailOAuth}
                    className="btn-secondary text-xs py-2 px-4 flex items-center gap-2 text-gray-400 hover:text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Try Google Cloud OAuth Flow →</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-surface-elevated/40 border border-surface-border space-y-4">
                {/* Provider Help Hint */}
                {selectedPreset === 'gmail' && (
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-300">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-blue-200">How to get a Gmail App Password (takes 15 seconds):</strong>
                      <ol className="list-decimal list-inside mt-1 space-y-0.5 text-blue-300/80">
                        <li>Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-semibold text-white">myaccount.google.com/apppasswords</a></li>
                        <li>Ensure 2-Step Verification is enabled on your Google account</li>
                        <li>Create an app named &quot;HR Automation&quot; and copy the 16-character generated password</li>
                      </ol>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Your Email Address
                    </label>
                    <input
                      type="email"
                      value={pluginEmail}
                      onChange={(e) => setPluginEmail(e.target.value)}
                      placeholder={selectedPreset === 'gmail' ? 'yourname@gmail.com' : 'user@company.com'}
                      className="input text-xs w-full bg-surface text-white border-surface-border"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      {selectedPreset === 'gmail' ? '16-Character App Password' : 'Password / App Token'}
                    </label>
                    <input
                      type="password"
                      value={pluginPassword}
                      onChange={(e) => setPluginPassword(e.target.value)}
                      placeholder={isConnected ? '•••••••••••••••• (Password Saved & Verified)' : (selectedPreset === 'gmail' ? 'abcd efgh ijkl mnop' : '••••••••••••')}
                      className="input text-xs w-full bg-surface text-white border-surface-border font-mono"
                    />
                    {isConnected && !pluginPassword && (
                      <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                        ✓ Password securely saved in background. Leave blank to keep current password.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Sender Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={pluginFromName}
                      onChange={(e) => setPluginFromName(e.target.value)}
                      placeholder={user?.full_name || 'Alex Candidate'}
                      className="input text-xs w-full bg-surface text-white border-surface-border"
                    />
                  </div>

                  {selectedPreset === 'custom' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          SMTP Host
                        </label>
                        <input
                          type="text"
                          value={customHost}
                          onChange={(e) => setCustomHost(e.target.value)}
                          placeholder="smtp.mailgun.org"
                          className="input text-xs w-full bg-surface text-white border-surface-border"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          SMTP Port
                        </label>
                        <input
                          type="number"
                          value={customPort}
                          onChange={(e) => setCustomPort(parseInt(e.target.value))}
                          placeholder="587"
                          className="input text-xs w-full bg-surface text-white border-surface-border"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customTls}
                            onChange={(e) => setCustomTls(e.target.checked)}
                            className="rounded border-surface-border bg-surface text-brand-500 focus:ring-0"
                          />
                          <span>Use TLS / STARTTLS (Recommended: Port 587)</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {/* Test Result Feedback */}
                {testResult && (
                  <div
                    className={clsx(
                      'p-3 rounded-xl border text-xs flex items-center justify-between',
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                    )}
                  >
                    <span>{testResult.message}</span>
                    {testResult.latency_ms && (
                      <span className="font-mono text-[11px] opacity-80">
                        {testResult.latency_ms}ms roundtrip
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="btn-secondary text-xs py-2 px-4 flex items-center gap-2"
                  >
                    {testingConnection ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Mail Server...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-brand-400" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleConnectPlugin}
                    disabled={connecting}
                    className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-brand-500/20"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting & Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Connect Email Plugin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* EMAIL SIGNATURE STUDIO */}
        <EmailSignatureCustomizer />

        {/* SENDING CONTROLS & THROTTLING */}
        <div className="card p-6 border border-surface-border bg-surface/90">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-brand-500/15">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Sending Safeguards & Limits</h2>
              <p className="text-xs text-gray-500">Configure safety thresholds to protect your sender reputation</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-surface-border">
              <div>
                <p className="text-sm font-medium text-white">Draft-Only Preview Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, emails are prepared and staged as drafts for manual review before sending.
                </p>
              </div>
              <button
                onClick={() => handleToggle('draft_only_mode', !user?.draft_only_mode)}
                className={clsx(
                  'relative w-12 h-6 rounded-full transition-colors',
                  user?.draft_only_mode ? 'bg-brand-500' : 'bg-surface-border'
                )}
                id="toggle-draft-mode"
              >
                <span
                  className={clsx(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    user?.draft_only_mode ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-surface-border">
              <div>
                <p className="text-sm font-medium text-white">Enable Automated Delivery</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allow approved emails to be dispatched automatically via your connected email plugin.
                </p>
              </div>
              <button
                onClick={() => handleToggle('send_enabled', !user?.send_enabled)}
                className={clsx(
                  'relative w-12 h-6 rounded-full transition-colors',
                  user?.send_enabled ? 'bg-emerald-500' : 'bg-surface-border'
                )}
                id="toggle-send"
              >
                <span
                  className={clsx(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    user?.send_enabled ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs font-medium text-blue-300 mb-1">🔒 Enterprise Outreach Protection</p>
          <ul className="space-y-1 text-xs text-blue-400/70">
            <li>• Bulk automation enforces configurable rate-limiting (10–30s delays) with random jitter to prevent spam flags</li>
            <li>• Maximum daily limit protection prevents burning your personal or corporate email domain</li>
            <li>• Previously contacted recruiters and opted-out contacts are automatically suppressed</li>
            <li>• All actions are audited with timestamps, message IDs, and delivery statuses</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
