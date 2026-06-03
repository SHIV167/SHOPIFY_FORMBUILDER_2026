'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Cfg {
  // Sender
  senderName: string; senderEmail: string; customEmail: string;
  // Admin email
  adminEmail: string; adminEmailSubject: string; adminEmailBody: string;
  // Customer email
  allowCustomerEmail: boolean; customerEmailSubject: string; customerEmailBody: string;
  // Global CSS
  globalCss: string;
  // Email provider
  emailProvider: string;
  // SMTP
  smtpEnabled: boolean; smtpHost: string; smtpPort: number;
  smtpUser: string; smtpPass: string; smtpEncryption: boolean;
  smtpFromAddress: string; smtpFromName: string;
  // Klaviyo
  klaviyoEnabled: boolean; klaviyoApiKey: string;
  // Mailchimp
  mailchimpEnabled: boolean; mailchimpApiKey: string;
  // reCAPTCHA
  enableRecaptcha: boolean; recaptchaType: string;
  recaptchaSiteKey: string; recaptchaSecretKey: string;
  // Spam
  maxSubmissionsPerIpPerHour: number; blockedEmailDomains: string;
  // Twilio SMS
  twilioAccountSid: string; twilioAuthToken: string; twilioFromNumber: string;
  // WhatsApp
  whatsappAccountSid: string; whatsappFromNumber: string;
  // CRM
  hubspotToken: string; activecampaignUrl: string;
  activecampaignApiKey: string; airtableToken: string;
  // Stripe
  stripePublishableKey: string; stripeSecretKey: string;
  // Slack
  slackEnabled: boolean; slackWebhookUrl: string;
  // IP blocking
  blockedIps: string; blockIpMessage: string;
  // API
  apiToken: string; apiTokenCreatedAt: string | null;
}

const defaults: Cfg = {
  senderName: 'Contact Form', senderEmail: '', customEmail: '',
  adminEmail: '', adminEmailSubject: '[form_name] – New submission', adminEmailBody: '',
  allowCustomerEmail: false, customerEmailSubject: 'Thank you for contacting us', customerEmailBody: '',
  globalCss: '',
  emailProvider: 'console',
  smtpEnabled: false, smtpHost: 'smtp.gmail.com', smtpPort: 587,
  smtpUser: '', smtpPass: '', smtpEncryption: true, smtpFromAddress: '', smtpFromName: '',
  klaviyoEnabled: false, klaviyoApiKey: '',
  mailchimpEnabled: false, mailchimpApiKey: '',
  enableRecaptcha: false, recaptchaType: 'v2', recaptchaSiteKey: '', recaptchaSecretKey: '',
  maxSubmissionsPerIpPerHour: 10, blockedEmailDomains: 'tempmail.com, mailinator.com',
  twilioAccountSid: '', twilioAuthToken: '', twilioFromNumber: '',
  whatsappAccountSid: '', whatsappFromNumber: '',
  hubspotToken: '', activecampaignUrl: '', activecampaignApiKey: '', airtableToken: '',
  stripePublishableKey: '', stripeSecretKey: '',
  slackEnabled: false, slackWebhookUrl: '',
  blockedIps: '', blockIpMessage: '',
  apiToken: '', apiTokenCreatedAt: null,
};

