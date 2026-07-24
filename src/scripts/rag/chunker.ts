export interface Chunk {
  text: string;
}

export function headerAwareChunker(markdown: string, maxCharsPerChunk = 2000): Chunk[] {
  const lines = markdown.split('\n');
  const chunks: Chunk[] = [];
  
  let currentHeaders: { depth: number, text: string }[] = [];
  let currentSectionText = '';
  
  const getBreadcrumbs = () => {
    if (currentHeaders.length === 0) return '';
    return '[' + currentHeaders.map(h => h.text).join(' > ') + ']\n';
  };

  const pushCurrentSection = () => {
    if (currentSectionText.trim().length > 0) {
      const breadcrumbs = getBreadcrumbs();
      
      // If the section is too large, we must hard-chunk it to avoid context length overflow.
      // But we preserve the breadcrumbs for each sub-chunk.
      if (currentSectionText.length > maxCharsPerChunk) {
        // Fallback: Split by newline to avoid severing sentences or table rows
        const subLines = currentSectionText.split('\n');
        let currentSubChunk = '';

        for (const subLine of subLines) {
          if ((currentSubChunk.length + subLine.length + 1) > maxCharsPerChunk && currentSubChunk.trim().length > 0) {
            chunks.push({ text: breadcrumbs + currentSubChunk.trim() });
            currentSubChunk = '';
          }
          currentSubChunk += subLine + '\n';
        }
        
        if (currentSubChunk.trim().length > 0) {
          chunks.push({ text: breadcrumbs + currentSubChunk.trim() });
        }
      } else {
        chunks.push({ text: breadcrumbs + currentSectionText.trim() });
      }
    }
    currentSectionText = '';
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    
    if (headerMatch) {
      // Hit a new header. Push whatever we've collected so far.
      pushCurrentSection();
      
      const depth = headerMatch[1].length;
      const text = headerMatch[2].trim();
      
      // Update breadcrumb stack
      currentHeaders = currentHeaders.filter(h => h.depth < depth);
      currentHeaders.push({ depth, text });
    } else {
      currentSectionText += line + '\n';
    }
  }
  
  // Push the final section
  pushCurrentSection();
  
  // Filter out tiny chunks
  return chunks.filter(c => c.text.length > 20);
}
