import { Suspense } from 'react';
import { MedsInner } from './MedsInner';

export default function MedsPage() {
  return (
    <Suspense fallback={null}>
      <MedsInner />
    </Suspense>
  );
}
