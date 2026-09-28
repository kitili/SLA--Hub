/** Built-in campus marketing heads. The Team page can add more. */
export const MARKETING_TEAM = [
  { name: 'Eric', email: 'eric@silverleaf.co.tz', campus_code: 'ACC' },
  { name: 'Mariam', email: 'mariam@silverleaf.co.tz', campus_code: 'USR' },
];

export const TEAM_ADMIN_ROLES = ['ceo', 'global_marketing_head'];
export const PROTECTED_EMAILS = ['marketing@silverleaf.co.tz', 'ceo@silverleaf.co.tz', 'admin@silverleaf.co.tz'];

export function isMarketingTeamMember(user) {
  if (!user) return false;
  return (user.role || '') === 'campus_marketing_head' || PROTECTED_EMAILS.includes((user.email || '').toLowerCase());
}

export function canManageMarketingTeam(user) {
  return TEAM_ADMIN_ROLES.includes(user?.role);
}

export function isProtectedTeamAccount(user) {
  return PROTECTED_EMAILS.includes((user?.email || '').toLowerCase());
}
