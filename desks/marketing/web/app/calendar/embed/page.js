'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import PublicCalendar from '@/components/public/PublicCalendar';

export default function CalendarEmbedPage() {
  return (
    <PublicChrome embed>
      <PublicCalendar embed />
    </PublicChrome>
  );
}
