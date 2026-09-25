'use client';

import React, { useState } from 'react';
import { RaceSimulationLog, RaceSimulationResponse } from '@/types';
import { FormattedTime } from './ui/formatted-time';

interface RaceSimulatorProps {
  onSimulationCompleted: () => void;
}

export function RaceSimulator({ onSimulationCompleted }: RaceSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<RaceSimulationLog[]>([]);
  const [summary, setSummary] = useState<RaceSimulationResponse | null>(null);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setLogs([]);
    setSummary(null);

    try {
      const res = await fetch('/api/simulate-race', { method: 'POST' });
      const data = (await res.json()) as RaceSimulationResponse;
      setLogs(data.logs || []);
      setSummary(data);
      onSimulationCompleted();
    } catch (err: unknown) {
      console.error('Race simulation error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header Lab Card (Deep Red Block) */}
      <div className="bg-red-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🏎️</span>
            <div>
              <h2 className="text-xl font-bold text-white">Last-Seat Race Condition Live Simulator</h2>
              <p className="text-xs italic text-red-200">
                Technical Scenario: User A & User B compete concurrently for the 4th and final seat!
              </p>
            </div>
          </div>

          <button
            disabled={isRunning}
            onClick={handleRunSimulation}
            className={`px-6 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-md ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 animate-pulse'
            }`}
          >
            {isRunning ? 'Running Atomic Race...' : '🚀 Execute Live Race Simulation'}
          </button>
        </div>

        {/* Scenario Explanation */}
        <div className="bg-red-950 rounded-2xl p-4 text-xs flex flex-col space-y-2 text-red-100">
          <span className="font-bold text-amber-300 uppercase tracking-wider">Scenario Test Sequence:</span>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Target:</strong> "Speed Math" (starts with 3 confirmed students, 1 seat remaining).</li>
            <li><strong>User A (Parent Barry Allen for Iris):</strong> Selects last slot & moves to payment screen.</li>
            <li><strong>User B (Parent Sarah Connor for Mia):</strong> Selects the same slot simultaneously.</li>
            <li><strong>User B Completes Payment First:</strong> Confirms seat 4 atomically!</li>
            <li><strong>User A Tries to Complete Payment:</strong> Transaction acquires lock, detects 4/4 seats filled, and SAFELY REJECTS User A.</li>
          </ol>
        </div>
      </div>

      {/* Results / Live Telemetry Logs */}
      {logs.length > 0 && (
        <div className="bg-slate-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>📡</span>
              <span>Server Execution & Concurrency Telemetry</span>
            </h3>
            {summary && (
              <span
                className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                  summary.invariant_passed
                    ? 'bg-emerald-800 text-white'
                    : 'bg-red-800 text-white'
                }`}
              >
                {summary.invariant_passed ? '✓ INVARIANT PRESERVED: ROSTER = 4/4' : '✗ INVARIANT BREACHED'}
              </span>
            )}
          </div>

          {/* Timeline Log Entries */}
          <div className="flex flex-col space-y-2.5">
            {logs.map((log) => {
              const badgeBg =
                log.actor === 'User A'
                  ? 'bg-amber-700'
                  : log.actor === 'User B'
                  ? 'bg-emerald-700'
                  : 'bg-purple-800';

              const itemBg =
                log.status === 'success'
                  ? 'bg-slate-800/90'
                  : log.status === 'error'
                  ? 'bg-red-950/80'
                  : log.status === 'warning'
                  ? 'bg-amber-950/70'
                  : 'bg-slate-800/50';

              return (
                <div
                  key={log.step}
                  className={`rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${itemBg}`}
                >
                  <div className="flex items-start sm:items-center space-x-3">
                    <span className={`px-2.5 py-1 rounded-lg text-white font-bold shrink-0 ${badgeBg}`}>
                      {log.actor}
                    </span>
                    <span className="font-semibold text-white">{log.action}</span>
                  </div>
                  <FormattedTime
                    isoString={log.timestamp}
                    className="text-slate-400 font-mono text-[10px] self-end sm:self-center"
                  />
                </div>
              );
            })}
          </div>

          {/* Final Roster Snapshot */}
          {summary?.roster && (
            <div className="bg-slate-950 p-4 rounded-2xl mt-2 flex flex-col space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Final Verified Roster for "Speed Math":
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {summary.roster.map((r, i) => (
                  <div key={r.booking_id} className="bg-slate-800 p-3 rounded-xl text-xs flex flex-col space-y-1">
                    <span className="font-bold text-amber-300">Seat #{i + 1}: {r.student_name}</span>
                    <span className="text-[11px] text-slate-300">Parent: {r.parent_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
