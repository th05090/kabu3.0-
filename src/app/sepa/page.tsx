import React from 'react';
import { SepaDashboard } from '../../features/sepa/components/SepaDashboard';

export const metadata = {
  title: 'SEPA (ミネルヴィニ分析) | kabu3.0',
  description: 'Mark Minervini SEPA (Specific Entry Point Analysis) 成長株スクリーニング & 診断',
};

export default function SepaPage() {
  return (
    <div className="sepa-page-wrapper">
      <div className="sepa-container">
        <SepaDashboard />
      </div>
    </div>
  );
}
