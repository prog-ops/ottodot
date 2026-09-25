'use client';

import React, { useState, useEffect } from 'react';
import { TrialClass, ParentWithStudents, Booking, BookingResult } from '@/types';

interface BookingFlowProps {
  classes: TrialClass[];
  parents: ParentWithStudents[];
  onBookingSuccess: () => void;
}

export function BookingFlow({
  classes,
  parents,
  onBookingSuccess,
}: BookingFlowProps) {
  const [localParents, setLocalParents] = useState<ParentWithStudents[]>(parents);
  const [selectedParentId, setSelectedParentId] = useState<string>(
    parents[0]?.id ?? ''
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    parents[0]?.students[0]?.id ?? ''
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<BookingResult | null>(null);
  const [notification, setNotification] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Quick-Add Child State
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState(7);
  const [isAddingChild, setIsAddingChild] = useState(false);

  // 10-Minute Hold Lease Countdown Timer
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(600);

  useEffect(() => {
    setLocalParents(parents);
  }, [parents]);

  useEffect(() => {
    if (!pendingBooking) {
      setHoldSecondsLeft(600);
      return;
    }
    const timer = setInterval(() => {
      setHoldSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPendingBooking(null);
          setNotification({
            text: 'Reservation lease expired. Seat slot released.',
            type: 'error',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingBooking]);

  const formatHoldTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId);
    const parent = localParents.find((p) => p.id === parentId);
    if (parent && parent.students.length > 0) {
      setSelectedStudentId(parent.students[0].id);
    } else {
      setSelectedStudentId('');
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !selectedParentId) return;

    setIsAddingChild(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: selectedParentId,
          name: newChildName.trim(),
          age: Number(newChildAge),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const createdStudent = json.data;
        setLocalParents((prev) =>
          prev.map((p) => {
            if (p.id === selectedParentId) {
              return {
                ...p,
                students: [...p.students, createdStudent],
              };
            }
            return p;
          })
        );
        setSelectedStudentId(createdStudent.id);
        setShowAddChildModal(false);
        setNewChildName('');
        setNotification({
          text: `✓ Registered "${createdStudent.name}" (Age ${createdStudent.age})! Selected for booking.`,
          type: 'success',
        });
      } else {
        setNotification({
          text: json.message || 'Failed to add student',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding student';
      setNotification({ text: msg, type: 'error' });
    } finally {
      setIsAddingChild(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedClassId || !selectedStudentId || !selectedParentId) {
      setNotification({ text: 'Please pick a trial class and student.', type: 'error' });
      return;
    }

    setIsReserving(true);
    setNotification(null);
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

      const data = (await res.json()) as BookingResult;

      if (res.ok && data.success) {
        setPendingBooking(data.booking);
        setNotification({
          text: 'Seat slot reserved with status "pending_payment". Please confirm payment.',
          type: 'success',
        });
      } else {
        setNotification({
          text: data.message || 'Failed to reserve seat.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setNotification({ text: msg, type: 'error' });
    } finally {
      setIsReserving(false);
    }
  };

  const handlePayment = async (outcome: 'success' | 'failure') => {
    if (!pendingBooking) return;

    setIsPaying(true);
    setNotification(null);

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

      const data = (await res.json()) as BookingResult;
      setPaymentResult(data);

      if (res.ok && data.success) {
        setNotification({
          text: '🎉 Payment Confirmed! Your child is now on the official roster.',
          type: 'success',
        });
        setPendingBooking(null);
        onBookingSuccess();
      } else {
        setNotification({
          text: `Payment unsuccessful: ${data.message}`,
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment error';
      setNotification({ text: msg, type: 'error' });
    } finally {
      setIsPaying(false);
    }
  };

  const currentSelectedParent = localParents.find((p) => p.id === selectedParentId);
  const currentSelectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="flex flex-col space-y-6">
      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-800'
              : notification.type === 'error'
              ? 'bg-red-900'
              : 'bg-blue-900'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl">
              {notification.type === 'success' ? '✅' : notification.type === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <p className="text-sm font-semibold text-white">{notification.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Selection */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          {/* Card 1: Family Selection (Deep Amber Block) */}
          <div className="bg-amber-800 rounded-3xl p-6 shadow-md flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">👨‍👩‍👦</span>
              <h2 className="text-lg font-bold text-white">Step 1: Pick Parent & Child</h2>
            </div>
            <p className="text-xs italic text-amber-100">
              Select a parent from seed data or register a custom child to test any scenario.
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
                  {localParents.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white">
                    Child (Student)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddChildModal(!showAddChildModal)}
                    className="text-[11px] font-bold text-amber-200 hover:text-white underline"
                  >
                    {showAddChildModal ? 'Close' : '+ Add Child'}
                  </button>
                </div>
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

            {/* Inline Quick Add Child Form */}
            {showAddChildModal && (
              <form
                onSubmit={handleAddChild}
                className="bg-amber-950/80 rounded-2xl p-4 flex flex-col space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Register New Child for {currentSelectedParent?.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-amber-200 mb-1">
                      Child Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maya Tanaka"
                      value={newChildName}
                      onChange={(e) => setNewChildName(e.target.value)}
                      className="w-full bg-slate-900 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-200 mb-1">
                      Age (4 - 16)
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={16}
                      value={newChildAge}
                      onChange={(e) => setNewChildAge(Number(e.target.value))}
                      className="w-full bg-slate-900 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddChildModal(false)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingChild}
                    className="py-1.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-sm disabled:opacity-50"
                  >
                    {isAddingChild ? 'Saving...' : 'Save & Select Child'}
                  </button>
                </div>
              </form>
            )}

            {/* Edge Case Testing Hints */}
            <div className="bg-amber-900/60 rounded-2xl p-3 text-xs flex flex-col space-y-1 text-white">
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
                <h2 className="text-lg font-bold text-white">Step 2: Choose a Trial Class</h2>
              </div>
              <span className="text-xs font-bold bg-blue-950 px-3 py-1 rounded-xl text-white">
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
                        <span className="text-base font-bold text-white">{cls.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-900 font-bold uppercase text-white">
                          {cls.subject}
                        </span>
                      </div>
                      <p className="text-xs text-blue-200">
                        Instructor: <span className="font-semibold text-white">{cls.instructor_name}</span> • Fee: ${(cls.price_cents / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
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
              <h2 className="text-lg font-bold text-white">Step 3: Mock Payment Gateway</h2>
            </div>
            <p className="text-xs italic text-emerald-100">
              Tests payment outcomes without compromising roster integrity.
            </p>

            {pendingBooking ? (
              <div className="bg-emerald-950 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-800">
                  <div>
                    <span className="text-xs text-emerald-300 font-bold uppercase">Pending Booking</span>
                    <p className="text-sm font-bold text-white font-mono">{pendingBooking.id}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white">
                      {pendingBooking.status}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-900 text-amber-300 flex items-center space-x-1">
                      <span>⏱️</span>
                      <span>{formatHoldTime(holdSecondsLeft)}</span>
                    </span>
                  </div>
                </div>

                <div className="text-xs flex flex-col space-y-1.5 text-emerald-100">
                  <p>
                    <strong>Class:</strong> {currentSelectedClass?.title}
                  </p>
                  <p>
                    <strong>Student:</strong>{' '}
                    {currentSelectedParent?.students.find((s) => s.id === selectedStudentId)?.name}
                  </p>
                  <p>
                    <strong>Amount Due:</strong> ${((currentSelectedClass?.price_cents ?? 2500) / 100).toFixed(2)}
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
                <p className="text-sm font-bold text-white">No active pending reservation</p>
                <p className="text-xs text-emerald-200 italic">
                  Pick a class and click "Proceed to Checkout" to initiate a payment attempt.
                </p>
              </div>
            )}
          </div>

          {/* Status / Receipt Card */}
          {paymentResult && (
            <div
              className={`rounded-3xl p-6 shadow-md flex flex-col space-y-3 ${
                paymentResult.success ? 'bg-slate-800' : 'bg-red-950'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{paymentResult.success ? '🎉' : '❌'}</span>
                <h3 className="text-base font-bold text-white">
                  {paymentResult.success ? 'Confirmed Booking Receipt' : 'Payment Attempt Failed'}
                </h3>
              </div>

              <div className="text-xs flex flex-col space-y-2 pt-1 text-white">
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

                {paymentResult.success && (
                  <div className="bg-slate-900/80 rounded-2xl p-4 mt-2 space-y-2 text-xs">
                    <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                      <span>📧</span>
                      <span>Receipt & calendar invite dispatched to: {currentSelectedParent?.email}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-slate-300">
                      <span className="truncate">🔗 https://zoom.us/j/ottodot-trial-{paymentResult.booking?.trial_class_id.slice(-6)}</span>
                      <span className="text-amber-400 font-bold ml-2">Classroom URL</span>
                    </div>
                    <p className="text-slate-400 text-[11px] italic">
                      ✓ Teacher roster automatically synced. Click tab "2. Teacher Roster" to verify confirmed seat.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
