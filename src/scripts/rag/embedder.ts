export const EMBED_MODEL = 'bge-m3:latest';

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBED_MODEL,
      prompt: text,
      options: { num_ctx: 8192 } // Ensure large context window is allowed for BGE-M3
    })
  });
  
  if (!res.ok) {
    throw new Error(`Embedding API Error: ${await res.text()}`);
  }
  
  const data = await res.json();
  return data.embedding;
}
