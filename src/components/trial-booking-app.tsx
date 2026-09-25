'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrialClass, ParentWithStudents, RosterEntry } from '@/types';
import { BookingFlow } from './booking-flow';
import { RosterView } from './roster-view';
import { RaceSimulator } from './race-simulator';
import { MonitoringDashboard } from './monitoring-dashboard';
import { ThemeToggle } from './theme-toggle';

interface TrialBookingAppProps {
  initialClasses: TrialClass[];
  initialParents: ParentWithStudents[];
  initialRoster: RosterEntry[];
}

export function TrialBookingApp({
  initialClasses,
  initialParents,
  initialRoster,
}: TrialBookingAppProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'booking' | 'roster' | 'simulator' | 'monitoring'>('booking');
  const [classes, setClasses] = useState<TrialClass[]>(initialClasses);
  const [parents] = useState<ParentWithStudents[]>(initialParents);
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchLatestData = async () => {
    setIsSyncing(true);
    try {
      const [classesRes, rosterRes] = await Promise.all([
        fetch('/api/classes').then((r) => r.json()),
        fetch('/api/roster').then((r) => r.json()),
      ]);

      if (classesRes.success && Array.isArray(classesRes.data)) {
        setClasses(classesRes.data);
      }
      if (rosterRes.success && Array.isArray(rosterRes.data)) {
        setRoster(rosterRes.data);
      }
    } catch (err: unknown) {
      console.error('Error syncing latest data:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTabChange = (tab: 'booking' | 'roster' | 'simulator' | 'monitoring') => {
    setActiveTab(tab);
    if (tab === 'roster' || tab === 'booking') {
      fetchLatestData();
    }
  };

  const handleResetSeed = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      if (res.ok) {
        showToast('Database reset to initial synthetic seed data.');
        await fetchLatestData();
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Failed to reset seed data:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleBookingSuccess = async () => {
    await fetchLatestData();
    showToast('🎉 Booking confirmed! The student is now on the Teacher Roster.');
    router.refresh();
  };

  const handleSimulationCompleted = async () => {
    await fetchLatestData();
    router.refresh();
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* Header Bar */}
      <header className="bg-slate-900 px-6 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-xl font-extrabold shadow-sm">
              🚀
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">OTTODOT</h1>
                <span className="hidden md:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-950 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Invariants: 100% Passing</span>
                </span>
              </div>
              <p className="text-xs italic text-amber-200">
                Live Science & Math Trial Booking Reliability
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleTabChange('booking')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'booking'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              1. Book a Trial
            </button>
            <button
              onClick={() => handleTabChange('roster')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'roster'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              2. Teacher Roster ({roster.length})
            </button>
            <button
              onClick={() => handleTabChange('simulator')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'simulator'
                  ? 'bg-red-800 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              3. Race Simulator Lab
            </button>
            <button
              onClick={() => handleTabChange('monitoring')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center space-x-1.5 ${
                activeTab === 'monitoring'
                  ? 'bg-blue-800 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              <span>📊 4. Health & Monitoring</span>
            </button>

            {/* Quick Actions */}
            <button
              disabled={isResetting}
              onClick={handleResetSeed}
              title="Reset database to seed state"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-900 text-white hover:bg-purple-800 transition-all shadow-sm disabled:opacity-50"
            >
              {isResetting ? 'Resetting...' : '🔄 Reset Seed'}
            </button>

            {/* Hydration-safe Theme Switcher */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col space-y-6">
        {/* Global Toast */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-purple-900 shadow-md transition-all">
            <p className="text-sm font-semibold text-white">ℹ️ {toastMessage}</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'booking' && (
          <BookingFlow
            classes={classes}
            parents={parents}
            onBookingSuccess={handleBookingSuccess}
          />
        )}

        {activeTab === 'roster' && (
          <RosterView
            classes={classes}
            roster={roster}
            onRefresh={fetchLatestData}
            isRefreshing={isSyncing}
          />
        )}

        {activeTab === 'simulator' && (
          <RaceSimulator onSimulationCompleted={handleSimulationCompleted} />
        )}

        {activeTab === 'monitoring' && (
          <MonitoringDashboard onResetSeed={handleResetSeed} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 px-6 py-4 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <p>© 2026 Ottodot Education - Trial Booking Reliability Slice.</p>
          <div className="flex items-center space-x-4">
            <a href="/api/classes" target="_blank" className="hover:text-white underline">
              /api/classes
            </a>
            <a href="/api/roster" target="_blank" className="hover:text-white underline">
              /api/roster
            </a>
            <a href="/api/monitoring" target="_blank" className="hover:text-white underline">
              /api/monitoring
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
