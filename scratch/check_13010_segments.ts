import { QdrantClient } from "@qdrant/js-client-rest";

async function run() {
  const qdrant = new QdrantClient({ url: "http://localhost:6333" });
  try {
    const res = await qdrant.scroll("earnings_reports", {
      filter: { must: [{ key: "ticker", match: { value: "13010" } }] },
      limit: 10,
      with_payload: true,
      with_vector: false
    });
    
    console.log(`Found ${res.points.length} chunks for 13010 (極洋).`);
    for (const p of res.points) {
      if (p.payload && p.payload.text) {
        // Print the first 200 characters of each chunk to get an idea of the contents
        const snippet = String(p.payload.text).substring(0, 300).replace(/\n/g, ' ');
        console.log(`- ${snippet}...`);
        
        // Let's also check if it contains segment keywords
        if (snippet.includes("売上") || snippet.includes("セグメント")) {
          console.log("  => CONTAINS SEGMENT INFO!");
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
