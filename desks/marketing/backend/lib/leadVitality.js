/**
 * Automatic dead vs potential classification.
 *
 * The master workbook only stores campus COUNTS of "Interested" and "Dead Lead".
 * Staff tagged those by hand. This engine reconstructs the same decision from
 * signals the app already has (and can scrape): recency, follow-up, interview,
 * tour, form, sibling/referral, contact completeness.
 *
 * Funnel stage (interested / tour / paid) stays separate from vitality
 * (hot / warm / cold / dead). A lead can be interview_booked and still cold
 * if nobody has touched them in 40 days.
 */

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

/** Last real touch. Prefer contact / first-seen over import-time updated_at. */
function recencyAnchor(lead) {
  return lead.last_contacted_at || lead.created_at || lead.updated_at;
}

function isFollowUpOverdue(lead, days = 7) {
  if (!lead) return false;
  const stage = lead.computed_stage || '';
  if (CLOSED.includes(stage)) return false;
  if (lead.follow_up_date) {
    const due = new Date(lead.follow_up_date);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  }
  const elapsed = daysSince(recencyAnchor(lead));
  return elapsed != null && elapsed > days;
}

function computeLeadVitality(lead) {
  const stage = lead.computed_stage || 'interested_lead';
  const reasons = [];
  const daysUpdate = daysSince(recencyAnchor(lead)) ?? 0;
  const daysCreate = daysSince(lead.created_at) ?? daysUpdate;
  const followUpOverdue = isFollowUpOverdue(lead);

  if (stage === 'admission_paid' || stage === 'enrolled') {
    return { status: 'won', label: 'Won', heat: 100, reasons: ['Admission complete'], next: nextAction('won', lead) };
  }
  if (stage === 'declined') {
    return { status: 'declined', label: 'Declined', heat: 0, reasons: [lead.decline_reason || 'Parent declined'], next: nextAction('declined', lead) };
  }
  if (stage === 'dead_lead') {
    return {
      status: 'dead',
      label: 'Dead',
      heat: 0,
      reasons: [lead.decline_reason || 'Marked dead (90+ days or staff tag)'],
      next: nextAction('dead', lead),
    };
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
  if (lead.whatsapp_number) { heat += 5; }
  if (lead.parent_email) { heat += 5; }
  if ((lead.lead_score || 0) >= 70) { heat += 8; reasons.push('High lead score'); }

  const noShows = Number(lead.tour_no_shows || 0);
  const followupsDone = Number(lead.followups_done || 0);
  const reminderStep = Number(lead.form_reminder_step || 0);

  if (!lead.parent_phone) { heat -= 35; reasons.push('No phone — cannot convert'); }
  if (followUpOverdue) { heat -= 18; reasons.push('Follow-up overdue'); }
  if (lead.interview_outcome === 'failed' && daysUpdate >= 14) { heat -= 22; reasons.push('Failed interview, no rebook'); }
  if (noShows >= 1) { heat -= 15; reasons.push('Tour no-show'); }
  if (noShows >= 2) { heat -= 15; reasons.push('Repeated tour no-shows'); }
  if (reminderStep >= 2 && !lead.has_application) { heat -= 12; reasons.push('Application reminders exhausted'); }
  if (daysUpdate >= 90) { heat -= 40; reasons.push('No movement 90+ days'); }
  else if (daysUpdate >= 45) { heat -= 25; reasons.push('Stale 45+ days'); }
  else if (daysUpdate >= 21) { heat -= 12; reasons.push('Quiet 21+ days'); }
  if (followupsDone >= 2 && daysUpdate >= 21 && !lead.has_tour && !lead.has_application) {
    heat -= 10;
    reasons.push(`${followupsDone} follow-ups with no stage move`);
  }

  const nextCycle = /2027|Rolling/i.test(lead.intended_term || '');
  const likelyDead = !nextCycle && (
    daysUpdate >= 90
    || (daysUpdate >= 45 && followupsDone >= 2 && !lead.has_tour && !lead.has_application && lead.interview_outcome !== 'passed')
    || (reminderStep >= 2 && !lead.has_application && daysUpdate >= 21)
    || (noShows >= 2 && daysUpdate >= 30)
  );

  if (likelyDead && lead.interview_outcome !== 'passed' && !lead.has_application) {
    return {
      status: 'dead',
      label: 'Likely dead',
      heat: Math.max(0, heat),
      reasons: reasons.length ? reasons : ['Inactivity matches the sheet’s Dead Lead bucket'],
      next: nextAction('dead', lead),
      auto_dead: true,
    };
  }

  heat = Math.max(0, Math.min(100, heat));
  let status = 'warm';
  let label = 'Warm';
  if (heat >= 40) { status = 'hot'; label = 'Potential'; }
  else if (heat < 18) { status = 'cold'; label = 'At risk'; }

  return { status, label, heat, reasons, next: nextAction(status, lead) };
}

function attachVitality(lead) {
  if (!lead) return lead;
  return { ...lead, vitality: computeLeadVitality(lead) };
}

module.exports = { computeLeadVitality, attachVitality, isFollowUpOverdue, recencyAnchor, CLOSED };
