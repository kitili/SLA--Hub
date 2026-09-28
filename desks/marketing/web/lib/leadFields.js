export const CLASSES = ['Daycare', 'KG1', 'KG2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
export const SOURCES = ['walk_in','phone_call','social_media','referral','radio_campaign','billboard','online_form','whatsapp','open_day','partner_school','other'];
export const HOW_HEARD = [
  'Instagram', 'Facebook', 'WhatsApp', 'Radio', 'Friend / family',
  'Staff referral', 'School visit', 'Billboard', 'Website', 'Other',
];
export const TERMS = ['2026 mid-year', 'January 2027', '2027 mid-year', 'Rolling (Daycare / KG)'];
export const CHILD_AGES = Array.from({ length: 17 }, (_, i) => String(i));
export const FAMILY_SIZES = Array.from({ length: 10 }, (_, i) => String(i + 1));
export const REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Mjini Magharibi (Zanzibar)',
  'Kaskazini Unguja',
  'Kusini Unguja',
  'Kaskazini Pemba',
  'Kusini Pemba',
  'Outside Tanzania',
];
export const RESIDENCES = [
  'Usa River',
  'Maji ya Chai',
  'Ilboru',
  'Kijenge',
  'Kijenge Chini',
  'Kijenge Juu',
  'Sakina',
  'Moshono',
  'Ngongongare',
  'Momella',
  'Tengeru',
  'Ngaramtoni',
  'Mianzini',
  'Kikatiti',
  'Kimandolu',
  'Sanawari',
  'Sekei',
  'Sombetini',
  'Olasiti',
  'Njiro',
  'Themi',
  'Boma',
  'Karatu',
  'Kikwe',
  'Makumira',
  'Mlangarini',
  'Kambi ya Pili',
  'Mwanama',
  'Kiwawa',
  'Leganga',
  'Mbauda',
  'Muriet',
  'Majengo',
  'Shangarai',
  'Sangananu',
  'Nkoaranga',
  'Kitefu',
  'Manyire',
  'Ngorongoro',
  'Arusha City',
  'Dar es Salaam',
  'Moshi',
  'Dodoma',
];
export const OCCUPATIONS = [
  'Business owner',
  'Teacher',
  'Farmer',
  'Pastoralist',
  'Doctor',
  'Nurse',
  'Accountant',
  'Tour guide',
  'Tour operator',
  'Driver',
  'Civil servant',
  'Government employee',
  'NGO / development',
  'Pastor / church worker',
  'Engineer',
  'Lawyer',
  'Banker',
  'Mechanic',
  'ICT / tech',
  'Hotel / lodge',
  'Mining',
  'Homemaker',
  'Student',
  'Self-employed',
  'Unemployed',
];
export const REQUIRED_CREATE_FIELDS = [
  ['parent_name', 'Parent name'],
  ['parent_phone', 'Phone number'],
  ['whatsapp_number', 'WhatsApp number'],
  ['occupation', 'Occupation'],
  ['residence', 'Residence'],
  ['region', 'Region'],
  ['child_name', 'Child name'],
  ['interested_class', 'Interested class'],
  ['child_age', 'Child age'],
  ['child_gender', 'Child gender'],
  ['num_children', 'Children in family'],
  ['boarding_day', 'Boarding / Day'],
  ['intended_term', 'Intended term'],
  ['source', 'Lead source'],
  ['how_heard', 'How they heard'],
  ['source_detail', 'Who referred / school'],
];
export const CONTACT_CHANNELS = [
  { key: 'phone', label: 'Phone call' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'in_person', label: 'In person' },
  { key: 'dm', label: 'Social DM' },
];
export const CONTACT_OUTCOMES = [
  { key: 'replied', label: 'Replied / spoke' },
  { key: 'left_message', label: 'Left a message' },
  { key: 'callback', label: 'Asked for a callback' },
  { key: 'no_answer', label: 'No answer' },
  { key: 'invalid', label: 'Number invalid' },
  { key: 'declined_talk', label: 'Declined to talk' },
];

export const EMPTY_LEAD = {
  parent_name: '', parent_phone: '', parent_phone2: '', parent_email: '', whatsapp_number: '',
  child_name: '', child_age: '', child_gender: '', interested_class: '', boarding_day: 'day',
  source: '', how_heard: '', source_detail: '', campaign_id: '', campus_id: '',
  occupation: '', residence: '', region: '', num_children: '', intended_term: '',
  notes: '', follow_up_date: '', assigned_to: '',
};

export function leadToForm(lead) {
  return {
    parent_name: lead.parent_name || '',
    parent_phone: lead.parent_phone || '',
    parent_phone2: lead.parent_phone2 || '',
    parent_email: lead.parent_email || '',
    whatsapp_number: lead.whatsapp_number || '',
    child_name: lead.child_name || '',
    child_age: lead.child_age ?? '',
    child_gender: lead.child_gender || '',
    interested_class: lead.interested_class || '',
    source: lead.source || 'walk_in',
    how_heard: lead.how_heard || '',
    source_detail: lead.source_detail || '',
    campaign_id: lead.campaign_id || '',
    campus_id: lead.campus_id || '',
    boarding_day: lead.boarding_day || 'day',
    occupation: lead.occupation || '',
    residence: lead.residence || '',
    region: lead.region || '',
    num_children: lead.num_children ?? 1,
    intended_term: lead.intended_term || '',
    notes: lead.notes || '',
    follow_up_date: lead.follow_up_date?.slice(0, 10) || '',
    assigned_to: lead.assigned_to || '',
  };
}

function trim(value) {
  const next = String(value ?? '').trim();
  return next === '__other__' ? '' : next;
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function validateLeadCreate(form, { isGlobal } = {}) {
  const missing = REQUIRED_CREATE_FIELDS
    .filter(([key]) => !trim(form[key]))
    .map(([, label]) => label);
  if (isGlobal && !trim(form.campus_id)) missing.push('Campus');
  if (missing.length) return `Please fill: ${missing.join(', ')}.`;

  if (phoneDigits(form.parent_phone).length < 9) {
    return 'Enter a valid phone number (at least 9 digits).';
  }
  if (phoneDigits(form.whatsapp_number).length < 9) {
    return 'Enter a valid WhatsApp number (at least 9 digits).';
  }

  const age = Number(form.child_age);
  if (!Number.isFinite(age) || age < 0 || age > 16) {
    return 'Enter a valid child age (0–16).';
  }

  const kids = Number(form.num_children);
  if (!Number.isFinite(kids) || kids < 1) {
    return 'Children in family must be at least 1.';
  }

  return null;
}
