'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemHealth {
  database: boolean;
  api: boolean;
  ai: boolean;
  scraper: boolean;
}

interface QuotaStatus {
  dailyLimit: number;
  usedCount: number;
  remainingCount: number;
  resetAt: string;
  percentageUsed: number;
  quotaTier?: string;
  model?: string;
  rpmLimit?: number;
  tpmLimit?: number;
  currentRpm?: number;
  currentTpm?: number;
  rpmPercentage?: number;
  tpmPercentage?: number;
  isNearDailyLimit?: boolean;
  isNearRpmLimit?: boolean;
  isAtDailyLimit?: boolean;
  isAtRpmLimit?: boolean;
}

interface Analytics {
  totalSessions: number;
  totalMessages: number;
  avgResponseTime: number;
  userSatisfaction: number;
  topQueries: Array<{ query: string; count: number }>;
  responseAccuracy: number;
}

interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  subcategory?: string;
  priority?: number;
  sourceUrl?: string;
  lastUpdated: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: false,
    api: false,
    ai: false,
    scraper: false
  });
  const [analytics, setAnalytics] = useState<Analytics>({
    totalSessions: 0,
    totalMessages: 0,
    avgResponseTime: 0,
    userSatisfaction: 0,
    topQueries: [],
    responseAccuracy: 0
  });
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [scrapingStatus, setScrapingStatus] = useState('idle');
  const [scrapingMessage, setScrapingMessage] = useState('');
  const [scrapingHistory, setScrapingHistory] = useState<{ title: string; url: string; lastScraped: string }[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<{ category: string; count: number }[]>([]);
  const [totalKnowledgeEntries, setTotalKnowledgeEntries] = useState(0);
  const [apiQuotas, setApiQuotas] = useState<{ [provider: string]: QuotaStatus }>({});
  const [quotaAlerts, setQuotaAlerts] = useState<string[]>([]);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSystemHealth();
      fetchAnalytics();
      fetchKnowledgeBase();
      
      // Set up real-time updates
      const interval = setInterval(() => {
        fetchSystemHealth();
        fetchAnalytics();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      if (response.ok) {
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

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/system');
      if (response.ok) {
        const data = await response.json();
        console.log('System health data:', data); // Debug log
        
        // Handle both possible response structures
        const healthData = data.system?.health || data;
        
        setSystemHealth({
          database: healthData.database === 'healthy',
          api: healthData.api === 'healthy', 
          ai: healthData.aiService === 'healthy',
          scraper: healthData.webScraper === 'healthy'
        });

        // Update API quotas if available
        if (data.system?.apiQuotas) {
          setApiQuotas(data.system.apiQuotas);
        }
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      // Set default values on error
      setSystemHealth({
        database: true,
        api: true,
        ai: false,
        scraper: true
      });
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/analytics');
      if (response.ok) {
        const data = await response.json();
        
        // Handle both possible response structures and ensure all fields exist
        const analyticsData = data.analytics || data;
        
        setAnalytics({
          totalSessions: analyticsData.totalSessions || analyticsData.totalChats || 0,
          totalMessages: analyticsData.totalMessages || analyticsData.totalChats || 0,
          avgResponseTime: analyticsData.avgResponseTime || analyticsData.averageResponseTime || 0,
          userSatisfaction: analyticsData.userSatisfaction || analyticsData.satisfactionScore || 0,
          topQueries: Array.isArray(analyticsData.topQueries) ? analyticsData.topQueries : [],
          responseAccuracy: analyticsData.responseAccuracy || 85 // Default value
        });

        // Update API quotas with enhanced information
        if (data.quotaStatus) {
          setApiQuotas(data.quotaStatus);
          // Check for quota alerts
          checkQuotaAlerts(data.quotaStatus);
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Set default values on error to prevent crashes
      setAnalytics({
        totalSessions: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        userSatisfaction: 0,
        topQueries: [],
        responseAccuracy: 0
      });
    }
  };

  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/admin/knowledge');
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBase(data.items || []);
      }
      
      // Also fetch scraping data
      await fetchScrapingHistory();
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error);
    }
  };

  const fetchScrapingHistory = async () => {
    try {
      const response = await fetch('/api/admin/scraper');
      if (response.ok) {
        const data = await response.json();
        setScrapingHistory(data.data.scrapingHistory || []);
        setKnowledgeStats(data.data.knowledgeStats || []);
        setTotalKnowledgeEntries(data.data.totalEntries || 0);
      }
    } catch (error) {
      console.error('Failed to fetch scraping history:', error);
    }
  };

  const checkQuotaAlerts = (quotaStatus: { [provider: string]: QuotaStatus }) => {
    const alerts: string[] = [];
    
    Object.entries(quotaStatus).forEach(([provider, quota]) => {
      if (!quota) return;
      
      // Daily limit alerts
      if (quota.percentageUsed >= 100) {
        alerts.push(`🚨 ${provider.toUpperCase()}: Daily limit reached! (${quota.usedCount}/${quota.dailyLimit})`);
      } else if (quota.percentageUsed >= 90) {
        alerts.push(`⚠️ ${provider.toUpperCase()}: Near daily limit (${quota.percentageUsed}% used)`);
      } else if (quota.percentageUsed >= 75) {
        alerts.push(`🟡 ${provider.toUpperCase()}: High usage warning (${quota.percentageUsed}% used)`);
      }
      
      // RPM alerts (if available)
      if (quota.rpmPercentage !== undefined) {
        if (quota.rpmPercentage >= 90) {
          alerts.push(`🚨 ${provider.toUpperCase()}: Near RPM limit (${quota.rpmPercentage}% of ${quota.rpmLimit}/min)`);
        }
      }
      
      // Low remaining requests alerts
      if (quota.remainingCount <= 50 && quota.remainingCount > 0) {
        alerts.push(`⚠️ ${provider.toUpperCase()}: Only ${quota.remainingCount} requests remaining today`);
      }
    });
    
    setQuotaAlerts(alerts);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const filteredKnowledge = knowledgeBase.filter(item =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleScrapeWebsite = async () => {
    if (!scrapeUrl.trim()) {
      setScrapingStatus('error');
      setScrapingMessage('Please enter a valid URL');
      return;
    }

    setScrapingStatus('loading');
    setScrapingMessage('');
    
    try {
      const response = await fetch('/api/admin/scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url: scrapeUrl.trim(), 
          category: scrapeCategory || undefined 
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setScrapingStatus('success');
        setScrapingMessage(data.message);
        setScrapeUrl('');
        setScrapeCategory('');
        // Refresh data
        await fetchKnowledgeBase();
        await fetchScrapingHistory();
      } else {
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Failed to scrape website:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while scraping the website.');
    }
  };

  const handleReScrapeWebsite = async (url: string) => {
    if (!confirm(`Re-scrape ${url}? This will replace existing knowledge entries from this URL.`)) {
      return;
    }

    setScrapingStatus('loading');
    setScrapingMessage('Re-scraping website...');
    
    try {
      const response = await fetch('/api/admin/scraper', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setScrapingStatus('success');
        setScrapingMessage(data.message);
        // Refresh data
        await fetchKnowledgeBase();
        await fetchScrapingHistory();
      } else {
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to re-scrape website');
      }
    } catch (error) {
      console.error('Failed to re-scrape website:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while re-scraping the website.');
    }
  };

  const handleDeleteScrapedContent = async (url: string) => {
    if (!confirm(`Delete all content scraped from ${url}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper?url=${encodeURIComponent(url)}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setScrapingStatus('success');
        setScrapingMessage(data.message);
        // Refresh data
        await fetchKnowledgeBase();
        await fetchScrapingHistory();
      } else {
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to delete scraped content');
      }
    } catch (error) {
      console.error('Failed to delete scraped content:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while deleting scraped content.');
    }
  };

  const handleDeleteKnowledgeEntry = async (id: string) => {
    if (!confirm('Delete this knowledge base entry? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      if (response.ok) {
        // Refresh knowledge base
        await fetchKnowledgeBase();
        setScrapingStatus('success');
        setScrapingMessage('Knowledge entry deleted successfully');
      } else {
        setScrapingStatus('error');
        setScrapingMessage('Failed to delete knowledge entry');
      }
    } catch (error) {
      console.error('Failed to delete knowledge entry:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while deleting the entry.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Oman Airports Admin</h1>
              <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Dashboard
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'analytics', name: 'Analytics' },
              { id: 'knowledge', name: 'Knowledge Base' },
              { id: 'agents', name: 'Agents' },
              { id: 'system', name: 'System' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quota Alerts Section */}
              {quotaAlerts.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-400 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-red-400 text-xl">🚨</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-red-800">Quota Alerts</h3>
                      <div className="mt-2 space-y-1">
                        {quotaAlerts.map((alert, index) => (
                          <p key={index} className="text-sm text-red-700 font-medium">{alert}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-bold">S</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Sessions</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics.totalSessions}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-bold">M</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Messages</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics.totalMessages}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-bold">T</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Avg Response Time</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics.avgResponseTime}ms</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-bold">A</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Accuracy</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics.responseAccuracy}%</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Quota Section */}
              {apiQuotas.gemini && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">🤖 AI API Quota Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg border ${
                        apiQuotas.gemini.percentageUsed >= 100 ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300' :
                        apiQuotas.gemini.percentageUsed >= 90 ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300' :
                        apiQuotas.gemini.percentageUsed >= 75 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
                        'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-medium text-blue-900">
                                {apiQuotas.gemini.model || 'Google Gemini API'}
                              </h4>
                              {apiQuotas.gemini.percentageUsed >= 100 && (
                                <span className="text-red-500 text-sm">🚨 LIMIT REACHED</span>
                              )}
                              {apiQuotas.gemini.percentageUsed >= 90 && apiQuotas.gemini.percentageUsed < 100 && (
                                <span className="text-orange-500 text-sm">⚠️ NEAR LIMIT</span>
                              )}
                            </div>
                            {apiQuotas.gemini.quotaTier && (
                              <p className="text-xs text-blue-700 mt-1">
                                🎯 {apiQuotas.gemini.quotaTier}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full font-bold ${
                            apiQuotas.gemini.percentageUsed >= 100 ? 'bg-red-100 text-red-800 animate-pulse' :
                            apiQuotas.gemini.percentageUsed >= 90 ? 'bg-orange-100 text-orange-800' :
                            apiQuotas.gemini.percentageUsed >= 75 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {apiQuotas.gemini.percentageUsed}% used
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Daily Limit:</span>
                            <span className="font-medium text-gray-900">
                              {apiQuotas.gemini.dailyLimit === 999999 ? 'Unlimited' : apiQuotas.gemini.dailyLimit}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Used Today:</span>
                            <span className="font-medium text-gray-900">{apiQuotas.gemini.usedCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Remaining:</span>
                            <span className={`font-bold ${
                              apiQuotas.gemini.remainingCount < 100 ? 'text-red-600' :
                              apiQuotas.gemini.remainingCount < 300 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {apiQuotas.gemini.remainingCount === 999999 ? 'Unlimited' : apiQuotas.gemini.remainingCount}
                            </span>
                          </div>
                          
                                                        {/* Real-time quota limits */}
                              {(apiQuotas.gemini.rpmLimit || apiQuotas.gemini.tpmLimit) && (
                                <>
                                  <hr className="my-2 border-blue-200" />
                                  <div className="text-xs text-blue-800 font-medium mb-1">📊 Real-time Limits</div>
                                  
                                  {/* RPM Status */}
                                  {apiQuotas.gemini.rpmLimit && (
                                    <>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-600">Requests/min:</span>
                                        <span className={`font-medium ${
                                          (apiQuotas.gemini.rpmPercentage ?? 0) >= 90 ? 'text-red-600' :
                                          (apiQuotas.gemini.rpmPercentage ?? 0) >= 75 ? 'text-orange-600' :
                                          'text-blue-900'
                                        }`}>
                                          {apiQuotas.gemini.currentRpm || 0}/{apiQuotas.gemini.rpmLimit}
                                        </span>
                                      </div>
                                      
                                      {/* RPM Progress Bar */}
                                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1 mb-2">
                                        <div 
                                          className={`h-1 rounded-full transition-all duration-300 ${
                                            (apiQuotas.gemini.rpmPercentage || 0) >= 90 ? 'bg-red-500' :
                                            (apiQuotas.gemini.rpmPercentage || 0) >= 75 ? 'bg-orange-500' :
                                            'bg-blue-500'
                                          }`}
                                          style={{ width: `${Math.min(apiQuotas.gemini.rpmPercentage || 0, 100)}%` }}
                                        ></div>
                                      </div>
                                      
                                      {/* RPM Status Text */}
                                      <div className="text-xs text-center mb-1">
                                        <span className={`font-medium ${
                                          (apiQuotas.gemini.rpmPercentage || 0) >= 90 ? 'text-red-600' :
                                          (apiQuotas.gemini.rpmPercentage || 0) >= 75 ? 'text-orange-600' :
                                          'text-blue-600'
                                        }`}>
                                          {apiQuotas.gemini.rpmPercentage || 0}% RPM Usage
                                        </span>
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* TPM Status */}
                                  {apiQuotas.gemini.tpmLimit && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-600">Tokens/min:</span>
                                      <span className="font-medium text-blue-900">{apiQuotas.gemini.tpmLimit.toLocaleString()}</span>
                                    </div>
                                  )}
                                </>
                              )}
                          
                          <div className="w-full bg-gray-200 rounded-full h-3 mt-3 relative overflow-hidden">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                                apiQuotas.gemini.percentageUsed >= 100 ? 'bg-red-500 animate-pulse' :
                                apiQuotas.gemini.percentageUsed >= 90 ? 'bg-orange-500' :
                                apiQuotas.gemini.percentageUsed >= 75 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(apiQuotas.gemini.percentageUsed, 100)}%` }}
                            ></div>
                            {/* Danger zone indicator */}
                            {apiQuotas.gemini.percentageUsed < 90 && (
                              <div 
                                className="absolute top-0 h-3 w-1 bg-red-300 opacity-50"
                                style={{ left: '90%' }}
                                title="Danger zone (90%)"
                              ></div>
                            )}
                          </div>
                          
                          {/* Real-time usage status */}
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-500">
                              📊 Live Status
                            </span>
                            <span className={`text-xs font-medium ${
                              apiQuotas.gemini.percentageUsed >= 100 ? 'text-red-600' :
                              apiQuotas.gemini.percentageUsed >= 90 ? 'text-orange-600' :
                              apiQuotas.gemini.percentageUsed >= 75 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {apiQuotas.gemini.percentageUsed >= 100 ? '🛑 BLOCKED' :
                               apiQuotas.gemini.percentageUsed >= 90 ? '⚠️ CRITICAL' :
                               apiQuotas.gemini.percentageUsed >= 75 ? '🟡 WARNING' :
                               '✅ HEALTHY'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            🕒 Resets at: {new Date(apiQuotas.gemini.resetAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      
                      {apiQuotas.huggingface && (
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-orange-900">Hugging Face API</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              apiQuotas.huggingface.percentageUsed > 90 ? 'bg-red-100 text-red-800' :
                              apiQuotas.huggingface.percentageUsed > 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {apiQuotas.huggingface.percentageUsed}% used
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Daily Limit:</span>
                              <span className="font-medium text-gray-900">{apiQuotas.huggingface.dailyLimit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Used Today:</span>
                              <span className="font-medium text-gray-900">{apiQuotas.huggingface.usedCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Remaining:</span>
                              <span className={`font-bold ${
                                apiQuotas.huggingface.remainingCount < 50 ? 'text-red-600' :
                                apiQuotas.huggingface.remainingCount < 200 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {apiQuotas.huggingface.remainingCount}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  apiQuotas.huggingface.percentageUsed > 90 ? 'bg-red-500' :
                                  apiQuotas.huggingface.percentageUsed > 70 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${apiQuotas.huggingface.percentageUsed}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Resets at: {new Date(apiQuotas.huggingface.resetAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* System Health */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Health</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(systemHealth).map(([key, status]) => (
                      <div key={key} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${status ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-700 capitalize">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Performance Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Response Time Trend</h4>
                      <p className="text-2xl font-bold text-blue-600">{analytics.avgResponseTime}ms</p>
                      <p className="text-sm text-gray-500">Average response time</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">User Satisfaction</h4>
                      <p className="text-2xl font-bold text-green-600">{analytics.userSatisfaction}%</p>
                      <p className="text-sm text-gray-500">Satisfaction rate</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Top Queries</h3>
                  <div className="space-y-3">
                    {analytics.topQueries.length > 0 ? analytics.topQueries.map((query, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">{query.query}</span>
                        <span className="text-sm font-medium text-gray-900">{query.count}</span>
                      </div>
                    )) : (
                      <p className="text-gray-500">No query data available yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              {/* Web Scraping Section */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">🕷️ Web Scraping & URL Management</h3>
                  
                  {/* URL Submission Form */}
                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h4 className="text-md font-medium text-blue-900 mb-3">Add Website to Knowledge Base</h4>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="scrape-url" className="block text-sm font-medium text-blue-700">
                          Website URL
                        </label>
                        <input
                          type="url"
                          id="scrape-url"
                          value={scrapeUrl}
                          onChange={(e) => setScrapeUrl(e.target.value)}
                          placeholder="https://omanairports.co.om/page-to-scrape"
                          className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="scrape-category" className="block text-sm font-medium text-blue-700">
                          Category (Optional)
                        </label>
                        <select
                          id="scrape-category"
                          value={scrapeCategory}
                          onChange={(e) => setScrapeCategory(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Auto-detect category</option>
                          <option value="flights">Flights</option>
                          <option value="transportation">Transportation</option>
                          <option value="parking">Parking</option>
                          <option value="services">Services</option>
                          <option value="amenities">Amenities</option>
                          <option value="security">Security</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleScrapeWebsite}
                          disabled={scrapingStatus === 'loading' || !scrapeUrl}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {scrapingStatus === 'loading' ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Scraping...
                            </>
                          ) : (
                            <>
                              🕷️ Scrape Website
                            </>
                          )}
                        </button>
                        <button
                          onClick={fetchScrapingHistory}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          🔄 Refresh History
                        </button>
                      </div>
                    </div>
                    
                    {/* Scraping Status */}
                    {scrapingMessage && (
                      <div className={`mt-4 p-3 rounded-md ${scrapingStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {scrapingMessage}
                      </div>
                    )}
                  </div>

                  {/* Scraping History */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">📊 Scraping History</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {scrapingHistory.length > 0 ? (
                        <div className="space-y-3">
                          {scrapingHistory.map((item, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{item.title || 'Untitled'}</div>
                                <div className="text-sm text-blue-600 hover:underline">
                                  <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Scraped: {new Date(item.lastScraped).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleReScrapeWebsite(item.url)}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  title="Re-scrape this URL"
                                >
                                  🔄
                                </button>
                                <button
                                  onClick={() => handleDeleteScrapedContent(item.url)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                  title="Delete scraped content"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center">No scraping history yet. Add a website URL above to get started.</p>
                      )}
                    </div>
                  </div>

                  {/* Knowledge Base Statistics */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">📈 Knowledge Base Statistics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {knowledgeStats.map((stat, index) => (
                        <div key={index} className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                          <div className="text-2xl font-bold">{stat.count}</div>
                          <div className="text-sm opacity-90 capitalize">{stat.category}</div>
                        </div>
                      ))}
                      <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-4 text-white">
                        <div className="text-2xl font-bold">{totalKnowledgeEntries}</div>
                        <div className="text-sm opacity-90">Total Entries</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Existing Knowledge Base Management */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">📚 Knowledge Base Entries</h3>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="Search knowledge base..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <button
                        onClick={fetchKnowledgeBase}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {filteredKnowledge.length > 0 ? filteredKnowledge.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">{item.question}</h4>
                            <p className="text-sm text-gray-600 mb-3">{item.answer}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {item.category}
                              </span>
                              {item.subcategory && (
                                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                  {item.subcategory}
                                </span>
                              )}
                              {item.priority && item.priority > 1 && (
                                <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                                  Priority: {item.priority}
                                </span>
                              )}
                            </div>
                            {item.sourceUrl && (
                              <div className="text-xs text-blue-600">
                                Source: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.sourceUrl}</a>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-500 mb-2">{item.lastUpdated}</span>
                            <button
                              onClick={() => handleDeleteKnowledgeEntry(item.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Delete this entry"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <div className="text-gray-400 text-6xl mb-4">📚</div>
                        <p className="text-gray-500 mb-4">No knowledge base items found.</p>
                        <p className="text-sm text-gray-400">Add website URLs above to automatically populate the knowledge base with relevant information.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Agent Performance</h3>
                  <p className="text-gray-600">No active agents at the moment. Human agent support will be available when agents are online.</p>
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Configuration</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">AI Model Status</label>
                      <p className="text-sm text-gray-600">Ollama Local AI - {systemHealth.ai ? 'Running' : 'Stopped'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Database Status</label>
                      <p className="text-sm text-gray-600">PostgreSQL - {systemHealth.database ? 'Connected' : 'Disconnected'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Web Scraper Status</label>
                      <p className="text-sm text-gray-600">Puppeteer - {systemHealth.scraper ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">API Status</label>
                      <p className="text-sm text-gray-600">REST API - {systemHealth.api ? 'Running' : 'Down'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 