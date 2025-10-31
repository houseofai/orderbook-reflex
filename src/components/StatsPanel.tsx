// StatsPanel.tsx

import React from "react";
import { SIGNAL_COLOR, ERROR_COLOR } from "../constants";

interface HistoryEntry {
  dir: string;
  sigPrice: number;
  userPrice: number;
  rt: number;
  ok: boolean;
}

interface Stats {
  avgReactionTime: number;
  successRate: number;
  avgPriceDiff: number;
  totalTrades: number;
  successfulTrades: number;
}

interface StatsPanelProps {
  reactionWindow: number;
  lastRt: number | null;
  history: HistoryEntry[];
  maxHistoryRows?: number; // Not used anymore but kept for compatibility
  stats: Stats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  reactionWindow,
  lastRt,
  history,
  stats,
}) => {
  // Prepare data for graph - last 20 entries
  const graphData = history.slice(-20);
  const maxDisplayTime = Math.max(reactionWindow * 1.5, 0.5); // Show at least 500ms

  // Graph dimensions
  const graphWidth = 180;
  const graphHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const plotWidth = graphWidth - padding.left - padding.right;
  const plotHeight = graphHeight - padding.top - padding.bottom;

  return (
    <div className="stats-panel">
      <div className="stats-section">
        <div className="stat-item">
          <span className="stat-label">Window:</span>
          <span style={{ color: SIGNAL_COLOR }}>
            {(reactionWindow * 1000).toFixed(0)}ms
          </span>
        </div>

        {lastRt !== null && (
          <div className="stat-item">
            <span className="stat-label">Last RT:</span>
            <span
              style={{
                color: lastRt <= reactionWindow ? SIGNAL_COLOR : ERROR_COLOR,
              }}
            >
              {(lastRt * 1000).toFixed(0)}ms
            </span>
          </div>
        )}

        <div className="stat-item">
          <span className="stat-label">Avg RT:</span>
          <span style={{ color: SIGNAL_COLOR }}>
            {(stats.avgReactionTime * 1000).toFixed(0)}ms
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Success:</span>
          <span
            style={{
              color: stats.successRate >= 80 ? SIGNAL_COLOR : stats.successRate >= 50 ? "rgb(255, 200, 0)" : ERROR_COLOR,
            }}
          >
            {stats.successRate.toFixed(1)}%
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Trades:</span>
          <span style={{ color: "rgb(255, 255, 255)" }}>
            {stats.successfulTrades}/{stats.totalTrades}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Avg Diff:</span>
          <span style={{ color: "rgb(255, 255, 255)" }}>
            ${stats.avgPriceDiff.toFixed(3)}
          </span>
        </div>
      </div>

      <div className="graph-section">
        <div className="graph-header">Reaction Time History</div>
        <svg className="rt-graph" width={graphWidth} height={graphHeight}>
          {/* Y-axis labels */}
          <text x={5} y={padding.top + 5} fontSize={9} fill="rgb(180, 180, 180)">
            {(maxDisplayTime * 1000).toFixed(0)}
          </text>
          <text x={5} y={graphHeight - padding.bottom - 5} fontSize={9} fill="rgb(180, 180, 180)">
            0
          </text>

          {/* Plot area background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="rgb(35, 35, 35)"
            stroke="rgb(80, 80, 80)"
            strokeWidth={1}
          />

          {/* Window threshold line */}
          {(() => {
            const windowY = padding.top + plotHeight - (reactionWindow / maxDisplayTime) * plotHeight;
            return (
              <>
                <line
                  x1={padding.left}
                  y1={windowY}
                  x2={padding.left + plotWidth}
                  y2={windowY}
                  stroke="rgb(255, 200, 0)"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
                <text
                  x={padding.left + plotWidth - 25}
                  y={windowY - 3}
                  fontSize={8}
                  fill="rgb(255, 200, 0)"
                >
                  {(reactionWindow * 1000).toFixed(0)}
                </text>
              </>
            );
          })()}

          {/* Reaction time bars */}
          {graphData.map((entry, idx) => {
            const barWidth = Math.max(plotWidth / Math.max(graphData.length, 20) - 1, 3);
            const x = padding.left + (idx / Math.max(graphData.length - 1, 1)) * (plotWidth - barWidth);
            const normalizedRt = Math.min(entry.rt, maxDisplayTime);
            const barHeight = (normalizedRt / maxDisplayTime) * plotHeight;
            const y = padding.top + plotHeight - barHeight;
            const color = entry.ok ? SIGNAL_COLOR : ERROR_COLOR;

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                fill={color}
                opacity={0.8}
              />
            );
          })}

          {/* X-axis label */}
          <text
            x={graphWidth / 2}
            y={graphHeight - 2}
            fontSize={9}
            fill="rgb(180, 180, 180)"
            textAnchor="middle"
          >
            Last {graphData.length} trades
          </text>
        </svg>
      </div>
    </div>
  );
};
