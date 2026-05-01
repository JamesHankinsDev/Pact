import { Suspense } from 'react';
import { MealDetail } from './MealDetail';

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <MealDetail mealId={id} />
    </Suspense>
  );
}
