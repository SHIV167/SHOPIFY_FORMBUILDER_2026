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
