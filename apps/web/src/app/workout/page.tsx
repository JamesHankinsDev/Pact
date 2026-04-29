import { Suspense } from 'react';
import { WorkoutInner } from './WorkoutInner';

export default function WorkoutPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutInner />
    </Suspense>
  );
}
