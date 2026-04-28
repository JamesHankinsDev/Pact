import { Suspense } from 'react';
import { JoinInner } from './JoinInner';

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
