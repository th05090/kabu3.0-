export const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function askRerankLLM(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120,000ms = 2 minutes

  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma4:12b",
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`LLM API Error: ${res.status}`);
    const json = await res.json();
    return json.response.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function askGeminiLLM(prompt: string, schema?: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  
  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
    }
  };
  
  if (schema) {
    payload.generationConfig.response_mime_type = "application/json";
    payload.generationConfig.response_schema = schema;
  }
  
  const modelName = process.env.GEMINI_AUDIT_MODEL || 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  // Rate limit protection (4 seconds wait) for free tier (15 RPM)
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error: ${res.status} - ${errText}`);
  }
  
  const json = await res.json();
  if (!json.candidates || json.candidates.length === 0) {
    throw new Error("Gemini returned empty candidates");
  }
  const text = json.candidates[0].content.parts[0].text;
  
  if (schema) {
    return JSON.parse(text);
  }
  return text.trim();
}
