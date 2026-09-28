export function loginPathForRole(role) {
  return role === 'ceo' ? '/admin' : '/login';
}

export function loginPathFromPathname(pathname) {
  const path = pathname || '';
  return path.startsWith('/ceo') || path === '/admin' ? '/admin' : '/login';
}

export function homePathForUser(user) {
  const role = user?.role;
  if (role === 'ceo' || role === 'global_marketing_head' || role === 'campus_marketing_head') return '/marketing';
  if (role === 'global_student_exp_head' || role === 'campus_student_exp_head') return '/se';
  if (role === 'nurse') return '/dispensary';
  return '/';
}
