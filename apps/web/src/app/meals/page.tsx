import { Suspense } from 'react';
import { MealsDashboard } from './MealsDashboard';

export default function MealsPage() {
  return (
    <Suspense fallback={null}>
      <MealsDashboard />
    </Suspense>
  );
}
