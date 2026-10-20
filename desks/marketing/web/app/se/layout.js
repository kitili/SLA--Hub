'use client';

import AuthGuard from '@/components/AuthGuard';

const SE = ['global_student_exp_head', 'campus_student_exp_head'];

export default function StudentExperienceLayout({ children }) {
  return <AuthGuard roles={SE}>{children}</AuthGuard>;
}
