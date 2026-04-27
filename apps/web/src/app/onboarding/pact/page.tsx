import { Suspense } from 'react';
import { PactInner } from './PactInner';

export default function PactPage() {
  return (
    <Suspense fallback={null}>
      <PactInner />
    </Suspense>
  );
}
