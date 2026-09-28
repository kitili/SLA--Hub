import { Suspense } from 'react';
import ApplyForm from '@/components/public/ApplyForm';

export default function ApplyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading application form…</div>}>
      <ApplyForm />
    </Suspense>
  );
}
