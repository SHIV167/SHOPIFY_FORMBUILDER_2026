"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SettingsPanel from "./SettingsPanel";
import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

/* ── Types ────────────────────────────────────────────────── */
type FieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "hidden"
  | "date"
  | "number"
  | "file";

interface FormField {
  id?: string;
  label: string;
  fieldType: FieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options: string[];
  defaultValue?: string;
  width: "full" | "half";
  sortOrder: number;
}

interface ContactForm {
  id: string;
  title: string;
  description?: string;
  recipientEmail?: string;
  successMessage: string;
  submitButtonText: string;
  sendEmailNotification: boolean;
  sendConfirmationEmail: boolean;
  confirmationSubject: string;
  confirmationMessage?: string;
  replyToField?: string;
  formStyle: string;
  primaryColor: string;
  bgColor: string;
  enableHoneypot: boolean;
  isActive: boolean;
  isPublished: boolean;
  fields: FormField[];
  submissionCount?: number;
  unreadCount?: number;
  createdAt: string;
}

interface Submission {
  id: string;
  formTitle: string;
  data: Record<string, unknown>;
  status: string;
  isRead: boolean;
  ipAddress?: string;
  pageUrl?: string;
  createdAt: string;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Text", icon: "T" },
  { value: "email", label: "Email", icon: "@" },
  { value: "phone", label: "Phone", icon: "📞" },
  { value: "textarea", label: "Textarea", icon: "¶" },
  { value: "select", label: "Dropdown", icon: "▼" },
  { value: "radio", label: "Radio", icon: "◉" },
  { value: "checkbox", label: "Checkbox", icon: "☑" },
  { value: "number", label: "Number", icon: "#" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "file", label: "File", icon: "📎" },
  { value: "hidden", label: "Hidden", icon: "👁" },
];

const emptyForm = (): Omit<
  ContactForm,
  "id" | "submissionCount" | "unreadCount" | "createdAt"
> & { fields: FormField[] } => ({
  title: "",
  description: "",
  recipientEmail: "",
  successMessage: "Thank you! Your message has been sent.",
  submitButtonText: "Send Message",
  sendEmailNotification: true,
  sendConfirmationEmail: false,
  confirmationSubject: "Thank you for contacting us",
  confirmationMessage: "",
  replyToField: "",
  formStyle: "default",
  primaryColor: "#0ea5e9",
  bgColor: "#ffffff",
  enableHoneypot: true,
  isActive: true,
  isPublished: true,
  fields: [
    {
      label: "Your Name",
      fieldType: "text",
      placeholder: "Enter your name",
      required: true,
      options: [],
      width: "full",
      sortOrder: 0,
    },
    {
      label: "Email",
      fieldType: "email",
      placeholder: "Enter your email",
      required: true,
      options: [],
      width: "full",
      sortOrder: 1,
    },
    {
      label: "Message",
      fieldType: "textarea",
      placeholder: "Type your message...",
      required: true,
      options: [],
      width: "full",
      sortOrder: 2,
    },
  ],
});

/* ─────────────────────────────────────────────────────────── */

function AdminContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") || "";
  const host = searchParams.get("host") || "";

  const [tab, setTab] = useState<
    "dashboard" | "forms" | "submissions" | "settings"
  >("dashboard");
  const [forms, setForms] = useState<ContactForm[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState({
    totalForms: 0,
    totalSubmissions: 0,
    todayCount: 0,
    monthCount: 0,
  });
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form builder state
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<ContactForm | null>(null);
  const [formDraft, setFormDraft] = useState(emptyForm());

  // Submission detail
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [filterFormId, setFilterFormId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [subPage, setSubPage] = useState(1);
  const [subTotal, setSubTotal] = useState(0);

  // Helper to get absolute URL for API calls
  const getApiUrl = (path: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || (typeof window !== "undefined" ? window.location.origin : "");
    return `${baseUrl}${path}`;
  };

  // Shopify App Bridge authentication
  async function getToken() {
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    const params = new URLSearchParams(window.location.search);
    let host = params.get('host');

    if (!host) {
      try {
        host = localStorage.getItem('shopifyHost');
      } catch {
        // ignore
      }
    }

    if (!apiKey || !host) return null;

    const app = createApp({
      apiKey,
      host,
      forceRedirect: true,
    });

    return getSessionToken(app);
  }

  async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
    const token = await getToken();
    if (!token) {
      // Fall back to regular fetch if not in embedded context
      return fetch(input, init);
    }

    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  const fetchAll = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const r = await authFetch(getApiUrl(`/api/forms?shop=${encodeURIComponent(shop)}`));
      const d = await r.json();
      setForms(d.forms || []);
      setStats({
        totalForms: (d.forms || []).length,
        totalSubmissions: d.totalSubmissions || 0,
        todayCount: d.todayCount || 0,
        monthCount: d.monthCount || 0,
      });
      setSettings(d.settings || {});
    } finally {
      setLoading(false);
    }
  }, [shop]);

  const fetchSubmissions = useCallback(async () => {
    if (!shop) return;
    const params = new URLSearchParams({ shop, page: String(subPage) });
    if (filterFormId) params.set("formId", filterFormId);
    if (filterStatus) params.set("status", filterStatus);
    const r = await authFetch(getApiUrl(`/api/submissions?${params}`));
    const d = await r.json();
    setSubmissions(d.submissions || []);
    setSubTotal(d.total || 0);
  }, [shop, subPage, filterFormId, filterStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    if (tab === "submissions") fetchSubmissions();
  }, [tab, fetchSubmissions]);

  /* ── Form builder helpers ─────────────────────────────── */
  const openNew = () => {
    setEditingForm(null);
    setFormDraft(emptyForm());
    setShowFormBuilder(true);
  };
  const openEdit = (f: ContactForm) => {
    setEditingForm(f);
    setFormDraft({ ...f });
    setShowFormBuilder(true);
  };

  const addField = (type: FieldType) => {
    setFormDraft((p) => ({
      ...p,
      fields: [
        ...p.fields,
        {
          label: type.charAt(0).toUpperCase() + type.slice(1) + " Field",
          fieldType: type,
          placeholder: "",
          required: false,
          options: [],
          width: "full",
          sortOrder: p.fields.length,
        },
      ],
    }));
  };

  const removeField = (i: number) =>
    setFormDraft((p) => ({
      ...p,
      fields: p.fields.filter((_, idx) => idx !== i),
    }));

  const updateField = (i: number, patch: Partial<FormField>) =>
    setFormDraft((p) => ({
      ...p,
      fields: p.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    }));

  const moveField = (i: number, dir: -1 | 1) => {
    setFormDraft((p) => {
      const fs = [...p.fields];
      const j = i + dir;
      if (j < 0 || j >= fs.length) return p;
      [fs[i], fs[j]] = [fs[j], fs[i]];
      return { ...p, fields: fs.map((f, idx) => ({ ...f, sortOrder: idx })) };
    });
  };

  const saveForm = async () => {
    if (!formDraft.title.trim()) {
      toast.error("Form title is required");
      return;
    }
    setSaving(true);
    try {
      const method = editingForm ? "PUT" : "POST";
      const body = editingForm
        ? { ...formDraft, id: editingForm.id, shopDomain: shop }
        : { ...formDraft, shopDomain: shop };
      const r = await authFetch(getApiUrl("/api/forms"), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Save failed");
        return;
      }
      toast.success(editingForm ? "Form updated!" : "Form created!");
      setShowFormBuilder(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Delete this form and all its submissions?")) return;
    const r = await authFetch(getApiUrl("/api/forms"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, shopDomain: shop }),
    });
    if (r.ok) {
      toast.success("Form deleted");
      fetchAll();
    } else toast.error("Delete failed");
  };

  const markRead = async (ids: string[], isRead: boolean) => {
    await authFetch(getApiUrl("/api/submissions"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, shopDomain: shop, isRead }),
    });
    fetchSubmissions();
  };

  const deleteSubmissions = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} submission(s)?`)) return;
    await authFetch(getApiUrl("/api/submissions"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, shopDomain: shop }),
    });
    toast.success("Deleted");
    fetchSubmissions();
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const r = await authFetch(getApiUrl("/api/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: shop, ...settings }),
      });
      if (r.ok) toast.success("Settings saved!");
      else toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const appHost = process.env.NEXT_PUBLIC_HOST || "";

  // ── Embed code generators (formId only — no shop needed) ──────
  const embedIframe = (fid: string) =>
    `<iframe\n  src="${appHost}/embed?formId=${fid}"\n  id="cf-form-${fid}"\n  frameborder="0" scrolling="no"\n  style="width:100%;border:none;min-height:400px;"\n  title="Contact Form"\n></iframe>\n<script>\n  window.addEventListener('message',function(e){\n    if(e.data&&e.data.type==='cf_resize')\n      document.getElementById('cf-form-${fid}').style.height=e.data.height+'px';\n  });\n</script>`;

  const embedScript = (fid: string) =>
    `<!-- Place this where you want the form to appear -->\n<div id="cf-form-${fid}"></div>\n<script src="${appHost}/api/widget/${fid}.js"></script>`;

  const embedLiquid = (fid: string) =>
    `{%- assign cf_app_host = '${appHost}' -%}\n{%- assign cf_form_id   = '${fid}' -%}\n<div id="cf-form-{{ cf_form_id }}"></div>\n<script src="{{ cf_app_host }}/api/widget/{{ cf_form_id }}.js"></script>`;

  const embedUrl = (fid: string) => `${appHost}/embed?formId=${fid}`;

  if (!shop)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">
          Missing shop parameter.{" "}
          <a href="/install" className="text-sky-600 underline">
            Install the app
          </a>
          .
        </p>
      </div>
    );

  /* ── Form Builder Modal ──────────────────────────────────── */
  if (showFormBuilder)
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFormBuilder(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              {editingForm ? "Edit Form" : "Create Form"}
            </h1>
          </div>
          <button
            onClick={saveForm}
            disabled={saving}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium rounded-lg transition text-sm"
          >
            {saving ? "Saving…" : "Save Form"}
          </button>
        </div>

        <div className="max-w-6xl mx-auto p-6 grid grid-cols-3 gap-6">
          {/* Left: Fields palette */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Add Fields
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    onClick={() => addField(ft.value)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-sky-50 hover:text-sky-700 border border-gray-200 hover:border-sky-300 rounded-lg transition"
                  >
                    <span className="text-sm">{ft.icon}</span> {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Form Settings
              </h3>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Form Title *
                </label>
                <input
                  value={formDraft.title}
                  onChange={(e) =>
                    setFormDraft((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="Contact Us"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Description
                </label>
                <textarea
                  value={formDraft.description || ""}
                  onChange={(e) =>
                    setFormDraft((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={formDraft.recipientEmail || ""}
                  onChange={(e) =>
                    setFormDraft((p) => ({
                      ...p,
                      recipientEmail: e.target.value,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="admin@yourstore.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Success Message
                </label>
                <textarea
                  value={formDraft.successMessage}
                  onChange={(e) =>
                    setFormDraft((p) => ({
                      ...p,
                      successMessage: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Submit Button Text
                </label>
                <input
                  value={formDraft.submitButtonText}
                  onChange={(e) =>
                    setFormDraft((p) => ({
                      ...p,
                      submitButtonText: e.target.value,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Primary Color
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={formDraft.primaryColor}
                    onChange={(e) =>
                      setFormDraft((p) => ({
                        ...p,
                        primaryColor: e.target.value,
                      }))
                    }
                    className="w-10 h-8 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    value={formDraft.primaryColor}
                    onChange={(e) =>
                      setFormDraft((p) => ({
                        ...p,
                        primaryColor: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                {(
                  [
                    ["sendEmailNotification", "Email Notifications"],
                    ["sendConfirmationEmail", "Confirmation Email"],
                    ["enableHoneypot", "Anti-Spam Honeypot"],
                    ["isPublished", "Published"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!(formDraft as any)[key]}
                      onChange={(e) =>
                        setFormDraft((p) => ({ ...p, [key]: e.target.checked }))
                      }
                      className="rounded text-sky-500"
                    />
                    <span className="text-xs text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Field list */}
          <div className="col-span-2 space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Form Fields ({formDraft.fields.length})
              </h3>
              {formDraft.fields.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Click a field type on the left to add your first field.
                </div>
              ) : (
                <div className="space-y-3">
                  {formDraft.fields.map((field, i) => (
                    <div
                      key={i}
                      className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-600 uppercase bg-sky-50 px-2 py-0.5 rounded">
                            {field.fieldType}
                          </span>
                          <span className="text-sm font-medium text-gray-800">
                            {field.label}
                          </span>
                          {field.required && (
                            <span className="text-red-500 text-xs">
                              *required
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveField(i, -1)}
                            className="p-1 text-gray-400 hover:text-gray-700"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveField(i, 1)}
                            className="p-1 text-gray-400 hover:text-gray-700"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => removeField(i)}
                            className="p-1 text-red-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">Label</label>
                          <input
                            value={field.label}
                            onChange={(e) =>
                              updateField(i, { label: e.target.value })
                            }
                            className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-sky-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">
                            Placeholder
                          </label>
                          <input
                            value={field.placeholder || ""}
                            onChange={(e) =>
                              updateField(i, { placeholder: e.target.value })
                            }
                            className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-sky-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Width</label>
                          <select
                            value={field.width}
                            onChange={(e) =>
                              updateField(i, { width: e.target.value as any })
                            }
                            className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-sky-400 outline-none"
                          >
                            <option value="full">Full Width</option>
                            <option value="half">Half Width</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                updateField(i, { required: e.target.checked })
                              }
                              className="rounded text-sky-500"
                            />
                            <span className="text-xs text-gray-700">
                              Required
                            </span>
                          </label>
                        </div>
                        {["select", "radio", "checkbox"].includes(
                          field.fieldType,
                        ) && (
                          <div className="col-span-2">
                            <label className="text-xs text-gray-500">
                              Options (comma-separated)
                            </label>
                            <input
                              value={field.options.join(",")}
                              onChange={(e) =>
                                updateField(i, {
                                  options: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-sky-400 outline-none"
                              placeholder="Option 1,Option 2,Option 3"
                            />
                          </div>
                        )}
                        {field.helpText !== undefined && (
                          <div className="col-span-2">
                            <label className="text-xs text-gray-500">
                              Help Text
                            </label>
                            <input
                              value={field.helpText || ""}
                              onChange={(e) =>
                                updateField(i, { helpText: e.target.value })
                              }
                              className="w-full mt-0.5 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-sky-400 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  /* ── Main Admin UI ─────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              CF
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">SK Forms</div>
              <div className="text-xs text-gray-400 truncate max-w-[120px]">
                {shop}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {(
            [
              ["dashboard", "📊", "Dashboard"],
              ["forms", "📋", "Forms"],
              ["submissions", "📬", "Submissions"],
              ["settings", "⚙️", "Settings"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="cf-spinner" />
          </div>
        ) : (
          <>
            {/* ── Dashboard ── */}
            {tab === "dashboard" && (
              <div className="p-6 space-y-6">
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    {
                      label: "Total Forms",
                      value: stats.totalForms,
                      color: "sky",
                      icon: "📋",
                    },
                    {
                      label: "Total Submissions",
                      value: stats.totalSubmissions,
                      color: "green",
                      icon: "📬",
                    },
                    {
                      label: "Submitted Today",
                      value: stats.todayCount,
                      color: "orange",
                      icon: "📅",
                    },
                    {
                      label: "This Month",
                      value: stats.monthCount,
                      color: "purple",
                      icon: "📈",
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-xl border border-gray-200 p-5"
                    >
                      <div className="text-2xl mb-1">{card.icon}</div>
                      <div className="text-3xl font-bold text-gray-900">
                        {card.value}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {card.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick start */}
                {forms.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                    <div className="text-4xl mb-3">📋</div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">
                      Create your first form
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">
                      Build custom contact forms and embed them on your
                      storefront.
                    </p>
                    <button
                      onClick={() => {
                        setTab("forms");
                        openNew();
                      }}
                      className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition text-sm"
                    >
                      Create Form
                    </button>
                  </div>
                )}

                {/* Forms summary */}
                {forms.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-800">
                        Your Forms
                      </h2>
                      <button
                        onClick={() => {
                          setTab("forms");
                          openNew();
                        }}
                        className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                      >
                        + Create
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">
                            Form
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">
                            Submissions
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">
                            Unread
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {forms.map((f) => (
                          <tr key={f.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {f.title}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {f.submissionCount || 0}
                            </td>
                            <td className="px-4 py-3">
                              {f.unreadCount ? (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {f.unreadCount}
                                </span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                              >
                                {f.isPublished ? "Published" : "Draft"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Forms ── */}
            {tab === "forms" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-gray-900">
                    Forms ({forms.length})
                  </h1>
                  <button
                    onClick={openNew}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition text-sm"
                  >
                    + Create Form
                  </button>
                </div>

                {forms.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-gray-500">
                      No forms yet. Create your first form!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {forms.map((f) => (
                      <div
                        key={f.id}
                        className="bg-white rounded-xl border border-gray-200 p-5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">
                                {f.title}
                              </h3>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${f.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                              >
                                {f.isPublished ? "Published" : "Draft"}
                              </span>
                              {(f.unreadCount || 0) > 0 && (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                                  {f.unreadCount} new
                                </span>
                              )}
                            </div>
                            {f.description && (
                              <p className="text-sm text-gray-500 mb-2">
                                {f.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>📋 {f.fields.length} fields</span>
                              <span>
                                📬 {f.submissionCount || 0} submissions
                              </span>
                              {f.recipientEmail && (
                                <span>📧 {f.recipientEmail}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => {
                                setFilterFormId(f.id);
                                setTab("submissions");
                              }}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                            >
                              Submissions
                            </button>
                            <button
                              onClick={() => openEdit(f)}
                              className="text-xs px-3 py-1.5 bg-sky-50 hover:bg-sky-100 rounded-lg text-sky-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteForm(f.id)}
                              className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {/* ── Form ID + Embed Options ── */}
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          {/* Form ID badge */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Form ID:
                            </span>
                            <code className="text-xs bg-sky-50 text-sky-800 font-mono px-2 py-1 rounded border border-sky-200 flex-1 truncate">
                              {f.id}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(f.id);
                                toast.success("Form ID copied!");
                              }}
                              className="text-xs text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap"
                            >
                              📋 Copy ID
                            </button>
                          </div>
                          {/* 3 embed options */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* Script tag */}
                            <div className="bg-gray-800 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-emerald-400 font-semibold">
                                  ⚡ Inline Script
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      embedScript(f.id),
                                    );
                                    toast.success("Script tag copied!");
                                  }}
                                  className="text-xs text-gray-300 hover:text-white"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all overflow-hidden line-clamp-3 font-mono leading-relaxed">
                                {embedScript(f.id)}
                              </pre>
                            </div>
                            {/* iframe */}
                            <div className="bg-gray-800 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-blue-400 font-semibold">
                                  🖼 iframe Embed
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      embedIframe(f.id),
                                    );
                                    toast.success("iframe code copied!");
                                  }}
                                  className="text-xs text-gray-300 hover:text-white"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all overflow-hidden line-clamp-3 font-mono leading-relaxed">
                                {embedIframe(f.id).slice(0, 180) + "…"}
                              </pre>
                            </div>
                            {/* Liquid */}
                            <div className="bg-gray-800 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-purple-400 font-semibold">
                                  💧 Liquid Snippet
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      embedLiquid(f.id),
                                    );
                                    toast.success("Liquid snippet copied!");
                                  }}
                                  className="text-xs text-gray-300 hover:text-white"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all overflow-hidden line-clamp-3 font-mono leading-relaxed">
                                {embedLiquid(f.id)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Submissions ── */}
            {tab === "submissions" && (
              <div className="p-6 space-y-4">
                <h1 className="text-xl font-bold text-gray-900">Submissions</h1>
                <div className="flex items-center gap-3">
                  <select
                    value={filterFormId}
                    onChange={(e) => {
                      setFilterFormId(e.target.value);
                      setSubPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                  >
                    <option value="">All Forms</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setSubPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                  >
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="archived">Archived</option>
                    <option value="spam">Spam</option>
                  </select>
                  <button
                    onClick={fetchSubmissions}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
                  >
                    Refresh
                  </button>
                </div>

                {selectedSubmission ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <button
                          onClick={() => setSelectedSubmission(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          ← Back
                        </button>
                        <h2 className="text-lg font-semibold text-gray-900 mt-1">
                          {selectedSubmission.formTitle}
                        </h2>
                        <p className="text-xs text-gray-400">
                          {new Date(
                            selectedSubmission.createdAt,
                          ).toLocaleString()}{" "}
                          | IP: {selectedSubmission.ipAddress || "unknown"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            markRead(
                              [selectedSubmission.id],
                              !selectedSubmission.isRead,
                            )
                          }
                          className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                        >
                          {selectedSubmission.isRead
                            ? "Mark Unread"
                            : "Mark Read"}
                        </button>
                        <button
                          onClick={() => {
                            deleteSubmissions([selectedSubmission.id]);
                            setSelectedSubmission(null);
                          }}
                          className="text-sm px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left px-3 py-2 bg-gray-50 border border-gray-200 text-gray-600 font-medium">
                            Field
                          </th>
                          <th className="text-left px-3 py-2 bg-gray-50 border border-gray-200 text-gray-600 font-medium">
                            Response
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(
                          selectedSubmission.data as Record<string, unknown>,
                        ).map(([k, v]) => (
                          <tr key={k}>
                            <td className="px-3 py-2 border border-gray-200 font-medium text-gray-700">
                              {k}
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-gray-800">
                              {String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
                      Total: {subTotal}
                    </div>
                    {submissions.length === 0 ? (
                      <div className="p-10 text-center text-gray-400">
                        No submissions found.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-600 font-medium">
                              Form
                            </th>
                            <th className="px-4 py-2 text-left text-gray-600 font-medium">
                              Preview
                            </th>
                            <th className="px-4 py-2 text-left text-gray-600 font-medium">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left text-gray-600 font-medium">
                              Date
                            </th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {submissions.map((s) => (
                            <tr
                              key={s.id}
                              className={`hover:bg-gray-50 ${!s.isRead ? "bg-sky-50/30" : ""}`}
                            >
                              <td className="px-4 py-3 text-gray-700">
                                {s.formTitle}
                              </td>
                              <td className="px-4 py-3 text-gray-500 max-w-xs truncate text-xs">
                                {Object.entries(
                                  s.data as Record<string, unknown>,
                                )
                                  .slice(0, 2)
                                  .map(([k, v]) => `${k}: ${String(v)}`)
                                  .join(" | ")}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    s.status === "new"
                                      ? "bg-blue-100 text-blue-700"
                                      : s.status === "read"
                                        ? "bg-gray-100 text-gray-600"
                                        : s.status === "replied"
                                          ? "bg-green-100 text-green-700"
                                          : s.status === "spam"
                                            ? "bg-red-100 text-red-600"
                                            : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">
                                {new Date(s.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedSubmission(s);
                                    markRead([s.id], true);
                                  }}
                                  className="text-xs text-sky-600 hover:text-sky-700"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Pagination */}
                    {subTotal > 20 && (
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <button
                          onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                          disabled={subPage === 1}
                          className="text-sm px-3 py-1 bg-gray-100 rounded disabled:opacity-40"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-gray-500">
                          Page {subPage}
                        </span>
                        <button
                          onClick={() => setSubPage((p) => p + 1)}
                          disabled={subPage * 20 >= subTotal}
                          className="text-sm px-3 py-1 bg-gray-100 rounded disabled:opacity-40"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Settings ── */}
            {tab === "settings" && <SettingsPanel shop={shop} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="cf-spinner" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
