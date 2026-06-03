"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface FormField {
  id: string;
  label: string;
  fieldType: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options: string[];
  defaultValue?: string;
  width: string;
  sortOrder: number;
}

interface ContactForm {
  id: string;
  title: string;
  description?: string;
  successMessage: string;
  submitButtonText: string;
  primaryColor: string;
  bgColor: string;
  formStyle: string;
  enableHoneypot: boolean;
  fields: FormField[];
}

function postResize() {
  if (typeof window === "undefined" || window.parent === window) return;
  const h = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  window.parent.postMessage({ type: "cf_resize", height: h }, "*");
}

function EmbedContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") || "";
  const formId = searchParams.get("formId") || "";

  const [form, setForm] = useState<
    (ContactForm & { shopDomain?: string }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!formId) {
      // If no formId provided, try to fetch the first published form for the shop
      if (shop) {
        const baseUrl = process.env.NEXT_PUBLIC_HOST || (typeof window !== "undefined" ? window.location.origin : "");
        fetch(`${baseUrl}/api/forms?shop=${encodeURIComponent(shop)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.forms && d.forms.length > 0) {
              // Use the first published form
              const firstForm = d.forms.find((f: any) => f.isPublished) || d.forms[0];
              setForm(firstForm);
              // Init default values
              const defaults: Record<string, string> = {};
              (firstForm.fields as FormField[]).forEach((f: FormField) => {
                if (f.defaultValue) defaults[f.label] = f.defaultValue;
              });
              setValues(defaults);
            }
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    // Prefer the public /api/forms/[id] endpoint which works with formId only.
    // Fall back to legacy ?shop=...&formId=... if shop is also provided.
    const baseUrl = process.env.NEXT_PUBLIC_HOST || (typeof window !== "undefined" ? window.location.origin : "");
    const url = shop
      ? `${baseUrl}/api/forms?shop=${encodeURIComponent(shop)}&formId=${encodeURIComponent(formId)}`
      : `${baseUrl}/api/forms/${encodeURIComponent(formId)}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.form) {
          setForm(d.form);
          // Init default values
          const defaults: Record<string, string> = {};
          (d.form.fields as FormField[]).forEach((f: FormField) => {
            if (f.defaultValue) defaults[f.label] = f.defaultValue;
          });
          setValues(defaults);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shop, formId]);

  // Resize on every change
  useEffect(() => {
    postResize();
    setTimeout(postResize, 200);
  }, [form, submitting, submitted, errors]);

  const validate = (): boolean => {
    if (!form) return false;
    const errs: Record<string, string> = {};
    form.fields.forEach((f) => {
      if (f.fieldType === "hidden") return;
      const v = (values[f.label] || "").trim();
      if (f.required && !v) errs[f.label] = `${f.label} is required`;
      if (f.fieldType === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        errs[f.label] = "Please enter a valid email address";
      if (f.fieldType === "phone" && v && !/^[\d\s\+\-\(\)]{6,20}$/.test(v))
        errs[f.label] = "Please enter a valid phone number";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload: Record<string, string> = { ...values };
      if (form.enableHoneypot) payload["__hp"] = "";

      // Use absolute URL for API calls to avoid CORS issues in embed context
      const baseUrl = process.env.NEXT_PUBLIC_HOST || (typeof window !== "undefined" ? window.location.origin : "");
      const apiUrl = `${baseUrl}/api/submissions`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shop,
          formId: form.id,
          data: payload,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Submission failed. Please try again.");
        return;
      }
      setSubmitted(true);
      setValues({});
      setTimeout(postResize, 100);
    } catch (error: any) {
      console.error("Submission error:", error);
      setSubmitError(
        error.message || "Network error. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const set = (label: string, value: string) => {
    setValues((p) => ({ ...p, [label]: value }));
    if (errors[label])
      setErrors((p) => {
        const n = { ...p };
        delete n[label];
        return n;
      });
  };

  const renderField = (field: FormField) => {
    if (field.fieldType === "hidden") return null;

    const inputClass = `w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${
      errors[field.label]
        ? "border-red-400 focus:ring-red-200"
        : "border-gray-300 focus:border-sky-400 focus:ring-sky-100"
    }`;

    const el = (() => {
      switch (field.fieldType) {
        case "textarea":
          return (
            <textarea
              rows={4}
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={inputClass + " resize-y"}
            />
          );
        case "select":
          return (
            <select
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              required={field.required}
              className={inputClass}
            >
              <option value="">Select an option…</option>
              {field.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        case "radio":
          return (
            <div className="space-y-2">
              {field.options.map((o) => (
                <label
                  key={o}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name={field.label}
                    value={o}
                    checked={values[field.label] === o}
                    onChange={(e) => set(field.label, e.target.value)}
                    required={field.required}
                    className="text-sky-500"
                  />
                  {o}
                </label>
              ))}
            </div>
          );
        case "checkbox":
          if (field.options.length > 0) {
            return (
              <div className="space-y-2">
                {field.options.map((o) => (
                  <label
                    key={o}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      value={o}
                      checked={(values[field.label] || "")
                        .split(",")
                        .includes(o)}
                      onChange={(e) => {
                        const prev = (values[field.label] || "")
                          .split(",")
                          .filter(Boolean);
                        const next = e.target.checked
                          ? [...prev, o]
                          : prev.filter((x) => x !== o);
                        set(field.label, next.join(","));
                      }}
                      className="rounded text-sky-500"
                    />
                    {o}
                  </label>
                ))}
              </div>
            );
          }
          return (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={values[field.label] === "true"}
                onChange={(e) =>
                  set(field.label, e.target.checked ? "true" : "")
                }
                required={field.required}
                className="rounded text-sky-500"
              />
              {field.placeholder || field.label}
            </label>
          );
        case "date":
          return (
            <input
              type="date"
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              required={field.required}
              className={inputClass}
            />
          );
        case "number":
          return (
            <input
              type="number"
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={inputClass}
            />
          );
        case "file":
          return (
            <input
              type="file"
              onChange={(e) =>
                set(field.label, e.target.files?.[0]?.name || "")
              }
              required={field.required}
              className="text-sm text-gray-600"
            />
          );
        case "phone":
          return (
            <input
              type="tel"
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              placeholder={field.placeholder || "+91 XXXXX XXXXX"}
              required={field.required}
              className={inputClass}
            />
          );
        case "email":
          return (
            <input
              type="email"
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              placeholder={field.placeholder || "you@example.com"}
              required={field.required}
              className={inputClass}
            />
          );
        default:
          return (
            <input
              type="text"
              value={values[field.label] || ""}
              onChange={(e) => set(field.label, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={inputClass}
            />
          );
      }
    })();

    return (
      <div
        key={field.id}
        className={field.width === "half" ? "w-full" : "w-full"}
      >
        {field.fieldType !== "checkbox" && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        {el}
        {field.helpText && (
          <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
        )}
        {errors[field.label] && (
          <p className="mt-1 text-xs text-red-500">{errors[field.label]}</p>
        )}
      </div>
    );
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );

  if (!form)
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        Form not found or unavailable.
      </div>
    );

  const primaryColor = form.primaryColor || "#0ea5e9";

  if (submitted)
    return (
      <div
        className="p-6 text-center"
        style={{ backgroundColor: form.bgColor || "#fff" }}
      >
        <div className="text-4xl mb-3">✅</div>
        <p className="text-gray-800 font-medium">{form.successMessage}</p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm underline"
          style={{ color: primaryColor }}
        >
          Submit another response
        </button>
      </div>
    );

  const wrapperClass = `p-4 md:p-6 ${form.formStyle === "card" ? "rounded-xl shadow-lg border border-gray-100" : ""}`;

  return (
    <div style={{ backgroundColor: form.bgColor || "#fff", minHeight: "100%" }}>
      <div className={wrapperClass}>
        {form.title && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">{form.title}</h2>
            {form.description && (
              <p className="text-sm text-gray-500 mt-1">{form.description}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Honeypot (hidden) */}
          {form.enableHoneypot && (
            <input
              type="text"
              name="__hp"
              value=""
              onChange={() => {}}
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />
          )}

          {/* Fields — group half-width fields in rows */}
          <div className="grid grid-cols-1 gap-4">
            {form.fields.map((f) => renderField(f))}
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-5 text-sm font-semibold rounded-lg text-white transition disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? "Sending…" : form.submitButtonText}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-sky-500 rounded-full animate-spin" />
        </div>
      }
    >
      <EmbedContent />
    </Suspense>
  );
}
