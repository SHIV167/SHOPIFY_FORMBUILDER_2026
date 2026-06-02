'use client';

import { useState, useMemo } from 'react';

export default function InstallPage() {
  const initialShop = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('shop') || '';
  }, []);

  const [shop, setShop] = useState(initialShop);
  const error = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('error') || '';
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-lg">CF</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SK Contact Form Builder</h1>
            <p className="text-sm text-gray-500">Install on your Shopify store</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Installation error: {error}. Please try again.
          </div>
        )}

        <form method="GET" action="/api/shopify/auth" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Domain</label>
            <input
              name="shop"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg transition"
          >
            Install App (OAuth)
          </button>
        </form>

        {/* Direct access without OAuth */}
        <div className="mt-4">
          <button
            onClick={() => {
              if (shop) {
                window.location.href = `/admin?shop=${encodeURIComponent(shop)}`;
              }
            }}
            disabled={!shop}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
          >
            Open Admin (No OAuth)
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Skip OAuth and go directly to the admin panel
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Features</h3>
          <ul className="space-y-2">
            {[
              'Drag & drop form builder',
              'Email notifications on new submissions',
              'Submission management & export',
              'Anti-spam honeypot protection',
              'Customizable styles & colors',
              'Embed anywhere on your storefront',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-sky-500">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
