import { Suspense } from 'react';
import { BodyInner } from './BodyInner';

export default function LogBodyPage() {
  return (
    <Suspense fallback={null}>
      <BodyInner />
    </Suspense>
  );
}
