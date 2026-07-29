import { Metadata } from 'next';
import { ThemeDiscoveryLayout } from '@/features/themes/components/ThemeDiscoveryLayout';

export const metadata: Metadata = {
  title: 'Theme Discovery | kabu3.0',
  description: 'AI-powered theme discovery and stock network graph',
};

export default function ThemesPage() {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ThemeDiscoveryLayout />
    </div>
  );
}
