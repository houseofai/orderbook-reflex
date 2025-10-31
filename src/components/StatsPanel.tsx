// StatsPanel.tsx

import React from "react";
import { SIGNAL_COLOR, ERROR_COLOR, TEXT_COLOR } from "../constants";

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
  maxHistoryRows: number;
  stats: Stats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  reactionWindow,
  lastRt,
  history,
  maxHistoryRows,
  stats,
}) => {
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

      <div className="history-section">
        <div className="history-header" style={{ color: TEXT_COLOR }}>
          DIR  SIG     USER
        </div>
        {history.slice(-maxHistoryRows).reverse().map((entry, idx) => (
          <div
            key={idx}
            className="history-row"
            style={{
              color: entry.ok ? SIGNAL_COLOR : ERROR_COLOR,
            }}
          >
            {entry.dir.padStart(4, " ")} {entry.sigPrice.toFixed(2).padStart(7, " ")}{" "}
            {entry.userPrice.toFixed(2).padStart(7, " ")}
          </div>
        ))}
      </div>
    </div>
  );
};
