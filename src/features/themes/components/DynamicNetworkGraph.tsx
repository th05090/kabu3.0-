import dynamic from 'next/dynamic';

const DynamicNetworkGraph = dynamic(() => import('./NetworkGraph'), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--secondary)]">Loading Network Graph...</div>
});

export default DynamicNetworkGraph;
