'use client';

/** Client copy of backend/lib/leadVitality.js — display + fallback if API omits vitality. */

const CLOSED = ['admission_paid', 'enrolled', 'declined', 'lapsed', 'dead_lead'];

function daysSince(date) {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function nextAction(status, lead) {
  if (status === 'won') return 'No action — already enrolled.';
  if (status === 'declined') return 'Keep as declined unless the parent re-opens.';
  if (status === 'dead') return 'Confirm dead, or log one last WhatsApp / call.';
  if (lead.interview_outcome === 'passed' && !lead.has_application) return 'Resend the Ed Admin application link.';
  if (lead.has_application && !lead.has_payment) return 'Chase admission payment.';
  if (lead.has_tour && !lead.has_interview) return 'Book the interview while the tour is fresh.';
  if (!lead.has_tour) return 'Call or WhatsApp and book a campus tour.';
  if (lead.interview_outcome === 'failed') return 'Offer a rebook or a different campus/class.';
  return 'Log contact and set the next follow-up date.';
}

export function computeLeadVitality(lead) {
  if (lead?.vitality?.status) return lead.vitality;
  const stage = lead.computed_stage || 'interested_lead';
  const reasons = [];
  const daysUpdate = daysSince(lead.last_contacted_at || lead.created_at || lead.updated_at) ?? 0;
  const daysCreate = daysSince(lead.created_at) ?? daysUpdate;
  const followUpOverdue = (() => {
    if (CLOSED.includes(stage)) return false;
    if (lead.follow_up_date) {
      const due = new Date(lead.follow_up_date);
      due.setHours(23, 59, 59, 999);
      return due.getTime() < Date.now();
    }
    return daysUpdate > 7;
  })();

  if (stage === 'admission_paid' || stage === 'enrolled') {
    return { status: 'won', label: 'Won', heat: 100, reasons: ['Admission complete'], next: nextAction('won', lead) };
  }
  if (stage === 'declined') {
    return { status: 'declined', label: 'Declined', heat: 0, reasons: [lead.decline_reason || 'Parent declined'], next: nextAction('declined', lead) };
  }
  if (stage === 'dead_lead') {
    return { status: 'dead', label: 'Dead', heat: 0, reasons: [lead.decline_reason || 'Marked dead'], next: nextAction('dead', lead) };
  }

  let heat = 10;
  if (lead.sibling_flag) { heat += 25; reasons.push('Sibling / returning family'); }
  if (lead.source === 'referral' || lead.source === 'partner_school') { heat += 20; reasons.push('Referral or partner school'); }
  if (lead.interview_outcome === 'passed') { heat += 30; reasons.push('Interview passed'); }
  if (lead.has_application && !lead.has_payment) { heat += 25; reasons.push('Form filled, payment outstanding'); }
  if (lead.has_interview && lead.interview_outcome === 'pending') { heat += 15; reasons.push('Interview booked'); }
  if (lead.has_tour && !lead.has_interview) { heat += 12; reasons.push('Tour on the books'); }
  if (daysCreate <= 7) { heat += 15; reasons.push('New inbound (≤7 days)'); }
  if (['walk_in', 'whatsapp', 'online_form', 'phone_call'].includes(lead.source) && daysCreate <= 14) {
    heat += 8;
    reasons.push('Fresh inbound channel');
  }
  if (lead.whatsapp_number) heat += 5;
  if (lead.parent_email) heat += 5;
  if ((lead.lead_score || 0) >= 70) { heat += 8; reasons.push('High lead score'); }

  if (!lead.parent_phone) { heat -= 35; reasons.push('No phone — cannot convert'); }
  if (followUpOverdue) { heat -= 18; reasons.push('Follow-up overdue'); }
  if (lead.interview_outcome === 'failed' && daysUpdate >= 14) { heat -= 22; reasons.push('Failed interview, no rebook'); }
  if (daysUpdate >= 90) { heat -= 40; reasons.push('No movement 90+ days'); }
  else if (daysUpdate >= 45) { heat -= 25; reasons.push('Stale 45+ days'); }
  else if (daysUpdate >= 21) { heat -= 12; reasons.push('Quiet 21+ days'); }

  if (!/2027|Rolling/i.test(lead.intended_term || '') && daysUpdate >= 90 && lead.interview_outcome !== 'passed' && !lead.has_application) {
    return { status: 'dead', label: 'Likely dead', heat: Math.max(0, heat), reasons, next: nextAction('dead', lead), auto_dead: true };
  }

  heat = Math.max(0, Math.min(100, heat));
  let status = 'warm';
  let label = 'Warm';
  if (heat >= 40) { status = 'hot'; label = 'Potential'; }
  else if (heat < 18) { status = 'cold'; label = 'At risk'; }
  return { status, label, heat, reasons, next: nextAction(status, lead) };
}

export const VITALITY_COLORS = {
  hot: '#16a34a',
  warm: '#d97706',
  cold: '#dc2626',
  dead: '#6b7280',
  won: '#0f766e',
  declined: '#7f1d1d',
};
