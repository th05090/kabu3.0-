'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SepaSortHeaderProps {
  field: string;
  currentSort: string | null;
  currentOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
}

export function SepaSortHeader({
  field,
  currentSort,
  currentOrder,
  onSort,
  children,
  align = 'left',
  className = '',
  style = {}
}: SepaSortHeaderProps) {
  const isActive = currentSort === field;

  const getIcon = () => {
    if (!isActive) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35 }} />;
    }
    return currentOrder === 'asc' ? (
      <ArrowUp size={13} style={{ color: '#818cf8' }} />
    ) : (
      <ArrowDown size={13} style={{ color: '#818cf8' }} />
    );
  };

  const justifyContent =
    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';

  return (
    <th
      className={`sortable ${isActive ? 'active' : ''} ${className}`}
      onClick={() => onSort(field)}
      title="クリックでソート切替 (降順 → 昇順 → 解除)"
      style={{
        textAlign: align,
        ...style
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent,
          width: align === 'left' ? 'auto' : '100%',
          gap: '0.25rem'
        }}
      >
        <span>{children}</span>
        <span className="sepa-sort-icon">{getIcon()}</span>
      </div>
    </th>
  );
}
