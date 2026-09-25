import { bookingStore } from '@/lib/db/store';
import { TrialBookingApp } from '@/components/trial-booking-app';
import { ParentWithStudents } from '@/types';

// Force dynamic SSR so server renders real-time seed/roster states
export const dynamic = 'force-dynamic';

export default function Page() {
  const classes = bookingStore.getTrialClasses();
  const parents = bookingStore.getParents();
  const students = bookingStore.getStudents();
  const roster = bookingStore.getRoster();

  const parentsWithStudents: ParentWithStudents[] = parents.map((p) => ({
    ...p,
    students: students.filter((s) => s.parent_id === p.id),
  }));

  return (
    <TrialBookingApp
      initialClasses={classes}
      initialParents={parentsWithStudents}
      initialRoster={roster}
    />
  );
}
