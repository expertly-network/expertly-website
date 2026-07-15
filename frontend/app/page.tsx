'use client';

import { useEffect, useState } from 'react';

type HelloResponse = {
  message: string;
  timestamp: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function Home() {
  const [data, setData] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/hello`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <span className="rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-green-800">
        Frontend is running
      </span>

      <h1 className="text-2xl font-semibold">Frontend ↔ Backend Connectivity Test</h1>

      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Calling <code className="rounded bg-slate-100 px-1">{API_URL}/hello</code>
        </p>

        {error && (
          <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
            Failed to reach backend: {error}
          </p>
        )}

        {!error && !data && (
          <p className="mt-3 text-sm text-slate-500">Loading response from backend…</p>
        )}

        {data && (
          <div className="mt-3 space-y-1">
            <p className="text-lg font-medium text-slate-900">{data.message}</p>
            <p className="text-xs text-slate-400">Received at {data.timestamp}</p>
          </div>
        )}
      </div>
    </main>
  );
}
