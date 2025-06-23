import { prisma } from './database';

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  isActive: boolean;
  isOnline: boolean;
  maxChats: number;
  currentChats: number;
  lastActivity?: Date;
}

export interface HandoffRequest {
  sessionId: string;
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  context?: any;
}

export class AgentService {
  private static instance: AgentService;
  
  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  // Request Human Handoff
  async requestHandoff(request: HandoffRequest): Promise<string | null> {
    try {
      // Check if there's already a pending handoff for this session
      const existingHandoff = await prisma.chatHandoff.findFirst({
        where: {
          sessionId: request.sessionId,
          status: 'pending'
        }
      });

      if (existingHandoff) {
        return existingHandoff.id;
      }

      // Get chat context
      const session = await prisma.chatSession.findUnique({
        where: { sessionId: request.sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      const handoff = await prisma.chatHandoff.create({
        data: {
          sessionId: request.sessionId,
          reason: request.reason,
          priority: request.priority,
          context: {
            ...request.context,
            recentMessages: session?.messages || [],
            userAgent: session?.userAgent,
            language: session?.language
          }
        }
      });

      // Mark session as needing human assistance
      await prisma.chatSession.update({
        where: { sessionId: request.sessionId },
        data: { needsHuman: true }
      });

      return handoff.id;
    } catch (error) {
      console.error('Request handoff error:', error);
      return null;
    }
  }

  // Get Pending Handoffs
  async getPendingHandoffs(): Promise<any[]> {
    try {
      const handoffs = await prisma.chatHandoff.findMany({
        where: {
          status: 'pending'
        },
        include: {
          session: {
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 5
              }
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      return handoffs;
    } catch (error) {
      console.error('Get pending handoffs error:', error);
      return [];
    }
  }

  // Agent Authentication (simplified for now)
  async authenticateAgent(email: string, password: string): Promise<{ agent: Agent; token: string } | null> {
    // For now, return a mock response
    // In production, this would hash passwords and verify against database
    return {
      agent: {
        id: 'agent-1',
        name: 'Demo Agent',
        email: email,
        role: 'agent',
        skills: ['general'],
        isActive: true,
        isOnline: true,
        maxChats: 5,
        currentChats: 0
      },
      token: 'demo-token'
    };
  }

  // Register Agent (simplified for now)
  async registerAgent(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    skills?: string[];
    maxChats?: number;
  }): Promise<Agent | null> {
    // For now, return a mock response
    return {
      id: 'agent-new',
      name: data.name,
      email: data.email,
      role: data.role || 'agent',
      skills: data.skills || [],
      isActive: true,
      isOnline: false,
      maxChats: data.maxChats || 5,
      currentChats: 0
    };
  }
}

export const agentService = AgentService.getInstance();