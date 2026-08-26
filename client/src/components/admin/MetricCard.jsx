import React from 'react';

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'gold', trend }) {
  return (
    <div className="saas-metric-card">
      <div className={`metric-icon-box ${color}`}>
        <Icon size={22} />
      </div>
      <div className="metric-content">
        <span className="metric-title">{title}</span>
        <div className="metric-value-row">
          <span className="metric-val">{value}</span>
          {trend && <span className="metric-trend">{trend}</span>}
        </div>
        {subtitle && <span className="metric-sub">{subtitle}</span>}
      </div>
    </div>
  );
}
