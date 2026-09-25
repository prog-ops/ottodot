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

  const safeParents = Array.isArray(parents) ? parents : [];
  const safeStudents = Array.isArray(students) ? students : [];
  const safeClasses = Array.isArray(classes) ? classes : [];
  const safeRoster = Array.isArray(roster) ? roster : [];

  const parentsWithStudents: ParentWithStudents[] = safeParents.map((p) => ({
    ...p,
    students: safeStudents.filter((s) => s.parent_id === p.id),
  }));

  return (
    <TrialBookingApp
      initialClasses={safeClasses}
      initialParents={parentsWithStudents}
      initialRoster={safeRoster}
    />
  );
}
