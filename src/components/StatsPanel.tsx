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

interface StatsPanelProps {
  reactionWindow: number;
  lastRt: number | null;
  history: HistoryEntry[];
  maxHistoryRows: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  reactionWindow,
  lastRt,
  history,
  maxHistoryRows,
}) => {
  return (
    <div className="stats-panel">
      <div className="stat-item">
        <span style={{ color: SIGNAL_COLOR }}>
          Wnd: {(reactionWindow * 1000).toFixed(0)}ms
        </span>
      </div>

      {lastRt !== null && (
        <div className="stat-item" style={{ marginTop: "30px" }}>
          <span
            style={{
              color: lastRt <= reactionWindow ? SIGNAL_COLOR : ERROR_COLOR,
            }}
          >
            Last: {(lastRt * 1000).toFixed(0)}ms
          </span>
        </div>
      )}

      <div className="history-section" style={{ marginTop: "35px" }}>
        <div className="history-header" style={{ color: TEXT_COLOR }}>
          DIR  SIG     USER
        </div>
        {history.slice(-maxHistoryRows).reverse().map((entry, idx) => (
          <div
            key={idx}
            className="history-row"
            style={{
              color: entry.ok ? SIGNAL_COLOR : ERROR_COLOR,
              marginTop: "15px",
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
