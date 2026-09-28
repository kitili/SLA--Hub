const REQUIRED_CREATE_FIELDS = [
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

function trim(value) {
  const next = String(value ?? '').trim();
  return next === '__other__' ? '' : next;
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function validateLeadCreate(body, campusId) {
  if (!campusId) return 'Campus is required.';

  const missing = REQUIRED_CREATE_FIELDS
    .filter(([key]) => !trim(body[key]))
    .map(([, label]) => label);
  if (missing.length) {
    return `Please fill: ${missing.join(', ')}.`;
  }

  if (phoneDigits(body.parent_phone).length < 9) {
    return 'Enter a valid phone number (at least 9 digits).';
  }
  if (phoneDigits(body.whatsapp_number).length < 9) {
    return 'Enter a valid WhatsApp number (at least 9 digits).';
  }

  const age = Number(body.child_age);
  if (!Number.isFinite(age) || age < 0 || age > 16) {
    return 'Enter a valid child age (0–16).';
  }

  const kids = Number(body.num_children);
  if (!Number.isFinite(kids) || kids < 1) {
    return 'Children in family must be at least 1.';
  }

  const gender = trim(body.child_gender).toLowerCase();
  if (!['female', 'male'].includes(gender)) {
    return 'Select the child gender.';
  }

  const boarding = trim(body.boarding_day).toLowerCase();
  if (!['day', 'boarding'].includes(boarding)) {
    return 'Select boarding or day.';
  }

  return null;
}

module.exports = { validateLeadCreate, REQUIRED_CREATE_FIELDS };
