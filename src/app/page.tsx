import { bookingStore } from '@/lib/db/store';
import { TrialBookingApp } from '@/components/trial-booking-app';
import { ParentWithStudents } from '@/types';

// Force dynamic SSR so server renders real-time seed/roster states
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [classes, parents, students, roster] = await Promise.all([
    bookingStore.getTrialClasses(),
    bookingStore.getParents(),
    bookingStore.getStudents(),
    bookingStore.getRoster(),
  ]);

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
