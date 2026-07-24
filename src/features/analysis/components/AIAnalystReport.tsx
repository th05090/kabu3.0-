import React from 'react';

export interface AIReportData {
  current_performance: string;
  future_guidance: string;
  report_comparison: string;
  ai_comment: string;
}

interface Props {
  data: AIReportData;
}

export function AIAnalystReport({ data }: Props) {
  const formatText = (text: string) => {
    if (!text) return null;
    
    // AIが出力した長文を読みやすくするため、「。」で分割して段落（pタグ）として描画する
    // 「・」でsplitすると「原価改善・営業面」のような通常の単語結合までリスト化されて途切れてしまうため修正
    const sentences = text.split('。').filter(s => s.trim() !== '');
    
    return (
      <>
        {sentences.map((s, i) => (
          <p key={i} className="ai-text" style={{ marginBottom: '0.75rem', lineHeight: '1.6' }}>
            {s}。
          </p>
        ))}
      </>
    );
  };

  return (
    <div className="bento-card ai-dashboard card-full">
      <div className="ai-dashboard-header">
        <h2 className="ai-title">
          <span className="ai-icon">✨</span> AI 決算アナリストレポート (Gemma3:12B)
        </h2>
        <div className="ai-badge">厳密ファクトチェック済</div>
      </div>
      
      <div className="ai-grid">
        {/* 当期実績 */}
        <div className="ai-box performance">
          <div className="ai-box-header">
            <div className="ai-box-icon performance-icon">📊</div>
            <h3>当期実績の評価</h3>
          </div>
          <div className="ai-box-content">
            {formatText(data.current_performance)}
          </div>
        </div>

        {/* 次期見通し */}
        <div className="ai-box guidance">
          <div className="ai-box-header">
            <div className="ai-box-icon guidance-icon">🔮</div>
            <h3>次期見通し・リスク要因</h3>
          </div>
          <div className="ai-box-content">
            {formatText(data.future_guidance)}
          </div>
        </div>

        {/* 前回比較 */}
        <div className="ai-box comparison">
          <div className="ai-box-header">
            <div className="ai-box-icon comparison-icon">🔍</div>
            <h3>前回資料からのトーン変化</h3>
          </div>
          <div className="ai-box-content">
            {formatText(data.report_comparison)}
          </div>
        </div>

        {/* AI 総括 */}
        <div className="ai-box comment">
          <div className="ai-box-header">
            <div className="ai-box-icon comment-icon">🧠</div>
            <h3>証券アナリスト 総括オピニオン</h3>
          </div>
          <div className="ai-box-content">
            {formatText(data.ai_comment)}
          </div>
        </div>
      </div>
    </div>
  );
}
