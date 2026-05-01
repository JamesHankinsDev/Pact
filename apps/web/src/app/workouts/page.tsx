import { Suspense } from 'react';
import { WorkoutsDashboard } from './WorkoutsDashboard';

export default function WorkoutsPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutsDashboard />
    </Suspense>
  );
}
