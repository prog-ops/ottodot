'use client';

import React, { useState, useEffect } from 'react';
import { SystemMetrics } from '@/types';

interface MonitoringDashboardProps {
  onResetSeed?: () => void;
}

export function MonitoringDashboard({ onResetSeed }: MonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/monitoring');
      const json = await res.json();
      if (json.success && json.data) {
        setMetrics(json.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch system metrics:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchMetrics();
    const interval = setInterval(() => {
      fetchMetrics();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="bg-slate-900 rounded-2xl p-8 text-center shadow-lg">
        <div className="animate-spin text-3xl inline-block mb-3">⚙️</div>
        <p className="text-white font-bold text-lg">Gathering System Telemetry & Invariants...</p>
        <p className="text-slate-300 text-sm mt-1">Inspecting row locks, duplicate constraints, and capacity limits.</p>
      </div>
    );
  }

  const allPass = metrics.invariants.all_invariants_pass;

  return (
    <div className="space-y-6">
      {/* 1. Invariants Health Hero Banner */}
      <div
        className={`rounded-2xl p-6 shadow-md ${
          allPass ? 'bg-emerald-900' : 'bg-red-900'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black">
              {allPass ? '🛡️' : '⚠️'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase tracking-wider font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full text-white">
                  Invariant Health Status
                </span>
                <span className="text-xs text-white/80 font-mono">
                  {mounted && lastUpdated ? `Updated: ${lastUpdated}` : 'Live'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">
                {allPass ? 'ALL INVARIANTS PASSING: 100% HEALTHY' : 'INVARIANT VIOLATION DETECTED'}
              </h2>
              <p className="text-sm text-emerald-100 font-medium">
                {allPass
                  ? 'Capacity caps (max 4), duplicate prevention, and transactional atomicity are actively verified.'
                  : 'System invariants have been violated. Immediate remediation required.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchMetrics(true)}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm transition-all shadow-sm disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
            {onResetSeed && (
              <button
                onClick={onResetSeed}
                className="px-4 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-sm transition-all shadow-sm"
              >
                ↺ Reset Synthetic Seed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Core Invariant Safeguard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Guard 1: Overbooking */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Capacity Guard (Cap: 4)
            </span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-md ${
                metrics.invariants.overbooked_classes_count === 0
                  ? 'bg-emerald-900 text-emerald-100'
                  : 'bg-red-800 text-white'
              }`}
            >
              {metrics.invariants.overbooked_classes_count === 0 ? '0 VIOLATIONS' : 'FAIL'}
            </span>
          </div>
          <div className="text-3xl font-black text-white">
            {metrics.invariants.overbooked_classes_count}
          </div>
          <p className="text-xs text-slate-300 mt-2">
            Enforced by PostgreSQL <code className="text-amber-300 font-mono">SELECT ... FOR UPDATE</code> exclusive locks.
          </p>
        </div>

        {/* Guard 2: Duplicate Prevention */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Duplicate Guard
            </span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-md ${
                metrics.invariants.duplicate_confirmed_count === 0
                  ? 'bg-emerald-900 text-emerald-100'
                  : 'bg-red-800 text-white'
              }`}
            >
              {metrics.invariants.duplicate_confirmed_count === 0 ? '0 DUPLICATES' : 'FAIL'}
            </span>
          </div>
          <div className="text-3xl font-black text-white">
            {metrics.invariants.duplicate_confirmed_count}
          </div>
          <p className="text-xs text-slate-300 mt-2">
            Enforced by partial unique index <code className="text-amber-300 font-mono">idx_unique_confirmed_booking</code>.
          </p>
        </div>

        {/* Guard 3: Database Engine */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Storage Engine
            </span>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-900 text-blue-100">
              {metrics.database === 'supabase' ? 'SUPABASE' : 'LOCAL ACID'}
            </span>
          </div>
          <div className="text-xl font-black text-white capitalize mt-1">
            {metrics.database === 'supabase' ? 'PostgreSQL Remote' : 'In-Memory Mutex Store'}
          </div>
          <p className="text-xs text-slate-300 mt-2">
            {metrics.database === 'supabase'
              ? 'Stored procedure RPC with ACID transactions & row-level locking active.'
              : 'Zero-dependency mutex lock engine mimicking Postgres transaction guarantees.'}
          </p>
        </div>
      </div>

      {/* 3. Operational & Capacity Funnel Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Capacity Utilization */}
        <div className="bg-amber-900 rounded-2xl p-5 shadow-sm text-white">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Capacity Utilization
          </span>
          <div className="text-3xl font-black mt-1">
            {metrics.stats.capacity_utilization_percent}%
          </div>
          <div className="w-full bg-amber-950/60 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-amber-300 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.stats.capacity_utilization_percent)}%` }}
            />
          </div>
          <p className="text-xs text-amber-200 mt-2">
            {metrics.stats.total_confirmed_students} of {metrics.stats.total_capacity} seats taken
          </p>
        </div>

        {/* Confirmed Bookings */}
        <div className="bg-emerald-900 rounded-2xl p-5 shadow-sm text-white">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
            Confirmed Students
          </span>
          <div className="text-3xl font-black mt-1">
            {metrics.stats.bookings_by_status.confirmed}
          </div>
          <p className="text-xs text-emerald-200 mt-2">
            Eligible for live teacher roster
          </p>
        </div>

        {/* Failed / Pending Checkout */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-sm text-white">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Checkout Funnel
          </span>
          <div className="flex items-baseline space-x-3 mt-1">
            <span className="text-2xl font-black text-amber-400">
              {metrics.stats.bookings_by_status.pending_payment}
            </span>
            <span className="text-xs text-slate-300">pending</span>
            <span className="text-2xl font-black text-red-400">
              {metrics.stats.bookings_by_status.payment_failed}
            </span>
            <span className="text-xs text-slate-300">failed</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            Failed payments never touch roster
          </p>
        </div>

        {/* Race Condition Conflicts */}
        <div className="bg-red-900 rounded-2xl p-5 shadow-sm text-white">
          <span className="text-xs font-bold uppercase tracking-wider text-red-200">
            Race Conflicts Blocked
          </span>
          <div className="text-3xl font-black mt-1">
            {metrics.stats.race_condition_conflicts}
          </div>
          <p className="text-xs text-red-200 mt-2">
            Double-booking attempts prevented
          </p>
        </div>
      </div>

      {/* 4. Live Gateway Audit Log */}
      <div className="bg-slate-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-white">Recent Payment Gateway Audit Log</h3>
            <p className="text-xs text-slate-300">
              Immutable ledger of payment attempts and race outcome telemetry
            </p>
          </div>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-xl font-bold font-mono">
            {metrics.stats.total_payment_attempts} Total Attempts
          </span>
        </div>

        {metrics.recent_payment_attempts.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm font-medium">
            No payment attempts logged yet. Try booking a class or running the Race Simulator!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Transaction ID</th>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-xl">Outcome / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-white font-medium">
                {metrics.recent_payment_attempts.map((attempt) => {
                  const isSuccess = attempt.status === 'succeeded';
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {attempt.transaction_id || attempt.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {attempt.booking_id}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-300">
                        ${(attempt.amount_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-emerald-900 text-emerald-100'
                              : 'bg-red-900 text-red-100'
                          }`}
                        >
                          {attempt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {attempt.failure_reason ? (
                          <span className="text-red-300 font-semibold">
                            {attempt.failure_reason}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">
                            ✓ Seat confirmed atomically
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
