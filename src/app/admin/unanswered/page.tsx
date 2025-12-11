"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const AdminNav = dynamic(() => import('../dashboard/AdminNav'), { ssr: false });

interface UnansweredItem {
  question: string;
  answer: string;
  lastAsked: string;
}

export default function UnansweredQueriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<UnansweredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

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

  const fetchData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/unanswered');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      } else {
        setError(data.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleAddToKB = async (item: UnansweredItem) => {
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Uncategorized',
          question: item.question,
          answer: item.answer,
          keywords: [],
          priority: 1,
          sourceUrl: '',
          dataSource: 'manual'
        })
      });
      const data = await res.json();
      if (data.success) {
        // mark resolved
        await fetch('/api/admin/unanswered', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: item.question })
        });
        setToast('✅ Added to Knowledge Base');
        setItems(prev => prev.filter(q => q.question !== item.question));
        setTimeout(() => setToast(''), 3000);
      } else {
        setToast('❌ Failed to add');
      }
    } catch {
      setToast('❌ Network error');
    }
  };

  const handleDeleteQuestion = async (item: UnansweredItem) => {
    if (!confirm(`Delete this question: "${item.question}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/unanswered', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: item.question })
      });
      const data = await res.json();
      if (data.success) {
        setToast('🗑️ Question deleted');
        setItems(prev => prev.filter(q => q.question !== item.question));
        setTimeout(() => setToast(''), 3000);
      } else {
        setToast('❌ Failed to delete');
      }
    } catch {
      setToast('❌ Network error');
    }
  };

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
      <AdminNav activeTab="unanswered" />

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
        <h2 className="text-xl font-semibold mb-4">Unanswered Queries</h2>

        {toast && <div className="mb-4 text-sm">{toast}</div>}

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Question</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Chatbot Answer</th>
                <th className="px-4 py-2 font-medium text-gray-700">Last Asked</th>
                <th className="px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-pre-wrap max-w-xs break-words">{item.question}</td>
                  <td className="px-4 py-2 whitespace-pre-wrap max-w-md break-words">{item.answer}</td>
                  <td className="px-4 py-2 text-center">{new Date(item.lastAsked).toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleAddToKB(item)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded"
                      >
                        Add to KB
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(item)}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center p-4">
                    All user questions are covered by the knowledge base. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  );
} 