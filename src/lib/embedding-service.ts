/**
 * Generate vector embeddings for a given text using Google Generative AI
 * (Gemini) Embedding model. Falls back to a local Ollama instance if the
 * `GEMINI_API_KEY` is missing.
 *
 * API reference:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=API_KEY
 *   Body: { "content": { "parts": [ { "text": "…" } ] } }
 */

export async function getEmbedding(text: string): Promise<number[]> {
  const cleaned = text?.trim();
  if (!cleaned) return [];

  // Prefer Gemini embeddings if the API key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ text: cleaned }]
          }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini embedding error: ${resp.status} - ${errText}`);
      }

      const data = (await resp.json()) as { embedding?: { values: number[] } };
      const values = data?.embedding?.values;
      if (Array.isArray(values)) return values;
    } catch (err) {
      console.error('[EmbeddingService] Gemini embedding failed – falling back:', err);
    }
  }

  // Fallback: local Ollama embedding (requires running server)
  try {
    const ollama = await import('ollama');
    const response = await ollama.default.embeddings({
      model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
      prompt: cleaned
    });
    if (response && Array.isArray(response.embedding)) {
      return response.embedding as number[];
    }
  } catch (err) {
    console.error('[EmbeddingService] Ollama embedding failed:', err);
  }

  return [];
} 