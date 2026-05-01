import { Suspense } from 'react';
import { SettingsInner } from './SettingsInner';

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}
