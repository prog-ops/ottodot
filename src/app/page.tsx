'use client';

import React, { useState, useEffect } from 'react';
import { TrialClass, RosterEntry, BookingResult } from '@/types';

interface ParentWithStudents {
  id: string;
  name: string;
  email: string;
  phone?: string;
  students: Array<{
    id: string;
    parent_id: string;
    name: string;
    age: number;
  }>;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'booking' | 'roster' | 'simulator'>('booking');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Data states
  const [classes, setClasses] = useState<TrialClass[]>([]);
  const [parents, setParents] = useState<ParentWithStudents[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow States
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [pendingBooking, setPendingBooking] = useState<any | null>(null);
  const [bookingMessage, setBookingMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<BookingResult | null>(null);

  // Simulator States
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<any[]>([]);
  const [simulationSummary, setSimulationSummary] = useState<any | null>(null);

  // Filter roster by class
  const [rosterFilterClassId, setRosterFilterClassId] = useState<string>('all');

  // Toggle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Initial Fetch
  const loadData = async () => {
    setLoading(true);
    try {
      const [classesRes, parentsRes, rosterRes] = await Promise.all([
        fetch('/api/classes').then(r => r.json()),
        fetch('/api/parents').then(r => r.json()),
        fetch('/api/roster').then(r => r.json()),
      ]);

      if (classesRes.success) setClasses(classesRes.data);
      if (parentsRes.success) {
        setParents(parentsRes.data);
        if (parentsRes.data.length > 0 && !selectedParentId) {
          setSelectedParentId(parentsRes.data[0].id);
          if (parentsRes.data[0].students.length > 0) {
            setSelectedStudentId(parentsRes.data[0].students[0].id);
          }
        }
      }
      if (rosterRes.success) setRoster(rosterRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update selected child when parent changes
  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId);
    const parent = parents.find(p => p.id === parentId);
    if (parent && parent.students.length > 0) {
      setSelectedStudentId(parent.students[0].id);
    } else {
      setSelectedStudentId('');
    }
  };

  // Step 1: Submit Booking Reservation
  const handleReserve = async () => {
    if (!selectedClassId || !selectedStudentId || !selectedParentId) {
      setBookingMessage({ text: 'Please pick a trial class and student.', type: 'error' });
      return;
    }

    setIsReserving(true);
    setBookingMessage(null);
    setPaymentResult(null);

    try {
      const res = await fetch('/api/bookings/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trial_class_id: selectedClassId,
          student_id: selectedStudentId,
          parent_id: selectedParentId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPendingBooking(data.booking);
        setBookingMessage({
          text: 'Seat slot reserved with status "pending_payment". Please confirm payment.',
          type: 'success',
        });
      } else {
        setBookingMessage({
          text: data.message || 'Failed to reserve seat.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setBookingMessage({ text: err.message || 'Network error', type: 'error' });
    } finally {
      setIsReserving(false);
      loadData();
    }
  };

  // Step 2: Process Mock Payment
  const handlePayment = async (outcome: 'success' | 'failure') => {
    if (!pendingBooking) return;

    setIsPaying(true);
    setBookingMessage(null);

    try {
      const res = await fetch('/api/bookings/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: pendingBooking.id,
          simulate_outcome: outcome,
          payment_token: `mock_tok_${Date.now()}`,
        }),
      });

      const data = await res.json();
      setPaymentResult(data);

      if (res.ok && data.success) {
        setBookingMessage({
          text: '🎉 Payment Confirmed! Your child is now on the official roster.',
          type: 'success',
        });
        setPendingBooking(null);
      } else {
        setBookingMessage({
          text: `Payment unsuccessful: ${data.message}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setBookingMessage({ text: err.message || 'Payment error', type: 'error' });
    } finally {
      setIsPaying(false);
      loadData();
    }
  };

  // Reset Seed Database
  const handleResetSeed = async () => {
    try {
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPendingBooking(null);
        setPaymentResult(null);
        setBookingMessage({ text: 'Database reset to initial synthetic seed data.', type: 'info' });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run Race Simulation
  const handleRunSimulation = async () => {
    setSimulationRunning(true);
    setSimulationLogs([]);
    setSimulationSummary(null);

    try {
      const res = await fetch('/api/simulate-race', { method: 'POST' });
      const data = await res.json();
      setSimulationLogs(data.logs || []);
      setSimulationSummary(data);
      loadData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSimulationRunning(false);
    }
  };

  const currentSelectedParent = parents.find(p => p.id === selectedParentId);
  const currentSelectedClass = classes.find(c => c.id === selectedClassId);

  const filteredRoster = rosterFilterClassId === 'all'
    ? roster
    : roster.filter(r => r.trial_class_id === rosterFilterClassId);

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
              <h1 className="text-xl font-bold tracking-tight text-white">OTTODOT</h1>
              <p className="text-xs italic text-amber-200">Live Science & Math Trial Booking Reliability</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('booking')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'booking' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              1. Book a Trial
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'roster' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              2. Teacher Roster
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === 'simulator' ? 'bg-red-800 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              3. Race Simulator Lab
            </button>

            {/* Quick Actions */}
            <button
              onClick={handleResetSeed}
              title="Reset database to seed state"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-900 text-white hover:bg-purple-800 transition-all shadow-sm"
            >
              🔄 Reset Seed
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Light / Dark Mode"
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-all shadow-sm"
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col space-y-6">

        {/* Global Notification Banner */}
        {bookingMessage && (
          <div
            className={`p-4 rounded-2xl shadow-md transition-all ${
              bookingMessage.type === 'success'
                ? 'bg-emerald-800'
                : bookingMessage.type === 'error'
                ? 'bg-red-900'
                : 'bg-blue-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">
                {bookingMessage.type === 'success' ? '✅' : bookingMessage.type === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <p className="text-sm font-semibold">{bookingMessage.text}</p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: PARENT TRIAL BOOKING FLOW */}
        {/* ========================================================================= */}
        {activeTab === 'booking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form & Selection */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              
              {/* Card 1: Family Selection (Deep Yellow/Amber Block) */}
              <div className="bg-amber-800 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">👨‍👩‍👦</span>
                  <h2 className="text-lg font-bold">Step 1: Pick Parent & Child</h2>
                </div>
                <p className="text-xs italic text-amber-100">
                  Select a parent from seed data to test duplicate bookings or new trial reservations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Parent Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-white">
                      Parent
                    </label>
                    <select
                      value={selectedParentId}
                      onChange={(e) => handleParentChange(e.target.value)}
                      className="w-full bg-amber-900 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                    >
                      {parents.map((p) => (
                        <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                          {p.name} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-white">
                      Child (Student)
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-amber-900 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                    >
                      {currentSelectedParent?.students.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                          {s.name} (Age {s.age})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Helpful seed hints */}
                <div className="bg-amber-900/60 rounded-2xl p-3 text-xs flex flex-col space-y-1">
                  <span className="font-bold">💡 Edge Case Testing Hints:</span>
                  <p className="italic">
                    • <strong>Sarah Connor & John Connor:</strong> Already confirmed in Class 1. Selecting Class 1 will trigger the duplicate booking prevention check!
                  </p>
                  <p className="italic">
                    • <strong>Bruce Wayne & Damian Wayne:</strong> Ready to book available or competing seats.
                  </p>
                </div>
              </div>

              {/* Card 2: Pick Trial Class (Deep Blue Block) */}
              <div className="bg-blue-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🧪</span>
                    <h2 className="text-lg font-bold">Step 2: Choose a Trial Class</h2>
                  </div>
                  <span className="text-xs font-bold bg-blue-950 px-3 py-1 rounded-xl">
                    Strict Cap: 4 Kids / Class
                  </span>
                </div>
                <p className="text-xs italic text-blue-100">
                  Real-time seat counters reflect confirmed bookings. Overbooking is rejected automatically.
                </p>

                {/* Class List */}
                <div className="flex flex-col space-y-3 pt-2">
                  {classes.map((cls) => {
                    const isSelected = selectedClassId === cls.id;
                    const isFull = (cls.confirmed_count ?? 0) >= cls.capacity;
                    const isRaceCandidate = cls.id === 'class-race-3';

                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`cursor-pointer rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-950 ring-4 ring-amber-400'
                            : 'bg-blue-800 hover:bg-blue-700'
                        }`}
                      >
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-base font-bold">{cls.title}</span>
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-900 font-bold uppercase">
                              {cls.subject}
                            </span>
                          </div>
                          <p className="text-xs text-blue-200">
                            Instructor: <span className="font-semibold text-white">{cls.instructor_name}</span> • Fee: ${(cls.price_cents / 100).toFixed(2)}
                          </p>
                        </div>

                        <div className="flex items-center space-x-3 self-end sm:self-center">
                          {/* Capacity Badge */}
                          <div
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-sm ${
                              isFull
                                ? 'bg-red-900 text-white'
                                : isRaceCandidate
                                ? 'bg-amber-600 text-white animate-pulse'
                                : 'bg-emerald-800 text-white'
                            }`}
                          >
                            <span>
                              {isFull
                                ? 'FULL (4/4)'
                                : isRaceCandidate
                                ? '1 SEAT LEFT (3/4)'
                                : `${cls.available_seats} Available (${cls.confirmed_count}/4)`}
                            </span>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected ? 'bg-amber-400 text-blue-950' : 'bg-blue-950 text-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reserve Action Button */}
                <button
                  disabled={!selectedClassId || isReserving || pendingBooking !== null}
                  onClick={handleReserve}
                  className={`w-full py-4 rounded-2xl font-bold text-base transition-all shadow-md mt-2 ${
                    !selectedClassId || pendingBooking !== null
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {isReserving ? 'Reserving Seat...' : 'Proceed to Checkout (Reserve Slot)'}
                </button>
              </div>

            </div>

            {/* Right Column: Checkout & Mock Payment Gateway */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              
              {/* Payment Gateway Box (Deep Green Block) */}
              <div className="bg-emerald-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">💳</span>
                  <h2 className="text-lg font-bold">Step 3: Mock Payment Gateway</h2>
                </div>
                <p className="text-xs italic text-emerald-100">
                  Tests payment outcomes without compromising roster integrity.
                </p>

                {pendingBooking ? (
                  <div className="bg-emerald-950 rounded-2xl p-5 flex flex-col space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-800">
                      <div>
                        <span className="text-xs text-emerald-300 font-bold uppercase">Pending Booking</span>
                        <p className="text-sm font-bold text-white">{pendingBooking.id}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white">
                        {pendingBooking.status}
                      </span>
                    </div>

                    <div className="text-xs flex flex-col space-y-1.5 text-emerald-100">
                      <p>
                        <strong>Class:</strong> {currentSelectedClass?.title}
                      </p>
                      <p>
                        <strong>Student:</strong> {currentSelectedParent?.students.find(s => s.id === selectedStudentId)?.name}
                      </p>
                      <p>
                        <strong>Amount Due:</strong> ${( (currentSelectedClass?.price_cents || 2500) / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-col space-y-2 pt-2">
                      <button
                        disabled={isPaying}
                        onClick={() => handlePayment('success')}
                        className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-sm"
                      >
                        {isPaying ? 'Processing...' : 'Simulate Successful Payment ($25.00)'}
                      </button>

                      <button
                        disabled={isPaying}
                        onClick={() => handlePayment('failure')}
                        className="w-full py-3.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-sm"
                      >
                        {isPaying ? 'Processing...' : 'Simulate Payment Failure (Card Declined)'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-950/70 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-2">
                    <span className="text-3xl">🛒</span>
                    <p className="text-sm font-bold">No active pending reservation</p>
                    <p className="text-xs text-emerald-200 italic">
                      Pick a class and click "Proceed to Checkout" to initiate a payment attempt.
                    </p>
                  </div>
                )}
              </div>

              {/* Status / Receipt Card (Slate Deep Block) */}
              {paymentResult && (
                <div
                  className={`rounded-3xl p-6 shadow-md flex flex-col space-y-3 ${
                    paymentResult.success ? 'bg-slate-800' : 'bg-red-950'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{paymentResult.success ? '🎉' : '❌'}</span>
                    <h3 className="text-base font-bold">
                      {paymentResult.success ? 'Confirmed Booking Receipt' : 'Payment Attempt Failed'}
                    </h3>
                  </div>

                  <div className="text-xs flex flex-col space-y-2 pt-1">
                    <p>
                      <strong>Message:</strong> {paymentResult.message}
                    </p>
                    {paymentResult.payment_attempt && (
                      <>
                        <p>
                          <strong>Transaction ID:</strong>{' '}
                          <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-300">
                            {paymentResult.payment_attempt.transaction_id}
                          </code>
                        </p>
                        <p>
                          <strong>Payment Status:</strong>{' '}
                          <span
                            className={`font-bold px-2 py-0.5 rounded ${
                              paymentResult.payment_attempt.status === 'succeeded'
                                ? 'bg-emerald-800 text-white'
                                : 'bg-red-800 text-white'
                            }`}
                          >
                            {paymentResult.payment_attempt.status}
                          </span>
                        </p>
                        {paymentResult.payment_attempt.failure_reason && (
                          <p className="text-red-300 italic">
                            <strong>Reason:</strong> {paymentResult.payment_attempt.failure_reason}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TEACHER / ADMIN ROSTER VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'roster' && (
          <div className="flex flex-col space-y-6">
            
            {/* Top Bar Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const count = cls.confirmed_count ?? 0;
                const isFull = count >= cls.capacity;

                return (
                  <div
                    key={cls.id}
                    onClick={() => setRosterFilterClassId(cls.id)}
                    className={`cursor-pointer rounded-3xl p-5 shadow-md transition-all flex flex-col space-y-3 ${
                      rosterFilterClassId === cls.id
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
                            idx < count ? (isFull ? 'bg-red-500' : 'bg-amber-400') : 'bg-emerald-900/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter Controls & Badge */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase text-slate-300">Filter Class:</span>
                <select
                  value={rosterFilterClassId}
                  onChange={(e) => setRosterFilterClassId(e.target.value)}
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

              <div className="text-xs italic text-amber-200 flex items-center space-x-1">
                <span>🛡️</span>
                <span>Invariants verified: Failed/pending bookings are completely excluded from this roster.</span>
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
                        <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center font-bold text-sm">
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
                        {new Date(entry.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-2">
                <span className="text-4xl">📋</span>
                <p className="text-base font-bold">No confirmed students found</p>
                <p className="text-xs text-slate-300 italic">No bookings have been confirmed for this selection.</p>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LAST-SEAT RACE CONDITION LAB */}
        {/* ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="flex flex-col space-y-6">
            
            {/* Header Lab Card (Deep Red Block) */}
            <div className="bg-red-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">🏎️</span>
                  <div>
                    <h2 className="text-xl font-bold">Last-Seat Race Condition Live Simulator</h2>
                    <p className="text-xs italic text-red-200">
                      Technical Scenario: User A & User B compete concurrently for the 4th and final seat!
                    </p>
                  </div>
                </div>

                <button
                  disabled={simulationRunning}
                  onClick={handleRunSimulation}
                  className={`px-6 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-md ${
                    simulationRunning
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 animate-pulse'
                  }`}
                >
                  {simulationRunning ? 'Running Atomic Race...' : '🚀 Execute Live Race Simulation'}
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
            {simulationLogs.length > 0 && (
              <div className="bg-slate-900 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>📡</span>
                    <span>Server Execution & Concurrency Telemetry</span>
                  </h3>
                  {simulationSummary && (
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                        simulationSummary.invariant_passed
                          ? 'bg-emerald-800 text-white'
                          : 'bg-red-800 text-white'
                      }`}
                    >
                      {simulationSummary.invariant_passed ? '✓ INVARIANT PRESERVED: ROSTER = 4/4' : '✗ INVARIANT BREACHED'}
                    </span>
                  )}
                </div>

                {/* Timeline Log Entries */}
                <div className="flex flex-col space-y-2.5">
                  {simulationLogs.map((log) => {
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
                        <span className="text-slate-400 font-mono text-[10px] self-end sm:self-center">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Final Roster Snapshot */}
                {simulationSummary?.roster && (
                  <div className="bg-slate-950 p-4 rounded-2xl mt-2 flex flex-col space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Final Verified Roster for "Speed Math":
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {simulationSummary.roster.map((r: any, i: number) => (
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
          </div>
        </div>
      </footer>
    </div>
  );
}
