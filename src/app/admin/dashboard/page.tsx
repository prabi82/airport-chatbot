'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { KnowledgeItem } from '@/types';
import dynamic from 'next/dynamic';
const AdminNav = dynamic(() => import('./AdminNav'), { ssr: false });

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



function AdminDashboardInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [scrapingHistory, setScrapingHistory] = useState<{ title: string; url: string; lastScraped: string; entryCount?: number }[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<{ category: string; count: number }[]>([]);
  const [totalKnowledgeEntries, setTotalKnowledgeEntries] = useState(0);
  const [apiQuotas, setApiQuotas] = useState<{ [provider: string]: QuotaStatus }>({});
  const [quotaAlerts, setQuotaAlerts] = useState<string[]>([]);
  const [editingEntry, setEditingEntry] = useState<KnowledgeItem | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editForm, setEditForm] = useState({
    question: '',
    answer: '',
    category: '',
    subcategory: '',
    priority: 1,
    sourceUrl: '',
    dataSource: 'manual' as 'manual' | 'scraping' | 'import'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(15);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Source entries modal state
  const [showSourceEntries, setShowSourceEntries] = useState(false);
  const [selectedSourceUrl, setSelectedSourceUrl] = useState('');
  const [selectedSourceTitle, setSelectedSourceTitle] = useState('');
  const [sourceEntries, setSourceEntries] = useState<KnowledgeItem[]>([]);
  const [loadingSourceEntries, setLoadingSourceEntries] = useState(false);
  
  // Category management state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    icon?: string;
    isActive: boolean;
    order: number;
    entryCount: number;
    createdAt: string;
  }>>([]);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: ''
  });

  useEffect(() => {
    checkAuthentication();
  }, []);

  // Handle URL tab parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'analytics', 'knowledge', 'agents', 'system'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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

  // refetch knowledge when tab switched to knowledge
  useEffect(() => {
    if (activeTab === 'knowledge') {
      fetchKnowledgeBase();
    }
  }, [activeTab]);

  const checkAuthentication = async () => {
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

  const fetchScrapingHistory = async (showAll = false) => {
    try {
      const url = showAll ? '/api/admin/scraper?limit=1000' : '/api/admin/scraper';
      const response = await fetch(url);
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

  let filteredKnowledge = knowledgeBase.filter(item => {
    const matchesCategory = selectedCategoryFilter ? item.category === selectedCategoryFilter : true;
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Auto-reset category filter if it hides all entries
  if (selectedCategoryFilter && filteredKnowledge.length === 0 && knowledgeBase.length > 0) {
    setSelectedCategoryFilter('');
    filteredKnowledge = knowledgeBase.filter(item => item.question.toLowerCase().includes(searchTerm.toLowerCase()) || item.answer.toLowerCase().includes(searchTerm.toLowerCase()));
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredKnowledge.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentPageItems = filteredKnowledge.slice(startIndex, endIndex);

  // Reset to first page when search term or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategoryFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleCategoryFilter = (category: string) => {
    // Normalize category casing to match stored entries
    const normalized = (category || '').toLowerCase();
    const match = knowledgeBase.find(e => (e.category || '').toLowerCase() === normalized);
    const finalCategory = match ? match.category : category;
    setSelectedCategoryFilter(finalCategory);
    setActiveTab('knowledge'); // Switch to knowledge tab to show filtered results
  };

  const handleClearFilters = () => {
    setSelectedCategoryFilter('');
    setSearchTerm('');
  };

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

  const handleEditKnowledgeEntry = (item: KnowledgeItem) => {
    setEditingEntry(item);
    setEditForm({
      question: item.question,
      answer: item.answer,
      category: item.category,
      subcategory: item.subcategory || '',
      priority: item.priority || 1,
      sourceUrl: item.sourceUrl || '',
      dataSource: item.dataSource || 'manual'
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setShowCreateForm(false);
    setEditForm({
      question: '',
      answer: '',
      category: '',
      subcategory: '',
      priority: 1,
      sourceUrl: '',
      dataSource: 'manual'
    });
  };

  const handleCreateNew = () => {
    setShowCreateForm(true);
    setEditForm({
      question: '',
      answer: '',
      category: '',
      subcategory: '',
      priority: 1,
      sourceUrl: '',
      dataSource: 'manual'
    });
  };

  const handleSaveNew = async () => {
    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
                  body: JSON.stringify({
            question: editForm.question,
            answer: editForm.answer,
            category: editForm.category,
            subcategory: editForm.subcategory || null,
            priority: editForm.priority,
            sourceUrl: editForm.sourceUrl || null,
            dataSource: editForm.dataSource
          })
      });
      
      if (response.ok) {
        // Refresh knowledge base
        await fetchKnowledgeBase();
        setScrapingStatus('success');
        setScrapingMessage('Knowledge entry created successfully');
        handleCancelEdit();
      } else {
        const errorData = await response.json();
        setScrapingStatus('error');
        setScrapingMessage(errorData.error || 'Failed to create knowledge entry');
      }
    } catch (error) {
      console.error('Failed to create knowledge entry:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while creating the entry.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
                  body: JSON.stringify({
            id: editingEntry.id,
            question: editForm.question,
            answer: editForm.answer,
            category: editForm.category,
            subcategory: editForm.subcategory || null,
            priority: editForm.priority,
            sourceUrl: editForm.sourceUrl || null,
            dataSource: editForm.dataSource,
            isActive: true
          })
      });
      
      if (response.ok) {
        // Refresh knowledge base
        await fetchKnowledgeBase();
        setScrapingStatus('success');
        setScrapingMessage('Knowledge entry updated successfully');
        handleCancelEdit();
      } else {
        const errorData = await response.json();
        setScrapingStatus('error');
        setScrapingMessage(errorData.error || 'Failed to update knowledge entry');
      }
    } catch (error) {
      console.error('Failed to update knowledge entry:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while updating the entry.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected entries? This action cannot be undone.`)) return;
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScrapingStatus('success');
        setScrapingMessage(data.message);
        setSelectedIds([]);
        await fetchKnowledgeBase();
      } else {
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to delete entries');
      }
    } catch (err) {
      console.error('Bulk delete error', err);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while deleting entries');
    }
  };

  // Category Management Functions
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) {
      setScrapingStatus('error');
      setScrapingMessage('Category name is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryForm)
      });
      
      if (response.ok) {
        setScrapingStatus('success');
        setScrapingMessage('Category created successfully');
        setCategoryForm({ name: '', description: '', icon: '' });
        setShowCreateCategory(false);
        await fetchCategories();
      } else {
        const data = await response.json();
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while creating the category');
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || ''
    });
  };

  const handleUpdateCategory = async () => {
    if (!categoryForm.name.trim()) {
      setScrapingStatus('error');
      setScrapingMessage('Category name is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: editingCategory.id,
          ...categoryForm
        })
      });
      
      if (response.ok) {
        setScrapingStatus('success');
        setScrapingMessage('Category updated successfully');
        setCategoryForm({ name: '', description: '', icon: '' });
        setEditingCategory(null);
        await fetchCategories();
      } else {
        const data = await response.json();
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while updating the category');
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Delete category "${categoryName}"? This will update all entries in this category to "Uncategorized".`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: categoryId })
      });
      
      if (response.ok) {
        setScrapingStatus('success');
        setScrapingMessage('Category deleted successfully');
        await fetchCategories();
        await fetchKnowledgeBase(); // Refresh knowledge base to reflect changes
      } else {
        const data = await response.json();
        setScrapingStatus('error');
        setScrapingMessage(data.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      setScrapingStatus('error');
      setScrapingMessage('An error occurred while deleting the category');
    }
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategory(null);
    setShowCreateCategory(false);
    setCategoryForm({ name: '', description: '', icon: '' });
  };

  // Function to fetch entries for a specific source
  const fetchEntriesBySource = async (sourceUrl: string, sourceTitle: string) => {
    setSelectedSourceUrl(sourceUrl);
    setSelectedSourceTitle(sourceTitle);
    setShowSourceEntries(true);
    setLoadingSourceEntries(true);
    
    try {
      const response = await fetch(`/api/admin/knowledge?sourceUrl=${encodeURIComponent(sourceUrl)}`);
      if (response.ok) {
        const data = await response.json();
        setSourceEntries(data.items || []);
      } else {
        console.error('Failed to fetch source entries');
        setSourceEntries([]);
      }
    } catch (error) {
      console.error('Error fetching source entries:', error);
      setSourceEntries([]);
    } finally {
      setLoadingSourceEntries(false);
    }
  };

  const handleCloseSourceEntries = () => {
    setShowSourceEntries(false);
    setSelectedSourceUrl('');
    setSelectedSourceTitle('');
    setSourceEntries([]);
  };

  // Fetch categories when category manager is opened
  useEffect(() => {
    if (showCategoryManager) {
      fetchCategories();
    }
  }, [showCategoryManager]);

  // Fetch categories on component mount for dropdowns
  useEffect(() => {
    fetchCategories();
  }, []);

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
      <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />
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
                          {categories.map((category) => (
                            <option key={category.id} value={category.name.toLowerCase()}>
                              {category.name}
                            </option>
                          ))}
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
                          onClick={() => fetchScrapingHistory(false)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          🔄 Refresh History
                        </button>
                        <button
                          onClick={() => fetchScrapingHistory(true)}
                          className="inline-flex items-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-md shadow-sm text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        >
                          📋 Show All Sources
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
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-md font-medium text-gray-900">📊 Scraping History</h4>
                      <div className="text-sm text-gray-600">
                        <span>Showing {scrapingHistory.length} source{scrapingHistory.length !== 1 ? 's' : ''}</span>
                        {scrapingHistory.length > 0 && scrapingHistory.some(item => item.entryCount !== undefined) && (
                          <span className="ml-2 text-green-600 font-medium">
                            • {scrapingHistory.reduce((total, item) => total + (item.entryCount || 0), 0)} total entries
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {scrapingHistory.length > 0 ? (
                        <div className="space-y-3">
                          {scrapingHistory.map((item, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-sm font-medium text-gray-900">{item.title || 'Untitled'}</div>
                                  {item.entryCount !== undefined && (
                                    <button
                                      onClick={() => fetchEntriesBySource(item.url, item.title || 'Untitled')}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900 transition-colors cursor-pointer"
                                      title="Click to view entries from this source"
                                    >
                                      {item.entryCount} entries
                                    </button>
                                  )}
                                </div>
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
                        <button
                          key={index}
                          onClick={() => handleCategoryFilter(stat.category)}
                          className={`bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white text-left hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                            selectedCategoryFilter.toLowerCase() === stat.category.toLowerCase() 
                              ? 'ring-4 ring-yellow-300 ring-opacity-75' 
                              : ''
                          }`}
                        >
                          <div className="text-2xl font-bold">{stat.count}</div>
                          <div className="text-sm opacity-90 capitalize">{stat.category}</div>
                          <div className="text-xs opacity-75 mt-1">Click to filter</div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setSelectedCategoryFilter('');
                          setActiveTab('knowledge');
                        }}
                        className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-4 text-white text-left hover:from-green-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <div className="text-2xl font-bold">{totalKnowledgeEntries}</div>
                        <div className="text-sm opacity-90">Total Entries</div>
                        <div className="text-xs opacity-75 mt-1">Click to show all</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit/Create Knowledge Entry Modal */}
              {(editingEntry || showCreateForm) && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                  <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          {editingEntry ? '✏️ Edit Knowledge Entry' : '➕ Create New Knowledge Entry'}
                        </h3>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <span className="sr-only">Close</span>
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Question Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question *
                          </label>
                          <textarea
                            value={editForm.question}
                            onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Enter the question..."
                          />
                        </div>

                        {/* Answer Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Answer *
                          </label>
                          <textarea
                            value={editForm.answer}
                            onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={4}
                            placeholder="Enter the answer..."
                          />
                        </div>

                        {/* Category and Subcategory */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Category *
                            </label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.name}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Subcategory
                            </label>
                            <input
                              type="text"
                              value={editForm.subcategory}
                              onChange={(e) => setEditForm({...editForm, subcategory: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Optional subcategory"
                            />
                          </div>
                        </div>

                        {/* Priority and Source URL */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Priority
                            </label>
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm({...editForm, priority: parseInt(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={1}>1 - Low</option>
                              <option value={2}>2 - Normal</option>
                              <option value={3}>3 - High</option>
                              <option value={4}>4 - Very High</option>
                              <option value={5}>5 - Critical</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Source URL
                            </label>
                            <input
                              type="url"
                              value={editForm.sourceUrl}
                              onChange={(e) => setEditForm({...editForm, sourceUrl: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="https://..."
                            />
                          </div>
                        </div>

                        {/* Data Source */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data Source
                          </label>
                          <select
                            value={editForm.dataSource}
                            onChange={(e) => setEditForm({...editForm, dataSource: e.target.value as 'manual' | 'scraping' | 'import'})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="manual">✏️ Manual - Added manually by admin</option>
                            <option value="scraping">🌐 Scraping - Generated from website</option>
                            <option value="import">📥 Import - Imported from training data</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            This helps distinguish between manually added content and auto-generated knowledge.
                          </p>
                        </div>
                      </div>

                      {/* Modal Actions */}
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={editingEntry ? handleSaveEdit : handleSaveNew}
                          disabled={!editForm.question.trim() || !editForm.answer.trim() || !editForm.category}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingEntry ? '💾 Save Changes' : '➕ Create Entry'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Knowledge Base Management */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900">📚 Knowledge Base Entries</h3>
                      {(selectedCategoryFilter || searchTerm) && (
                        <div className="flex items-center mt-2 space-x-2">
                          <span className="text-sm text-gray-600">Active filters:</span>
                          {selectedCategoryFilter && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Category: {selectedCategoryFilter}
                              <button
                                onClick={() => setSelectedCategoryFilter('')}
                                className="ml-1 inline-flex items-center p-0.5 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                              >
                                <span className="sr-only">Remove filter</span>
                                <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                  <path strokeLinecap="round" strokeWidth="1.5" d="m1 1 6 6m0-6-6 6" />
                                </svg>
                              </button>
                            </span>
                          )}
                          {searchTerm && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Search: "{searchTerm}"
                              <button
                                onClick={() => setSearchTerm('')}
                                className="ml-1 inline-flex items-center p-0.5 rounded-full text-green-400 hover:bg-green-200 hover:text-green-600"
                              >
                                <span className="sr-only">Remove filter</span>
                                <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                  <path strokeLinecap="round" strokeWidth="1.5" d="m1 1 6 6m0-6-6 6" />
                                </svg>
                              </button>
                            </span>
                          )}
                          <button
                            onClick={handleClearFilters}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="Search knowledge base..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      {/* Bulk Delete Button */}
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedIds.length === 0}
                        className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                          selectedIds.length === 0
                            ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
                            : 'text-white bg-red-600 hover:bg-red-700 border-transparent'
                        }`}
                        title={selectedIds.length === 0 ? 'Select entries to delete' : `Delete ${selectedIds.length} selected entries`}
                      >
                        🗑️ Delete Selected
                      </button>
                      <button
                        onClick={() => {
                          setShowCategoryManager(true);
                          fetchCategories();
                        }}
                        className="inline-flex items-center px-3 py-2 border border-purple-300 text-sm font-medium rounded-md shadow-sm text-purple-700 bg-purple-50 hover:bg-purple-100"
                      >
                        🏷️ Manage Categories
                      </button>
                      <button
                        onClick={handleCreateNew}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                      >
                        ➕ New Entry
                      </button>
                      <button
                        onClick={fetchKnowledgeBase}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {currentPageItems.length > 0 ? currentPageItems.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start mb-2">
                          <input type="checkbox" className="mr-2 mt-1" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                  {item.question}
                                  {(item as any).hits !== undefined && (
                                    <span className="ml-2 inline-block bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                                      hits: {(item as any).hits}
                                    </span>
                                  )}
                                </h4>
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
                                  {/* Data Source Tag */}
                                  <span className={`inline-block text-xs px-2 py-1 rounded ${
                                    item.dataSource === 'manual' ? 'bg-purple-100 text-purple-800' :
                                    item.dataSource === 'scraping' ? 'bg-orange-100 text-orange-800' :
                                    'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {item.dataSource === 'manual' ? '✏️ Manual' :
                                     item.dataSource === 'scraping' ? '🌐 Scraped' :
                                     '📥 Imported'}
                                  </span>
                                </div>
                                {item.sourceUrl && (
                                  <div className="text-xs text-blue-600">
                                    Source: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.sourceUrl}</a>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-500 mb-2">{item.lastUpdated}</span>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditKnowledgeEntry(item)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                    title="Edit this entry"
                                  >
                                    ✏️ Edit
                                  </button>
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
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <div className="text-gray-400 text-6xl mb-4">📚</div>
                        <p className="text-gray-500 mb-4">
                          {filteredKnowledge.length === 0 ? "No knowledge base items found." : "No items on this page."}
                        </p>
                        {filteredKnowledge.length === 0 && (
                          <p className="text-sm text-gray-400">Add website URLs above to automatically populate the knowledge base with relevant information.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {filteredKnowledge.length > entriesPerPage && (
                    <div className="mt-6 flex items-center justify-between border-t pt-4">
                      <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredKnowledge.length)} of {filteredKnowledge.length} entries
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handlePreviousPage}
                          disabled={currentPage === 1}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ← Previous
                        </button>
                        
                        {/* Page numbers */}
                        <div className="flex space-x-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  currentPage === pageNum
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Management Modal */}
              {showCategoryManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">🏷️ Manage Categories</h2>
                      <button
                        onClick={() => setShowCategoryManager(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Add New Category Section */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {editingCategory ? 'Edit Category' : 'Add New Category'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category Name *
                          </label>
                          <input
                            type="text"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter category name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                          </label>
                          <input
                            type="text"
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-3 mt-4">
                        <button
                          onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          {editingCategory ? 'Update Category' : 'Create Category'}
                        </button>
                        {editingCategory && (
                          <button
                            onClick={handleCancelCategoryEdit}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Cancel
                          </button>
                        )}
                        {!editingCategory && (
                          <button
                            onClick={() => setShowCreateCategory(!showCreateCategory)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                          >
                            {showCreateCategory ? 'Hide Form' : 'Show Form'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Categories List */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Existing Categories</h3>
                      {categories.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categories.map((category) => (
                            <div key={category.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-gray-900">{category.name}</h4>
                                  {category.description && (
                                    <p className="text-xs text-gray-600 mt-1">{category.description}</p>
                                  )}
                                  <div className="flex items-center mt-2 space-x-4">
                                    <span className="text-xs text-gray-500">
                                      {category.entryCount} entries
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Created: {new Date(category.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex space-x-2 ml-2">
                                  <button
                                    onClick={() => handleEditCategory(category)}
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                    title="Edit category"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(category.id, category.name)}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                    title="Delete category"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-gray-400 text-4xl mb-4">🏷️</div>
                          <p className="text-gray-500">No categories found.</p>
                          <p className="text-sm text-gray-400 mt-2">Create your first category to organize your knowledge base entries.</p>
                        </div>
                      )}
                    </div>

                    {/* Status Messages */}
                    {scrapingStatus === 'success' && scrapingMessage && (
                      <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">{scrapingMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {scrapingStatus === 'error' && scrapingMessage && (
                      <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-red-800">{scrapingMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Source Entries Modal */}
              {showSourceEntries && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">📋 Knowledge Base Entries</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          From: <span className="font-medium">{selectedSourceTitle}</span>
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          <a href={selectedSourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {selectedSourceUrl}
                          </a>
                        </p>
                      </div>
                      <button
                        onClick={handleCloseSourceEntries}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {loadingSourceEntries ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading entries...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sourceEntries.length > 0 ? (
                          <>
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>{sourceEntries.length}</strong> knowledge base {sourceEntries.length === 1 ? 'entry' : 'entries'} found from this source
                              </p>
                            </div>
                            
                            {sourceEntries.map((entry, index) => (
                              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                      {index + 1}. {entry.question}
                                    </h4>
                                    <p className="text-sm text-gray-600 mb-3">{entry.answer}</p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                        {entry.category}
                                      </span>
                                      {entry.subcategory && (
                                        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                          {entry.subcategory}
                                        </span>
                                      )}
                                      {entry.priority && entry.priority > 1 && (
                                        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                                          Priority: {entry.priority}
                                        </span>
                                      )}
                                      <span className={`inline-block text-xs px-2 py-1 rounded ${
                                        entry.dataSource === 'manual' ? 'bg-purple-100 text-purple-800' :
                                        entry.dataSource === 'scraping' ? 'bg-orange-100 text-orange-800' :
                                        'bg-indigo-100 text-indigo-800'
                                      }`}>
                                        {entry.dataSource === 'manual' ? '✏️ Manual' :
                                         entry.dataSource === 'scraping' ? '🌐 Scraped' :
                                         '📥 Imported'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end ml-4">
                                    <span className="text-xs text-gray-500 mb-2">
                                      {entry.lastUpdated}
                                    </span>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => {
                                          handleEditKnowledgeEntry(entry);
                                          handleCloseSourceEntries();
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                        title="Edit this entry"
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm('Delete this entry?')) {
                                            handleDeleteKnowledgeEntry(entry.id);
                                            // Refresh the source entries
                                            fetchEntriesBySource(selectedSourceUrl, selectedSourceTitle);
                                          }
                                        }}
                                        className="text-red-600 hover:text-red-800 text-sm"
                                        title="Delete this entry"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-gray-400 text-6xl mb-4">📄</div>
                            <p className="text-gray-500 mb-4">No knowledge base entries found for this source.</p>
                            <p className="text-sm text-gray-400">
                              This might indicate the entries were deleted or the source URL has changed.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleCloseSourceEntries}
                        className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md text-sm font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

          {/* Thumbs-down (Negative) Feedback Tab */}
          {activeTab === 'unanswered' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Thumbs-down Responses</h3>
                  <p className="text-sm text-gray-600 mb-4">Shows recent feedback where users marked responses as not helpful.</p>
                  {/* Minimal fetcher using existing API: GET /api/admin/unanswered (placeholder) or feedback endpoint */}
                  <p className="text-sm text-gray-400">Use Sessions → View to inspect the exact Q&A and improve the KB entry.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardInner />
    </Suspense>
  );
}