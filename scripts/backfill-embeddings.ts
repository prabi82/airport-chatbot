import 'dotenv/config';
import { prisma } from '../src/lib/database';
import { getEmbedding } from '../src/lib/embedding-service';

async function main() {
  const allEntries = await prisma.$queryRawUnsafe<Array<{ id: string; question: string; answer: string; embedding: any }>>(
    'SELECT id, question, answer, embedding FROM knowledge_base WHERE "isActive" = true;'
  );

  const entries = allEntries.filter((e) => !e.embedding);

  console.log(`Found ${entries.length} knowledge entries without embeddings.`);

  for (const entry of entries) {
    const text = `${entry.question}\n${entry.answer}`;
    const vector = await getEmbedding(text);

    if (vector.length === 0) {
      console.warn(`Skipping ${entry.id} – embedding generation failed.`);
      continue;
    }

    // Convert to pgvector string literal
    const vectorLiteral = `[${vector.join(',')}]`;

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE knowledge_base SET embedding = '${vectorLiteral}'::vector WHERE id = '${entry.id}'`
      );
      console.log(`Updated embedding for ${entry.id}`);
    } catch (err) {
      console.error(`Failed to update ${entry.id}:`, err);
    }
  }

  console.log('Backfill complete.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 