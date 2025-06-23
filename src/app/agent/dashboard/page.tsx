'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  isOnline: boolean;
  currentChats: number;
  maxChats: number;
}

interface ChatSession {
  id: string;
  sessionId: string;
  status: string;
  startedAt: string;
  customerInfo?: any;
  lastMessage?: string;
}

interface Handoff {
  id: string;
  sessionId: string;
  reason: string;
  priority: string;
  createdAt: string;
  context?: any;
}

export default function AgentDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [activeChats, setActiveChats] = useState<ChatSession[]>([]);
  const [pendingHandoffs, setPendingHandoffs] = useState<Handoff[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('agentToken');
    if (!token) {
      router.push('/agent/login');
      return;
    }

    // Load agent data
    loadAgentData();
    loadActiveChats();
    loadPendingHandoffs();

    // Set up real-time updates (polling for now)
    const interval = setInterval(() => {
      loadActiveChats();
      loadPendingHandoffs();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadAgentData = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch('/api/agent/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setIsOnline(data.agent.isOnline);
      }
    } catch (error) {
      console.error('Failed to load agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveChats = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch('/api/agent/chats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActiveChats(data.chats);
      }
    } catch (error) {
      console.error('Failed to load active chats:', error);
    }
  };

  const loadPendingHandoffs = async () => {
    try {
      const response = await fetch('/api/agent/handoff');
      if (response.ok) {
        const data = await response.json();
        setPendingHandoffs(data.handoffs);
      }
    } catch (error) {
      console.error('Failed to load pending handoffs:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch('/api/agent/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isOnline: !isOnline })
      });

      if (response.ok) {
        setIsOnline(!isOnline);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const acceptHandoff = async (handoffId: string) => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`/api/agent/handoff/${handoffId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadActiveChats();
        loadPendingHandoffs();
      }
    } catch (error) {
      console.error('Failed to accept handoff:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('agentToken');
    router.push('/agent/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load agent data</p>
          <button onClick={logout} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Login Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
              <span className="ml-4 text-sm text-gray-500">Oman Airports Support</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="text-sm text-gray-600 mr-2">Status:</span>
                <button
                  onClick={toggleOnlineStatus}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isOnline 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </button>
              </div>
              
              <div className="text-sm text-gray-600">
                Welcome, {agent.name}
              </div>
              
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Agent Stats */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Agent Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{activeChats.length}</div>
                  <div className="text-sm text-gray-600">Active Chats</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{pendingHandoffs.length}</div>
                  <div className="text-sm text-gray-600">Pending Handoffs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{agent.maxChats}</div>
                  <div className="text-sm text-gray-600">Max Capacity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{agent.skills.length}</div>
                  <div className="text-sm text-gray-600">Skills</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Handoffs */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Pending Handoffs</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {pendingHandoffs.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No pending handoffs
                  </div>
                ) : (
                  pendingHandoffs.map((handoff) => (
                    <div key={handoff.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              handoff.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              handoff.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {handoff.priority}
                            </span>
                            <span className="ml-2 text-sm text-gray-600">
                              Session: {handoff.sessionId.slice(-8)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-900">{handoff.reason}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(handoff.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => acceptHandoff(handoff.id)}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Active Chats */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Active Chats</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {activeChats.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No active chats
                  </div>
                ) : (
                  activeChats.map((chat) => (
                    <div key={chat.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {chat.sessionId.slice(-8)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Started: {new Date(chat.startedAt).toLocaleTimeString()}
                          </div>
                          <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                            chat.status === 'active' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {chat.status}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/agent/chat/${chat.sessionId}`)}
                          className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 