"use client";

import { useEffect, useState, useMemo } from "react";

export default function EmbeddedApp() {
  const [shop, setShop] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);

  const authUrl = useMemo(() => {
    if (!shop) return null;
    return `/api/shopify/auth?shop=${encodeURIComponent(shop)}`;
  }, [shop]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
    const hostParam = params.get('host');

    if (hostParam) {
      setHost(hostParam);
      try {
        localStorage.setItem('shopifyHost', hostParam);
      } catch {
        // ignore
      }
    } else {
      try {
        const storedHost = localStorage.getItem('shopifyHost');
        if (storedHost) setHost(storedHost);
      } catch {
        // ignore
      }
    }

    if (shopParam) {
      setShop(shopParam);
      return;
    }

    if (hostParam) {
      try {
        const decoded = atob(hostParam);
        const hostParts = decoded.split('/');
        const maybeShop = hostParts[hostParts.length - 1];
        if (maybeShop) setShop(maybeShop);
      } catch {
        // ignore
      }
    }
  }, []);

  const adminUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (shop) p.set('shop', shop);
    if (host) p.set('host', host);
    const qs = p.toString();
    return qs ? `/admin?${qs}` : '/admin';
  }, [shop, host]);

  useEffect(() => {
    if (!authUrl) return;

    const isEmbedded = window.top !== window.self;
    if (!isEmbedded) return;

    try {
      window.top!.location.href = authUrl;
    } catch {
      window.location.href = authUrl;
    }
  }, [authUrl]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold text-gray-900">Contact Form Builder</h1>
        <p className="text-sm text-gray-600 mt-2">
          This app uses a custom Shopify OAuth + signed cookie session flow.
        </p>

        <div className="mt-4 flex gap-3">
          <a
            href={adminUrl}
            className="inline-flex items-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Open Admin
          </a>
          <a
            href={authUrl || '/install'}
            className="inline-flex items-center px-4 py-2 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            {shop ? 'Continue OAuth' : 'Install'}
          </a>
        </div>
      </div>
    </div>
  );
}
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
