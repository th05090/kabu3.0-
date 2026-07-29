'use client';

import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function NetworkGraph({ data }: { data: { nodes: any[], links: any[] } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 500,
      });
    }
  }, []);

  // Simple color mapping based on group (industry)
  const colors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', 
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', 
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', 
    '#aaffc3', '#808000', '#ffd8b0', '#000075', '#808080'
  ];
  
  const getGroupColor = (group: string) => {
    // Determine a stable index for the string
    let hash = 0;
    for (let i = 0; i < group.length; i++) {
      hash = group.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
      {data.nodes.length > 0 ? (
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeLabel={(node: any) => `${node.id} ${node.name}\n業種: ${node.group}`}
          nodeColor={(node: any) => getGroupColor(node.group)}
          nodeRelSize={4}
          linkColor={() => 'rgba(255, 255, 255, 0.2)'}
          linkWidth={(link: any) => link.similarity ? (link.similarity - 0.6) * 10 : 1}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-[var(--secondary)]">
          ネットワークグラフデータがありません
        </div>
      )}
    </div>
  );
}
