import { Suspense } from 'react';
import { DashboardInner } from './DashboardInner';

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
