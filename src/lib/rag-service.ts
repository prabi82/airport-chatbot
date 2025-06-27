import { prisma } from './database';
import { getEmbedding } from './embedding-service';

export interface VectorKnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sourceUrl: string | null;
  relevanceScore: number;
}

/**
 * Retrieve the most relevant knowledge base entries for a given query using
 * pgvector similarity search. Falls back to an empty array if embeddings are
 * unavailable or the database query fails.
 *
 * @param query - The user question text
 * @param topK  - Number of results to return (default 5)
 */
export async function getRelevantKnowledgeEntries(
  query: string,
  topK: number = 5
): Promise<VectorKnowledgeEntry[]> {
  // Generate query embedding
  const embedding = await getEmbedding(query);
  if (embedding.length === 0) return [];

  // Convert embedding array to pgvector literal e.g. '[0.1,0.2,...]'
  const embeddingLiteral = `[${embedding.join(',')}]`;

  try {
    const results = await prisma.$queryRawUnsafe<VectorKnowledgeEntry[]>(
      `SELECT id, question, answer, category, "sourceUrl", 1 - (embedding <=> '${embeddingLiteral}') AS "relevanceScore"
       FROM knowledge_base
       WHERE "isActive" = true AND embedding IS NOT NULL
       ORDER BY embedding <=> '${embeddingLiteral}'
       LIMIT ${topK};`
    );

    return results.filter(r => r.relevanceScore >= 0.8);
  } catch (err) {
    console.error('[RAGService] Vector search failed:', err);
    return [];
  }
} 