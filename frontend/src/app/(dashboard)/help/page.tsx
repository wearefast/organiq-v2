import { Suspense } from 'react';
import { HelpPage } from '@/features/help/help-page';

export default function HelpRoute() {
  return (
    <Suspense>
      <HelpPage />
    </Suspense>
  );
}
