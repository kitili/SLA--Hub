export const MARKETING_TEAM = [
  { name: 'Eric', email: 'eric@silverleaf.co.tz', campus_code: 'ACC' },
  { name: 'Mariam', email: 'mariam@silverleaf.co.tz', campus_code: 'USR' },
];

export function isMarketingTeamMember(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  return MARKETING_TEAM.some(m => email === m.email.toLowerCase());
}
