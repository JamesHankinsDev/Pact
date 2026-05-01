import { Suspense } from 'react';
import { WorkoutDetail } from './WorkoutDetail';

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <WorkoutDetail workoutId={id} />
    </Suspense>
  );
}
