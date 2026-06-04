import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">Contact Form Builder</h1>
        <p className="mt-2 text-gray-600">
          Install this app by opening <code className="rounded bg-gray-100 px-1">/install?shop=your-store.myshopify.com</code>.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
            href="/install"
          >
            Install
          </Link>
        </div>
      </div>
    </main>
  );
}
