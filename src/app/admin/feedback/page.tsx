"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AdminNav = dynamic(() => import('../dashboard/AdminNav'), { ssr: false });

interface FeedbackItem {
  id: string;
  sessionId: string;
  rating?: number | null;
  feedback?: string | null;
  createdAt: string;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, any[]>>({});
  const [busy, setBusy] = useState(false);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth');
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
          setIsAuthenticated(true);
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setDetails(d.details || {}); setLoading(false); })
      .catch(() => { setError('Failed to load feedback'); setLoading(false); });
  }, [isAuthenticated]);

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav activeTab="thumbs" />
      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Thumbs-down Responses</h1>
        <p className="mb-4 text-sm text-gray-600">Review low-quality answers. Use the Knowledge Base tab to add or update entries as needed.</p>
        {loading ? <div>Loading…</div> : error ? <div className="text-red-600">{error}</div> : (
          <div className="overflow-x-auto bg-white shadow rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Time</th>
                  <th className="p-2 border">Session</th>
                  <th className="p-2 border">Feedback</th>
                  <th className="p-2 border">Preview (last 5 Q&A)</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-500">No thumbs-down feedback yet.</td></tr>
                ) : items.map((it) => (
                  <tr key={it.id} className="hover:bg-blue-50">
                    <td className="p-2 border">{new Date(it.createdAt).toLocaleString()}</td>
                    <td className="p-2 border font-mono">{it.sessionId}</td>
                    <td className="p-2 border">{it.feedback}</td>
                    <td className="p-2 border">
                      <div className="space-y-2">
                        {(details[it.sessionId] || []).map((m) => (
                          <div key={m.id} className="border rounded p-2 bg-gray-50">
                            <div className="text-xs text-gray-500 mb-1">{new Date(m.createdAt).toLocaleString()} | {m.queryType || '-'} | {m.isSuccessful ? '✅' : '❌'}</div>
                            <div><strong>Q:</strong> {m.message}</div>
                            <div><strong>A:</strong> {m.response}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 border text-center">
                      <div className="flex flex-col gap-2">
                        <button
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                          disabled={busy}
                          onClick={async()=>{
                            const msgs = details[it.sessionId] || [];
                            if (!msgs.length) return;
                            const last = msgs[msgs.length-1];
                            setBusy(true);
                            try {
                              await fetch('/api/admin/knowledge', {
                                method: 'POST',
                                headers: { 'Content-Type':'application/json' },
                                body: JSON.stringify({
                                  category: 'unreviewed',
                                  question: last.message,
                                  answer: last.response,
                                  keywords: [],
                                  priority: 1,
                                  dataSource: 'manual'
                                })
                              });
                              alert('Added to KB (category: unreviewed). Please review and categorize.');
                            } finally { setBusy(false); }
                          }}
                        >Add to KB</button>
                        <button
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                          disabled={busy}
                          onClick={async()=>{
                            setBusy(true);
                            try {
                              await fetch('/api/admin/feedback', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: it.id }) });
                              setItems(prev=>prev.filter(x=>x.id!==it.id));
                            } finally { setBusy(false); }
                          }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


