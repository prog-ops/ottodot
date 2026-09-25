'use client';

import React, { useState } from 'react';
import { TrialClass, RosterEntry } from '@/types';
import { FormattedTime } from './ui/formatted-time';

interface RosterViewProps {
  classes: TrialClass[];
  roster: RosterEntry[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function RosterView({
  classes,
  roster,
  onRefresh,
  isRefreshing = false,
}: RosterViewProps) {
  const [filterClassId, setFilterClassId] = useState<string>('all');

  const filteredRoster =
    filterClassId === 'all'
      ? roster
      : roster.filter((r) => r.trial_class_id === filterClassId);

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Bar Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const count = cls.confirmed_count ?? 0;
          const isFull = count >= cls.capacity;

          return (
            <div
              key={cls.id}
              onClick={() => setFilterClassId(cls.id)}
              className={`cursor-pointer rounded-3xl p-5 shadow-md transition-all flex flex-col space-y-3 ${
                filterClassId === cls.id
                  ? 'bg-emerald-950 ring-4 ring-emerald-500'
                  : 'bg-emerald-900 hover:bg-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  {cls.subject} Class
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-xl font-extrabold ${
                    isFull ? 'bg-red-800 text-white' : 'bg-emerald-950 text-white'
                  }`}
                >
                  {count} / {cls.capacity} Confirmed
                </span>
              </div>

              <h3 className="text-base font-bold text-white">{cls.title}</h3>
              <p className="text-xs italic text-emerald-100">
                Instructor: {cls.instructor_name}
              </p>

              {/* Capacity Visual Progress Meter */}
              <div className="w-full bg-emerald-950 rounded-full h-3 flex overflow-hidden">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 m-0.5 rounded-full ${
                      idx < count
                        ? isFull
                          ? 'bg-red-500'
                          : 'bg-amber-400'
                        : 'bg-emerald-900/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Controls & Invariant Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase text-slate-300">Filter Class:</span>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="bg-slate-800 text-xs font-bold rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="all">All Classes ({roster.length} confirmed students)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.confirmed_count}/4)
                </option>
              ))}
            </select>
          </div>

          {onRefresh && (
            <button
              disabled={isRefreshing}
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              <span>{isRefreshing ? '⏳' : '🔄'}</span>
              <span>{isRefreshing ? 'Syncing...' : 'Sync Roster'}</span>
            </button>
          )}
        </div>

        <div className="text-xs italic text-amber-200 flex items-center space-x-1">
          <span>🛡️</span>
          <span>Only students with confirmed payments appear on this official roster.</span>
        </div>
      </div>

      {/* Roster Cards Grid */}
      {filteredRoster.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoster.map((entry, idx) => (
            <div
              key={entry.booking_id}
              className="bg-slate-800 rounded-3xl p-5 shadow-md flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center font-bold text-sm text-white">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{entry.student_name}</h4>
                    <span className="text-xs text-slate-300">Age: {entry.student_age} years</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-800 text-white">
                  Confirmed
                </span>
              </div>

              <div className="text-xs flex flex-col space-y-1.5 text-slate-300 bg-slate-900/60 p-3 rounded-2xl">
                <p>
                  <strong>Class:</strong> {entry.class_title}
                </p>
                <p>
                  <strong>Parent:</strong> {entry.parent_name} ({entry.parent_email})
                </p>
                <p>
                  <strong>Confirmed At:</strong>{' '}
                  <FormattedTime isoString={entry.confirmed_at} className="font-semibold text-white" />
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-2">
          <span className="text-4xl">📋</span>
          <p className="text-base font-bold text-white">No confirmed students found</p>
          <p className="text-xs text-slate-300 italic">
            No bookings have been confirmed for this selection. (Pending payments do not appear here).
          </p>
        </div>
      )}
    </div>
  );
}
