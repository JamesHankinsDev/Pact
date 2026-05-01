import { Suspense } from 'react';
import { HouseholdInner } from './HouseholdInner';

export default function HouseholdPage() {
  return (
    <Suspense fallback={null}>
      <HouseholdInner />
    </Suspense>
  );
}
