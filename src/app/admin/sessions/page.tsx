"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
// Simple classnames utility
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Session {
  sessionId: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  needsHuman: boolean;
  messageCount: number;
  sessionCount?: number; // Number of sessions from this IP in last 24h
  totalSessions?: number; // Total sessions from this IP (all time)
  isBlocked?: boolean; // Whether this IP is blocked
  isBot?: boolean; // Whether this IP is flagged as bot
}

interface Message {
  id: string;
  message: string;
  response: string;
  createdAt: string;
  queryType?: string;
  isSuccessful: boolean;
}

const AdminNav = dynamic(() => import('../dashboard/AdminNav'), { ssr: false });

export default function AdminSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [jumpPage, setJumpPage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockLoading, setBlockLoading] = useState<string | null>(null); // IP address being blocked

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

  // Fetch sessions
  const fetchSessions = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search })
      });
      const response = await fetch(`/api/admin/sessions?${params}`);
      const data = await response.json();
      
      // Check if response has sessions array (success) or error
      if (data.sessions !== undefined) {
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
        // Clear error if we got data
        if (data.error) {
          console.warn('API returned data with error:', data.error);
        }
      } else if (data.error) {
        setError(data.error || 'Failed to load sessions');
        setSessions([]);
        setTotal(0);
      } else {
        // Fallback: treat as success if sessions array exists
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated, page, pageSize, search]);

  // Filter sessions by search
  const filteredSessions = sessions.filter((s) =>
    s.sessionId.toLowerCase().includes(search.toLowerCase()) ||
    (s.ipAddress || "").toLowerCase().includes(search.toLowerCase())
  );

  // Fetch messages for a session
  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    setMessages([]);
    setMessagesLoading(true);
    setMessagesError(null);
    setDrawerOpen(true);
    fetch(`/api/admin/sessions?id=${session.sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.session.messages);
        setMessagesLoading(false);
      })
      .catch(() => {
        setMessagesError("Failed to load messages");
        setMessagesLoading(false);
      });
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Export Q&A to CSV
  const exportToCSV = () => {
    if (!messages.length) return;
    const header = ["Time", "Question", "Answer", "Type", "Success"];
    const rows = messages.map((m) => [
      new Date(m.createdAt).toLocaleString(),
      m.message.replace(/\n/g, " "),
      m.response.replace(/\n/g, " "),
      m.queryType || "-",
      m.isSuccessful ? "Yes" : "No",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${selectedSession?.sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagination helpers
  const totalPages = Math.ceil(total / pageSize);
  const handleJump = () => {
    const n = parseInt(jumpPage, 10);
    if (n >= 1 && n <= totalPages) setPage(n);
  };

  // Selection helpers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map(s => s.sessionId));
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedIds(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const isAllSelected = selectedIds.length > 0 && selectedIds.length === filteredSessions.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < filteredSessions.length;

  // Delete functions
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this chat session and all its messages?\n\nThis action cannot be undone.')) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: [sessionId] })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh sessions list
        const sessionsResponse = await fetch(`/api/admin/sessions?page=${page}&pageSize=${pageSize}`);
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.sessions);
        setTotal(sessionsData.total);
        setSelectedIds(prev => prev.filter(id => id !== sessionId));
      } else {
        setDeleteError(data.error || 'Failed to delete session');
      }
    } catch (error) {
      setDeleteError('Network error while deleting session');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} selected chat sessions and all their messages?\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: selectedIds })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh sessions list
        const sessionsResponse = await fetch(`/api/admin/sessions?page=${page}&pageSize=${pageSize}`);
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.sessions || []);
        setTotal(sessionsData.total || 0);
        setSelectedIds([]);
      } else {
        setDeleteError(data.error || 'Failed to delete sessions');
      }
    } catch (error) {
      setDeleteError('Network error while deleting sessions');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Block IP address
  const handleBlockIP = async (ipAddress: string, sessionCount: number) => {
    if (!ipAddress) return;
    
    if (!confirm(`Block IP address ${ipAddress}?\n\nThis IP has ${sessionCount} sessions in the last 24 hours.\n\nAll future requests from this IP will be blocked.`)) {
      return;
    }

    setBlockLoading(ipAddress);
    setDeleteError(null);

    try {
      const response = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress,
          reason: `Bot activity detected - ${sessionCount} sessions in 24h`,
          sessionCount
        })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh sessions list
        fetchSessions();
        alert(`IP address ${ipAddress} has been blocked successfully.`);
      } else {
        setDeleteError(data.error || 'Failed to block IP address');
      }
    } catch (error) {
      setDeleteError('Network error while blocking IP address');
    } finally {
      setBlockLoading(null);
    }
  };

  // Unblock IP address
  const handleUnblockIP = async (ipAddress: string) => {
    if (!ipAddress) return;
    
    if (!confirm(`Unblock IP address ${ipAddress}?`)) {
      return;
    }

    setBlockLoading(ipAddress);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/blocked-ips?ipAddress=${encodeURIComponent(ipAddress)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh sessions list
        fetchSessions();
        alert(`IP address ${ipAddress} has been unblocked.`);
      } else {
        setDeleteError(data.error || 'Failed to unblock IP address');
      }
    } catch (error) {
      setDeleteError('Network error while unblocking IP address');
    } finally {
      setBlockLoading(null);
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
      <AdminNav activeTab="sessions" />
      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Chat Sessions Log</h1>
        
        {/* Delete Error Display */}
        {deleteError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {deleteError}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by Session ID or IP..."
            className="border rounded px-3 py-2 w-full md:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sessions"
          />
          <div className="flex items-center gap-4">
            {/* Bulk Delete Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-sm"
              >
                {deleteLoading ? 'Deleting...' : `Delete ${selectedIds.length} Selected`}
              </button>
            )}
            <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm">Rows per page:</label>
            <select
              id="pageSize"
              className="border rounded px-2 py-1"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            </div>
          </div>
        </div>
        {loading ? (
          <div>Loading sessions...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full border text-sm bg-white">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="p-2 border">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={input => {
                        if (input) input.indeterminate = isSomeSelected;
                      }}
                      onChange={handleSelectAll}
                      className="rounded"
                      aria-label="Select all sessions"
                    />
                  </th>
                  <th className="p-2 border">Session ID</th>
                  <th className="p-2 border">IP Address</th>
                  <th className="p-2 border">Country</th>
                  <th className="p-2 border">Sessions (24h)</th>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Created</th>
                  <th className="p-2 border">Updated</th>
                  <th className="p-2 border">Active</th>
                  <th className="p-2 border">Needs Human</th>
                  <th className="p-2 border"># Q&A</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr><td colSpan={12} className="p-4 text-center text-gray-500">No sessions found.</td></tr>
                ) : (
                  filteredSessions.map((s, i) => {
                    const isBot = s.isBot || false;
                    const isBlocked = s.isBlocked || false;
                    const sessionCount = s.sessionCount || 0;
                    const totalSessions = s.totalSessions || 0;
                    // Show warning if: 10+ in 24h, or 50+ total, or 5+ with no messages
                    const showBotWarning = sessionCount >= 10 || totalSessions >= 50 || (sessionCount >= 5 && s.messageCount === 0);
                    
                    return (
                      <tr 
                        key={s.sessionId} 
                        className={cn(
                          i % 2 === 0 ? "bg-gray-50" : "bg-white", 
                          "hover:bg-blue-50 transition",
                          isBlocked && "bg-red-50",
                          isBot && !isBlocked && "bg-yellow-50"
                        )}
                      >
                        <td className="p-2 border text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.sessionId)}
                            onChange={() => handleSelectSession(s.sessionId)}
                            className="rounded"
                            aria-label={`Select session ${s.sessionId}`}
                          />
                        </td>
                        <td className="p-2 border font-mono text-xs max-w-xs break-all">{s.sessionId}</td>
                        <td className="p-2 border font-mono text-sm" title={s.ipAddress || "Unknown"}>
                          {s.ipAddress || <span className="text-gray-400">Unknown</span>}
                        </td>
                        <td className="p-2 border">{s.country || <span className="text-gray-400">Unknown</span>}</td>
                        <td className="p-2 border text-center">
                          {sessionCount > 0 || totalSessions > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "px-2 py-1 rounded text-xs font-semibold",
                                showBotWarning ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                              )}>
                                {sessionCount} (24h)
                              </span>
                              {totalSessions > sessionCount && (
                                <span className="text-xs text-gray-500">
                                  {totalSessions} total
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-2 border text-center">
                          {isBlocked ? (
                            <span className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-semibold">🚫 Blocked</span>
                          ) : isBot ? (
                            <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-semibold">🤖 Bot</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-2 border">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="p-2 border">{new Date(s.updatedAt).toLocaleString()}</td>
                        <td className="p-2 border text-center">{s.isActive ? "✅" : "❌"}</td>
                        <td className="p-2 border text-center">{s.needsHuman ? "🧑‍💼" : ""}</td>
                        <td className="p-2 border text-center">{s.messageCount}</td>
                        <td className="p-2 border text-center">
                          <div className="flex flex-col gap-1 items-center">
                            <button
                              className="text-blue-600 underline hover:text-blue-900 text-xs"
                              onClick={() => handleViewSession(s)}
                              aria-label={`View session ${s.sessionId}`}
                            >
                              View
                            </button>
                            {s.ipAddress && (
                              <>
                                {isBlocked ? (
                                  <button
                                    onClick={() => handleUnblockIP(s.ipAddress!)}
                                    disabled={blockLoading === s.ipAddress}
                                    className="text-green-600 underline hover:text-green-900 disabled:opacity-50 text-xs"
                                    aria-label={`Unblock IP ${s.ipAddress}`}
                                  >
                                    {blockLoading === s.ipAddress ? 'Unblocking...' : 'Unblock'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBlockIP(s.ipAddress!, sessionCount)}
                                    disabled={blockLoading === s.ipAddress}
                                    className="text-red-600 underline hover:text-red-900 disabled:opacity-50 text-xs"
                                    aria-label={`Block IP ${s.ipAddress}`}
                                  >
                                    {blockLoading === s.ipAddress ? 'Blocking...' : 'Block IP'}
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteSession(s.sessionId)}
                              disabled={deleteLoading}
                              className="text-red-600 underline hover:text-red-900 disabled:opacity-50 text-xs"
                              aria-label={`Delete session ${s.sessionId}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Selection Status */}
        {selectedIds.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            {selectedIds.length} session(s) selected
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages} ({total} sessions)
          </span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={e => setJumpPage(e.target.value)}
            className="w-16 border rounded px-2 py-1"
            placeholder="Go to"
            aria-label="Jump to page"
          />
          <button
            className="px-2 py-1 border rounded"
            onClick={handleJump}
            disabled={!jumpPage || isNaN(Number(jumpPage)) || Number(jumpPage) < 1 || Number(jumpPage) > totalPages}
          >
            Go
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
        {/* Side Drawer for Q&A pairs */}
        {drawerOpen && selectedSession && (
          <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close drawer"
              tabIndex={0}
            />
            {/* Drawer */}
            <div className="relative bg-white w-full max-w-2xl h-full shadow-xl overflow-y-auto p-6 ml-auto animate-slide-in-right">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-black"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
              {/* Session summary */}
              <div className="mb-4 p-4 rounded bg-gray-50 border">
                <div className="font-bold text-lg mb-1">Session: <span className="font-mono text-xs">{selectedSession.sessionId}</span></div>
                <div className="text-sm text-gray-600 mb-1">Started: {new Date(selectedSession.createdAt).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mb-1">Updated: {new Date(selectedSession.updatedAt).toLocaleString()}</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>IP: <span className="font-mono">{selectedSession.ipAddress || "Unknown"}</span></span>
                  <span>Country: <span className="font-mono">{selectedSession.country || "Unknown"}</span></span>
                  <span>Active: {selectedSession.isActive ? "✅" : "❌"}</span>
                  <span>Needs Human: {selectedSession.needsHuman ? "🧑‍💼" : "No"}</span>
                  <span># Q&A: {selectedSession.messageCount}</span>
                </div>
                <button
                  className="mt-2 px-3 py-1 border rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs"
                  onClick={exportToCSV}
                  aria-label="Export Q&A to CSV"
                >
                  Export Q&A to CSV
                </button>
              </div>
              {/* Q&A list */}
              <div className="mb-2 font-semibold text-base">Q&A Pairs</div>
              {messagesLoading ? (
                <div>Loading Q&A pairs...</div>
              ) : messagesError ? (
                <div className="text-red-500">{messagesError}</div>
              ) : (
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-gray-500">No Q&A pairs in this session.</div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={m.id} className="border rounded p-3 bg-gray-50 relative group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</span>
                          <span className="text-xs text-gray-500">Type: {m.queryType || "-"} | Success: {m.isSuccessful ? "✅" : "❌"}</span>
                        </div>
                        <div className="mb-1">
                          <span className="font-semibold">Question:</span>
                          <span className="ml-2">{m.message}</span>
                          <button
                            className="ml-2 text-xs text-blue-600 underline opacity-0 group-hover:opacity-100"
                            onClick={() => copyToClipboard(m.message)}
                            aria-label="Copy question"
                          >Copy</button>
                        </div>
                        <div>
                          <span className="font-semibold">Answer:</span>
                          <span className="ml-2">{m.response}</span>
                          <button
                            className="ml-2 text-xs text-blue-600 underline opacity-0 group-hover:opacity-100"
                            onClick={() => copyToClipboard(m.response)}
                            aria-label="Copy answer"
                          >Copy</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 