const EMAIL_VARS = ['[form_name]', '[form_data]', '[customer_name]', '[store_name]', '[submission_date]'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ id, title, badge, icon, open, onToggle, children }: {
  id: string; title: string; badge?: string; icon: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" id={id}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              badge === 'Pro+' ? 'bg-yellow-100 text-yellow-700' :
              badge === 'Pro' ? 'bg-purple-100 text-purple-700' :
              'bg-sky-100 text-sky-700'
            }`}>{badge}</span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', mono = false }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none ${mono ? 'font-mono' : ''}`}
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function EmailBodyEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertVar = (v: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + v + value.slice(end);
    onChange(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {EMAIL_VARS.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => insertVar(v)}
            title={`Click to insert ${v}`}
            className="text-xs px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded font-mono cursor-pointer transition"
          >
            {v}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={6}
        placeholder="Write your email body. Click a variable above to insert it."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none resize-y font-mono"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPanel({ shop }: { shop: string }) {
  const [cfg, setCfg] = useState<Cfg>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ sender: true });
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const toggle = (key: string) => setOpen(p => ({ ...p, [key]: !p[key] }));
  const set = (patch: Partial<Cfg>) => setCfg(p => ({ ...p, ...patch }));

  // Load settings
  useEffect(() => {
    if (!shop) return;
    setLoading(true);
    fetch(`/api/settings?shop=${encodeURIComponent(shop)}`)
      .then(r => r.json())
      .then(d => { if (d.settings) setCfg({ ...defaults, ...d.settings }); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shop]);

  const save = async (extraPayload?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain: shop, ...cfg, ...extraPayload }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Save failed'); return; }
      if (d.settings) setCfg(p => ({ ...p, ...d.settings }));
      toast.success('Settings saved!');
    } finally { setSaving(false); }
  };

  const generateApiToken = async () => {
    if (!confirm('Generate a new token? The old token will stop working immediately.')) return;
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain: shop, generateApiToken: true }),
      });
      const d = await res.json();
      if (d.settings?.apiToken) {
        setCfg(p => ({ ...p, apiToken: d.settings.apiToken, apiTokenCreatedAt: d.settings.apiTokenCreatedAt }));
        setTokenVisible(true);
        toast.success('New token generated!');
      }
    } finally { setGeneratingToken(false); }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/settings/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopDomain: shop,
          smtpHost: cfg.smtpHost,
          smtpPort: cfg.smtpPort,
          smtpUser: cfg.smtpUser,
          smtpPass: cfg.smtpPass,
          smtpFromAddress: cfg.smtpFromAddress,
          smtpFromName: cfg.smtpFromName,
          smtpEncryption: cfg.smtpEncryption,
        }),
      });
      const d = await res.json();
      setSmtpTestResult({ success: d.success, message: d.message || (d.success ? 'SMTP configuration is valid!' : 'SMTP test failed') });
      if (d.success) {
        toast.success('SMTP test successful!');
      } else {
        toast.error('SMTP test failed');
      }
    } catch (error: any) {
      setSmtpTestResult({ success: false, message: error.message || 'Network error' });
      toast.error('SMTP test failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-16">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-sky-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl space-y-4">
      {/* Header + Save */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={() => save()}
          disabled={saving}
          className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition"
        >
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

      {/* Support info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">💬</span>
        <div>
          <p className="text-sm font-semibold text-blue-900">Have a question?</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Our team will help you set up the app, configure your forms, and connect integrations.
            Drop us an email at{' '}
            <a href="mailto:support@squadkin.com" className="underline font-medium">support@squadkin.com</a>
          </p>
        </div>
      </div>

      {/* ── Sender Info ───────────────────────────────────── */}
      <Section id="s-sender" title="Sender Info" badge="Pro+" icon="📤" open={!!open.sender} onToggle={() => toggle('sender')}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sender Name">
            <Input value={cfg.senderName} onChange={v => set({ senderName: v })} placeholder="My Store" />
          </Field>
          <Field label="Sender Email">
            <Input value={cfg.senderEmail || ''} onChange={v => set({ senderEmail: v })} type="email" placeholder="noreply@yourdomain.com" />
          </Field>
        </div>
        <Field label="Add Custom Email" hint="Set up your domain email address, such as example@yourdomain.com">
          <Input value={cfg.customEmail || ''} onChange={v => set({ customEmail: v })} type="email" placeholder="support@yourdomain.com" />
        </Field>
      </Section>

      {/* ── Admin Email Notification ──────────────────────── */}
      <Section id="s-admin-email" title="Admin Email Notification" badge="Basic" icon="📨" open={!!open.adminEmail} onToggle={() => toggle('adminEmail')}>
        <Field label="Email" hint="Notification will be sent to this address on every submission.">
          <Input value={cfg.adminEmail || ''} onChange={v => set({ adminEmail: v })} type="email" placeholder="admin@yourstore.com" />
        </Field>
        <Field label="Subject" hint="Add [form_name] to include the form name in the subject.">
          <Input value={cfg.adminEmailSubject} onChange={v => set({ adminEmailSubject: v })} placeholder="[form_name] – New submission" />
        </Field>
        <Field label="Email Body">
          <p className="text-xs text-gray-500 mb-2">Click a variable to insert at cursor position:</p>
          <EmailBodyEditor value={cfg.adminEmailBody || ''} onChange={v => set({ adminEmailBody: v })} />
          <p className="text-xs text-gray-400 mt-1">
            Add <code className="font-mono bg-gray-100 px-1 rounded">[form_data]</code> to include all submission data in the email.
          </p>
        </Field>
      </Section>

      {/* ── Customer Email Notification ───────────────────── */}
      <Section id="s-customer-email" title="Customer Email Notification" badge="Basic" icon="✉️" open={!!open.customerEmail} onToggle={() => toggle('customerEmail')}>
        <Toggle checked={cfg.allowCustomerEmail} onChange={v => set({ allowCustomerEmail: v })} label="Allow customer email notifications" />
        {cfg.allowCustomerEmail && (
          <>
            <Field label="Subject" hint="Add [form_name] to include the form name in the subject.">
              <Input value={cfg.customerEmailSubject} onChange={v => set({ customerEmailSubject: v })} placeholder="Thank you for contacting us" />
            </Field>
            <Field label="Email Body">
              <p className="text-xs text-gray-500 mb-2">Click a variable to insert at cursor:</p>
              <EmailBodyEditor value={cfg.customerEmailBody || ''} onChange={v => set({ customerEmailBody: v })} />
            </Field>
          </>
        )}
      </Section>

      {/* ── Global CSS ────────────────────────────────────── */}
      <Section id="s-css" title="Global CSS" badge="Basic" icon="🎨" open={!!open.css} onToggle={() => toggle('css')}>
        <Field label="Custom CSS" hint="Applied to all embedded forms on your storefront.">
          <textarea
            value={cfg.globalCss || ''}
            onChange={e => set({ globalCss: e.target.value })}
            rows={8}
            placeholder={`.cf-form-wrapper {\n  max-width: 600px;\n  font-family: inherit;\n}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-sky-500 outline-none resize-y"
          />
        </Field>
      </Section>

      {/* ── SMTP ─────────────────────────────────────────── */}
      <Section id="s-smtp" title="SMTP Integration" badge="Basic" icon="🔌" open={!!open.smtp} onToggle={() => toggle('smtp')}>
        <Toggle checked={cfg.smtpEnabled} onChange={v => set({ smtpEnabled: v })} label="Enable SMTP" />
        {cfg.smtpEnabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Host"><Input value={cfg.smtpHost} onChange={v => set({ smtpHost: v })} placeholder="smtp.gmail.com" /></Field>
              <Field label="Port">
                <input
                  type="number"
                  value={cfg.smtpPort}
                  onChange={e => set({ smtpPort: parseInt(e.target.value) || 587 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </Field>
              <Field label="Username"><Input value={cfg.smtpUser} onChange={v => set({ smtpUser: v })} placeholder="you@gmail.com" /></Field>
              <Field label="Password"><Input type="password" value={cfg.smtpPass} onChange={v => set({ smtpPass: v })} placeholder="••••••••" /></Field>
              <Field label="From Address"><Input type="email" value={cfg.smtpFromAddress} onChange={v => set({ smtpFromAddress: v })} placeholder="no-reply@store.com" /></Field>
              <Field label="From Name"><Input value={cfg.smtpFromName} onChange={v => set({ smtpFromName: v })} placeholder="My Store" /></Field>
              <div className="col-span-2">
                <Toggle checked={cfg.smtpEncryption} onChange={v => set({ smtpEncryption: v })} label="Enable TLS/SSL Encryption" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={testSmtp}
                disabled={testingSmtp || !cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition"
              >
                {testingSmtp ? 'Testing...' : 'Test SMTP Configuration'}
              </button>
              {smtpTestResult && (
                <span className={`text-sm ${smtpTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {smtpTestResult.message}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ── Klaviyo ──────────────────────────────────────── */}
      <Section id="s-klaviyo" title="Klaviyo Integration" badge="Basic" icon="📊" open={!!open.klaviyo} onToggle={() => toggle('klaviyo')}>
        <Toggle checked={cfg.klaviyoEnabled} onChange={v => set({ klaviyoEnabled: v })} label="Enable Klaviyo" />
        {cfg.klaviyoEnabled && (
          <Field label="Klaviyo API Key" hint="Found in your Klaviyo account under Account > Settings > API Keys.">
            <Input value={cfg.klaviyoApiKey} onChange={v => set({ klaviyoApiKey: v })} placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />
          </Field>
        )}
      </Section>

      {/* ── Mailchimp ─────────────────────────────────────── */}
      <Section id="s-mailchimp" title="Mailchimp Integration" badge="Basic" icon="🐵" open={!!open.mailchimp} onToggle={() => toggle('mailchimp')}>
        <Toggle checked={cfg.mailchimpEnabled} onChange={v => set({ mailchimpEnabled: v })} label="Enable Mailchimp" />
        {cfg.mailchimpEnabled && (
          <Field label="Mailchimp API Key" hint="Found in your Mailchimp account under Profile > Extras > API Keys.">
            <Input value={cfg.mailchimpApiKey} onChange={v => set({ mailchimpApiKey: v })} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1" mono />
          </Field>
        )}
      </Section>

      {/* ── reCAPTCHA ─────────────────────────────────────── */}
      <Section id="s-recaptcha" title="reCAPTCHA" badge="Basic" icon="🛡️" open={!!open.recaptcha} onToggle={() => toggle('recaptcha')}>
        <Toggle checked={cfg.enableRecaptcha} onChange={v => set({ enableRecaptcha: v })} label="Enable reCAPTCHA" />
        {cfg.enableRecaptcha && (
          <>
            <Field label="reCAPTCHA Type">
              <div className="flex gap-3">
                {['v2', 'v3'].map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="recaptchaType" value={t} checked={cfg.recaptchaType === t}
                      onChange={() => set({ recaptchaType: t })} className="text-sky-500" />
                    V{t.slice(1)}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Site Key"><Input value={cfg.recaptchaSiteKey} onChange={v => set({ recaptchaSiteKey: v })} placeholder="6Ld..." mono /></Field>
              <Field label="Secret Key"><Input type="password" value={cfg.recaptchaSecretKey} onChange={v => set({ recaptchaSecretKey: v })} placeholder="6Ld..." mono /></Field>
            </div>
          </>
        )}
      </Section>

      {/* ── Spam Protection ───────────────────────────────── */}
      <Section id="s-spam" title="Spam Protection" badge="Pro" icon="🚫" open={!!open.spam} onToggle={() => toggle('spam')}>
        <Field label="Max submissions per IP per hour" hint="Submissions over this limit return a 429 error. Default: 10.">
          <input
            type="number"
            min={1}
            max={1000}
            value={cfg.maxSubmissionsPerIpPerHour}
            onChange={e => set({ maxSubmissionsPerIpPerHour: parseInt(e.target.value) || 10 })}
            className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
          />
        </Field>
        <Field label="Blocked Email Domains" hint="Comma-separated list. Submissions from these domains are rejected.">
          <textarea
            value={cfg.blockedEmailDomains}
            onChange={e => set({ blockedEmailDomains: e.target.value })}
            rows={3}
            placeholder="tempmail.com, mailinator.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-sky-500 outline-none resize-none"
          />
        </Field>
      </Section>

      {/* ── Twilio SMS & WhatsApp ─────────────────────────── */}
      <Section id="s-twilio" title="SMS & WhatsApp (Twilio)" badge="Pro+" icon="📱" open={!!open.twilio} onToggle={() => toggle('twilio')}>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          Send SMS or WhatsApp notifications when a form is submitted. Twilio account required.
          Twilio charges apply — see <a href="https://twilio.com/pricing" target="_blank" rel="noreferrer" className="underline">twilio.com/pricing</a>.
        </div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">SMS Settings</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Twilio Account SID"><Input value={cfg.twilioAccountSid} onChange={v => set({ twilioAccountSid: v })} placeholder="ACxxxxxxxxxxxxxxxx" mono /></Field>
          <Field label="Twilio Auth Token"><Input type="password" value={cfg.twilioAuthToken} onChange={v => set({ twilioAuthToken: v })} placeholder="••••••••" mono /></Field>
          <div className="col-span-2">
            <Field label="SMS From Number" hint="Your Twilio SMS-enabled phone number in E.164 format.">
              <Input value={cfg.twilioFromNumber} onChange={v => set({ twilioFromNumber: v })} placeholder="+15551234567" />
            </Field>
          </div>
        </div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-2">WhatsApp Settings</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="WhatsApp Account SID" hint="Can be same as SMS or different.">
            <Input value={cfg.whatsappAccountSid} onChange={v => set({ whatsappAccountSid: v })} placeholder="ACxxxxxxxxxxxxxxxx" mono />
          </Field>
          <Field label="WhatsApp From Number" hint="WhatsApp-enabled Twilio number in E.164 format.">
            <Input value={cfg.whatsappFromNumber} onChange={v => set({ whatsappFromNumber: v })} placeholder="+15551234567" />
          </Field>
        </div>
      </Section>

      {/* ── CRM Integrations ──────────────────────────────── */}
      <Section id="s-crm" title="CRM Integrations" badge="Pro+" icon="🔗" open={!!open.crm} onToggle={() => toggle('crm')}>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
          API keys are stored securely and never exposed to the browser.
        </div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">HubSpot</p>
        <Field label="HubSpot Private App Token">
          <Input type="password" value={cfg.hubspotToken} onChange={v => set({ hubspotToken: v })} placeholder="pat-na1-..." mono />
        </Field>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-2">ActiveCampaign</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ActiveCampaign Account URL">
            <Input value={cfg.activecampaignUrl} onChange={v => set({ activecampaignUrl: v })} placeholder="https://youraccountname.api-us1.com" />
          </Field>
          <Field label="ActiveCampaign API Key">
            <Input type="password" value={cfg.activecampaignApiKey} onChange={v => set({ activecampaignApiKey: v })} placeholder="Your API key" mono />
          </Field>
        </div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-2">Airtable</p>
        <Field label="Airtable Personal Access Token" hint="Create a token at airtable.com/create/tokens with data.records:write scope.">
          <Input type="password" value={cfg.airtableToken} onChange={v => set({ airtableToken: v })} placeholder="pat..." mono />
        </Field>
      </Section>

      {/* ── Stripe ────────────────────────────────────────── */}
      <Section id="s-stripe" title="Stripe" badge="Pro" icon="💳" open={!!open.stripe} onToggle={() => toggle('stripe')}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Publishable Key">
            <Input value={cfg.stripePublishableKey} onChange={v => set({ stripePublishableKey: v })} placeholder="pk_live_..." mono />
          </Field>
          <Field label="Secret Key">
            <Input type="password" value={cfg.stripeSecretKey} onChange={v => set({ stripeSecretKey: v })} placeholder="sk_live_..." mono />
          </Field>
        </div>
      </Section>

      {/* ── Slack ─────────────────────────────────────────── */}
      <Section id="s-slack" title="Slack Integration" badge="Pro" icon="💬" open={!!open.slack} onToggle={() => toggle('slack')}>
        <Toggle checked={cfg.slackEnabled} onChange={v => set({ slackEnabled: v })} label="Enable Slack notifications" />
        {cfg.slackEnabled && (
          <Field label="Slack Webhook URL" hint="Create an Incoming Webhook at api.slack.com/apps.">
            <Input value={cfg.slackWebhookUrl} onChange={v => set({ slackWebhookUrl: v })} placeholder="https://hooks.slack.com/services/..." mono />
          </Field>
        )}
      </Section>

      {/* ── IP Blocking ───────────────────────────────────── */}
      <Section id="s-ip" title="Restrict Form by IP" badge="Basic" icon="🚧" open={!!open.ip} onToggle={() => toggle('ip')}>
        <Field label="Block Form IP" hint="Comma-separated list of IP addresses to block.">
          <textarea
            value={cfg.blockedIps}
            onChange={e => set({ blockedIps: e.target.value })}
            rows={3}
            placeholder="192.168.1.100, 10.0.0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-sky-500 outline-none resize-none"
          />
        </Field>
        <Field label="Message for Blocked IP" hint="Shown when a blocked IP tries to submit. Leave blank to show no message.">
          <Input value={cfg.blockIpMessage} onChange={v => set({ blockIpMessage: v })} placeholder="Your access has been restricted." />
        </Field>
      </Section>

      {/* ── Developer API ─────────────────────────────────── */}
      <Section id="s-api" title="Developer API Integration" badge="Pro+" icon="⚙️" open={!!open.api} onToggle={() => toggle('api')}>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800">Headless API</p>
          <p>Generate a Bearer token to access form responses from external systems via the REST API.</p>
          <p>Use it as: <code className="bg-gray-200 px-1 rounded font-mono">Authorization: Bearer YOUR_TOKEN</code></p>
        </div>

        {cfg.apiToken ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-gray-900 text-green-300 px-3 py-2 rounded-lg truncate">
                {tokenVisible ? cfg.apiToken : '•'.repeat(48)}
              </code>
              <button
                type="button"
                onClick={() => setTokenVisible(v => !v)}
                className="text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >{tokenVisible ? 'Hide' : 'Reveal'}</button>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(cfg.apiToken); toast.success('Token copied!'); }}
                className="text-xs px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg"
              >Copy</button>
            </div>
            {cfg.apiTokenCreatedAt && (
              <p className="text-xs text-gray-400">Generated: {new Date(cfg.apiTokenCreatedAt).toLocaleString()}</p>
            )}
            <button
              type="button"
              onClick={generateApiToken}
              disabled={generatingToken}
              className="text-xs px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium disabled:opacity-50"
            >{generatingToken ? 'Generating…' : 'Regenerate Token (revokes current)'}</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={generateApiToken}
            disabled={generatingToken}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
          >{generatingToken ? 'Generating…' : 'Generate Bearer Token'}</button>
        )}

        <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-semibold mb-1">API Endpoints</p>
          <div className="space-y-1 font-mono">
            <p><span className="text-sky-600">GET</span> /api/forms/[id] — get form by ID</p>
            <p><span className="text-green-600">POST</span> /api/submissions — submit a form</p>
            <p><span className="text-sky-600">GET</span> /api/submissions?shop=... — list submissions</p>
          </div>
        </div>
      </Section>

      {/* Bottom Save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => save()}
          disabled={saving}
          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition"
        >
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
