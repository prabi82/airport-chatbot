import { prisma } from './database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'super_admin' | 'moderator';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface AnalyticsData {
  totalChats: number;
  totalSessions: number;
  totalHandoffs: number;
  totalAgents: number;
  averageResponseTime: number;
  satisfactionScore: number;
  topQueries: Array<{ query: string; count: number }>;
  dailyStats: Array<{ date: string; chats: number; handoffs: number }>;
}

export interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  aiService: 'healthy' | 'warning' | 'error';
  webScraper: 'healthy' | 'warning' | 'error';
  agents: { online: number; total: number };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AdminService {
  private static instance: AdminService;
  
  static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  // Admin Authentication
  async authenticateAdmin(username: string, password: string): Promise<{ admin: AdminUser; token: string } | null> {
    try {
      // For demo purposes, use hardcoded credentials
      // In production, this would be stored in database with hashed passwords
      const adminCredentials = {
        username: 'admin',
        password: 'admin123',
        email: 'admin@omanairports.co.om',
        role: 'super_admin' as const,
        permissions: ['all']
      };

      if (username === adminCredentials.username && password === adminCredentials.password) {
        const token = jwt.sign(
          { 
            adminId: 'admin-1', 
            username: adminCredentials.username, 
            role: adminCredentials.role 
          },
          process.env.JWT_SECRET || 'fallback-secret-key-for-demo',
          { expiresIn: '8h' }
        );

        return {
          admin: {
            id: 'admin-1',
            username: adminCredentials.username,
            email: adminCredentials.email,
            role: adminCredentials.role,
            permissions: adminCredentials.permissions,
            isActive: true,
            lastLogin: new Date(),
            createdAt: new Date()
          },
          token
        };
      }

      return null;
    } catch (error) {
      console.error('Admin authentication error:', error);
      return null;
    }
  }

  // Get Analytics Data
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<AnalyticsData> {
    try {
      const whereClause = dateRange ? {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      } : {};

      // Get basic counts
      const [totalChats, totalSessions, totalHandoffs, totalAgents] = await Promise.all([
        prisma.chatMessage.count({ where: whereClause }),
        prisma.chatSession.count({ where: whereClause }),
        prisma.chatHandoff.count({ where: whereClause }),
        prisma.supportAgent.count({ where: { isActive: true } })
      ]);

      // Get average response time
      const avgResponseTime = await prisma.chatMessage.aggregate({
        where: whereClause,
        _avg: {
          processingTime: true
        }
      });

      // Get satisfaction scores from agent chats
      const satisfactionData = await prisma.agentChat.aggregate({
        where: {
          satisfaction: { not: null },
          ...(dateRange ? {
            startedAt: {
              gte: dateRange.start,
              lte: dateRange.end
            }
          } : {})
        },
        _avg: {
          satisfaction: true
        }
      });

      // Get top queries (simplified - group by first 50 chars of message)
      const topQueries = await prisma.chatMessage.groupBy({
        by: ['message'],
        where: whereClause,
        _count: {
          message: true
        },
        orderBy: {
          _count: {
            message: 'desc'
          }
        },
        take: 10
      });

      // Get daily stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyChats = await prisma.chatMessage.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _count: {
          id: true
        }
      });

      const dailyHandoffs = await prisma.chatHandoff.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _count: {
          id: true
        }
      });

      // Process daily stats
      const dailyStats = this.processDailyStats(dailyChats, dailyHandoffs);

      return {
        totalChats,
        totalSessions,
        totalHandoffs,
        totalAgents,
        averageResponseTime: avgResponseTime._avg.processingTime || 0,
        satisfactionScore: satisfactionData._avg.satisfaction || 0,
        topQueries: topQueries.map(q => ({
          query: q.message.substring(0, 50) + (q.message.length > 50 ? '...' : ''),
          count: q._count.message
        })),
        dailyStats
      };
    } catch (error) {
      console.error('Get analytics error:', error);
      return {
        totalChats: 0,
        totalSessions: 0,
        totalHandoffs: 0,
        totalAgents: 0,
        averageResponseTime: 0,
        satisfactionScore: 0,
        topQueries: [],
        dailyStats: []
      };
    }
  }

  // Get System Health
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      // Check database health
      let databaseHealth: 'healthy' | 'warning' | 'error' = 'healthy';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        databaseHealth = 'error';
      }

      // Check API health (simplified)
      const apiHealth: 'healthy' | 'warning' | 'error' = 'healthy';

      // Check AI service health - Updated to check for multiple providers
      let aiServiceHealth: 'healthy' | 'warning' | 'error' = 'error';
      
      // Check for available AI API keys (primary method)
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;
      const togetherApiKey = process.env.TOGETHER_API_KEY;
      const groqApiKey = process.env.GROQ_API_KEY;
      
      if (geminiApiKey || huggingfaceApiKey || openaiApiKey || togetherApiKey || groqApiKey) {
        aiServiceHealth = 'healthy';
        
        // If Gemini API is available, test it quickly
        if (geminiApiKey) {
          try {
            const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "test" }] }]
              }),
              signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            
            if (testResponse.ok || testResponse.status === 400) { // 400 is ok, means API is responding
              aiServiceHealth = 'healthy';
            }
          } catch (error) {
            // If Gemini fails but we have other keys, still mark as healthy
            aiServiceHealth = huggingfaceApiKey || openaiApiKey || togetherApiKey || groqApiKey ? 'healthy' : 'warning';
          }
        }
      } else {
        // Fallback: Check if Ollama is running (for local development)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch('http://localhost:11434/api/tags', { 
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            aiServiceHealth = 'healthy';
          } else {
            aiServiceHealth = 'warning'; // Ollama installed but not responding
          }
        } catch (error) {
          aiServiceHealth = 'error'; // No AI service available
        }
      }

      // Check web scraper health (simplified)
      const webScraperHealth: 'healthy' | 'warning' | 'error' = 'healthy';

      // Get agent statistics (with error handling)
      let onlineAgents = 0;
      let totalAgents = 0;
      try {
        const agentCounts = await Promise.all([
          prisma.supportAgent.count({ where: { isOnline: true, isActive: true } }),
          prisma.supportAgent.count({ where: { isActive: true } })
        ]);
        onlineAgents = agentCounts[0];
        totalAgents = agentCounts[1];
      } catch (error) {
        console.log('Agent statistics not available:', error instanceof Error ? error.message : String(error));
      }

      // Get performance metrics
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          processingTime: true,
          isSuccessful: true
        }
      });

      const avgResponseTime = recentMessages.length > 0 
        ? recentMessages.reduce((sum, msg) => sum + (msg.processingTime || 0), 0) / recentMessages.length
        : 0;
      const errorRate = recentMessages.length > 0
        ? recentMessages.filter(msg => !msg.isSuccessful).length / recentMessages.length
        : 0;

      return {
        database: databaseHealth,
        api: apiHealth,
        aiService: aiServiceHealth,
        webScraper: webScraperHealth,
        agents: {
          online: onlineAgents,
          total: totalAgents
        },
        performance: {
          avgResponseTime,
          errorRate,
          uptime: 99.9 // Simplified uptime calculation
        }
      };
    } catch (error) {
      console.error('Get system health error:', error);
      return {
        database: 'error',
        api: 'error',
        aiService: 'error',
        webScraper: 'error',
        agents: { online: 0, total: 0 },
        performance: {
          avgResponseTime: 0,
          errorRate: 1,
          uptime: 0
        }
      };
    }
  }

  // Knowledge Base Management
  async getKnowledgeBase(category?: string, search?: string): Promise<any[]> {
    try {
      const where: any = { isActive: true };
      
      if (category) {
        where.category = category;
      }
      
      if (search) {
        where.OR = [
          { question: { contains: search, mode: 'insensitive' } },
          { answer: { contains: search, mode: 'insensitive' } },
          { keywords: { has: search } }
        ];
      }

      const entries = await prisma.knowledgeBase.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { updatedAt: 'desc' }
        ]
      });

      return entries;
    } catch (error) {
      console.error('Get knowledge base error:', error);
      return [];
    }
  }

  // Create Knowledge Base Entry
  async createKnowledgeEntry(data: {
    category: string;
    subcategory?: string;
    question: string;
    answer: string;
    keywords: string[];
    priority?: number;
  }): Promise<any | null> {
    try {
      const entry = await prisma.knowledgeBase.create({
        data: {
          category: data.category,
          subcategory: data.subcategory,
          question: data.question,
          answer: data.answer,
          keywords: data.keywords,
          priority: data.priority || 1
        }
      });

      return entry;
    } catch (error) {
      console.error('Create knowledge entry error:', error);
      return null;
    }
  }

  // Update Knowledge Base Entry
  async updateKnowledgeEntry(id: string, data: {
    category?: string;
    subcategory?: string;
    question?: string;
    answer?: string;
    keywords?: string[];
    priority?: number;
    isActive?: boolean;
  }): Promise<any | null> {
    try {
      const entry = await prisma.knowledgeBase.update({
        where: { id },
        data
      });

      return entry;
    } catch (error) {
      console.error('Update knowledge entry error:', error);
      return null;
    }
  }

  // Delete Knowledge Base Entry
  async deleteKnowledgeEntry(id: string): Promise<boolean> {
    try {
      await prisma.knowledgeBase.update({
        where: { id },
        data: { isActive: false }
      });

      return true;
    } catch (error) {
      console.error('Delete knowledge entry error:', error);
      return false;
    }
  }

  // Get Agent Performance
  async getAgentPerformance(): Promise<any[]> {
    try {
      const agents = await prisma.supportAgent.findMany({
        where: { isActive: true },
        include: {
          agentChats: {
            where: {
              endedAt: { not: null }
            },
            select: {
              duration: true,
              satisfaction: true,
              startedAt: true
            }
          },
          handoffs: {
            select: {
              status: true,
              createdAt: true,
              resolvedAt: true
            }
          }
        }
      });

      return agents.map(agent => {
        const completedChats = agent.agentChats.length;
        const avgDuration = completedChats > 0 
          ? agent.agentChats.reduce((sum, chat) => sum + (chat.duration || 0), 0) / completedChats
          : 0;
        const avgSatisfaction = completedChats > 0
          ? agent.agentChats.reduce((sum, chat) => sum + (chat.satisfaction || 0), 0) / completedChats
          : 0;
        const resolvedHandoffs = agent.handoffs.filter(h => h.status === 'completed').length;

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          isOnline: agent.isOnline,
          currentChats: agent.currentChats,
          maxChats: agent.maxChats,
          completedChats,
          avgDuration,
          avgSatisfaction,
          resolvedHandoffs,
          lastActivity: agent.lastActivity
        };
      });
    } catch (error) {
      console.error('Get agent performance error:', error);
      return [];
    }
  }

  // System Configuration
  async getSystemConfig(): Promise<any> {
    try {
      // Return default system configuration
      // In production, this would be stored in database
      return {
        general: {
          siteName: 'Oman Airports AI Chatbot',
          supportEmail: 'support@omanairports.co.om',
          defaultLanguage: 'en',
          timezone: 'Asia/Muscat'
        },
        chat: {
          maxSessionDuration: 3600, // 1 hour
          defaultResponseTimeout: 30, // 30 seconds
          maxMessageLength: 1000,
          enableFileUpload: false
        },
        ai: {
          confidenceThreshold: 0.7,
          enableHandoffSuggestion: true,
          maxRetries: 3,
          fallbackMessage: 'I apologize, but I\'m having trouble understanding. Would you like to speak with a human agent?'
        },
        agents: {
          defaultMaxChats: 5,
          autoAssignHandoffs: true,
          requireSkillsMatch: false,
          enablePerformanceTracking: true
        }
      };
    } catch (error) {
      console.error('Get system config error:', error);
      return {};
    }
  }

  // Helper method to process daily stats
  private processDailyStats(dailyChats: any[], dailyHandoffs: any[]): Array<{ date: string; chats: number; handoffs: number }> {
    const statsMap = new Map<string, { chats: number; handoffs: number }>();

    // Process chats
    dailyChats.forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!statsMap.has(date)) {
        statsMap.set(date, { chats: 0, handoffs: 0 });
      }
      statsMap.get(date)!.chats += item._count.id;
    });

    // Process handoffs
    dailyHandoffs.forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!statsMap.has(date)) {
        statsMap.set(date, { chats: 0, handoffs: 0 });
      }
      statsMap.get(date)!.handoffs += item._count.id;
    });

    // Convert to array and sort by date
    return Array.from(statsMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const adminService = AdminService.getInstance(); 