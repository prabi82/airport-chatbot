import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!isInitialized) {
    try {
      console.log('🔄 Initializing Prisma client...');
      prisma = new PrismaClient({
        log: ['error', 'warn'],
        errorFormat: 'minimal',
      });
      isInitialized = true;
      console.log('✅ Prisma client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Prisma client:', error);
      initializationError = error as Error;
      isInitialized = true;
      prisma = null;
    }
  }
  
  return prisma;
}

export function isDatabaseAvailable(): boolean {
  return getPrismaClient() !== null;
}

export function getDatabaseError(): Error | null {
  return initializationError;
}

// Safe database operations with fallback
export async function safeDbOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  fallback: T
): Promise<T> {
  const client = getPrismaClient();
  
  if (!client) {
    console.warn('⚠️ Database not available, using fallback');
    return fallback;
  }
  
  try {
    return await operation(client);
  } catch (error) {
    console.error('💥 Database operation failed:', error);
    return fallback;
  }
}

// Export the safe client
export const safePrisma = {
  chatSession: {
    findUnique: async (args: any) => {
      return safeDbOperation(
        (prisma) => prisma.chatSession.findUnique(args),
        null
      );
    },
    create: async (args: any) => {
      return safeDbOperation(
        (prisma) => prisma.chatSession.create(args),
        null
      );
    },
    update: async (args: any) => {
      return safeDbOperation(
        (prisma) => prisma.chatSession.update(args),
        null
      );
    }
  },
  chatMessage: {
    create: async (args: any) => {
      return safeDbOperation(
        (prisma) => prisma.chatMessage.create(args),
        null
      );
    }
  },
  knowledgeBase: {
    findMany: async (args: any) => {
      return safeDbOperation(
        (prisma) => prisma.knowledgeBase.findMany(args),
        []
      );
    }
  }
};

export default getPrismaClient; 