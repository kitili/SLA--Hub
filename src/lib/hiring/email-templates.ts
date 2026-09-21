import { escapeHtml } from "@/lib/security/html";

export type EmailPhones = {
  phone1?: string;
  phone2?: string;
};

function buildFooter(phones?: EmailPhones) {
  const phoneLines = [phones?.phone1, phones?.phone2]
    .filter(Boolean)
    .map((p) => escapeHtml(p!))
    .join(" &nbsp;|&nbsp; ");

  const contactLine = phoneLines
    ? `<br>${phoneLines}`
    : "";

  return (
    `<p>Warm regards,<br>` +
    `Silverleaf Academy HR Team<br>` +
    `<a href="mailto:jobs@silverleaf.co.tz">jobs@silverleaf.co.tz</a>` +
    contactLine +
    `</p>`
  );
}

export function buildCultureVideoEmail(
  candidateName: string,
  role: string,
  uploadLink: string,
  deadlineText: string,
  phones?: EmailPhones,
) {
  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Thank you for taking the first step toward joining Silverleaf Academy.</p>` +
    `<p>At Silverleaf, we are building more than a school — we are building a future. A future where every child has access to <strong>high-quality education</strong>, and where young people grow into <strong>confident and compassionate leaders shaping the future of Tanzania</strong>.</p>` +
    `<p>We are intentional about who joins this journey. Not just people with skills — but people with purpose.</p>` +
    `<p>And that is why we are excited to move you forward.</p>` +
    `<p><strong>Culture Video – Your Story Matters</strong></p>` +
    `<p>We invite you to share a short video (2–3 minutes) reflecting on:</p>` +
    `<ul>` +
    `<li>Why you want to be part of Silverleaf Academy</li>` +
    `<li>What drives you in your work</li>` +
    `<li>The experiences that have shaped who you are</li>` +
    `<li>How you see yourself contributing to our mission</li>` +
    `</ul>` +
    `<p><strong>Submit your video here:</strong><br>` +
    `<a href="${escapeHtml(uploadLink)}" target="_blank">${escapeHtml(uploadLink)}</a></p>` +
    `<p><strong>Deadline:</strong> ${escapeHtml(deadlineText)}</p>` +
    `<p>If the link does not open from your email, kindly copy and paste it into your browser.</p>` +
    `<p>We are excited to hear your story.</p>` +
    buildFooter(phones)
  );
}

export function buildPerformanceTaskEmail(
  candidateName: string,
  role: string,
  uploadLink: string,
  deadlineText: string,
  questions?: string,
  hasAttachment?: boolean,
  phones?: EmailPhones,
) {
  const questionsBlock = questions
    ? `<p><strong>Task Description / Questions:</strong></p>` +
      `<p>${escapeHtml(questions).replace(/\n/g, "<br>")}</p>`
    : "";

  const taskFileNote = hasAttachment
    ? `<p><strong>Task file:</strong> The task document is attached to this email. Please download and read it carefully before starting.</p>`
    : "";

  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Thank you for continuing this journey with us for the <strong>${escapeHtml(role)}</strong> position.</p>` +
    `<p>At Silverleaf Academy, we believe that how you think, solve problems, and execute matters just as much as what you know.</p>` +
    `<p><strong>Performance Task</strong></p>` +
    `<p>This stage is designed to give you the opportunity to demonstrate how you think, how you structure your work, and how you approach real challenges.</p>` +
    taskFileNote +
    questionsBlock +
    `<p><strong>Deadline:</strong> ${escapeHtml(deadlineText)}</p>` +
    `<p><strong>Submit your completed task here:</strong><br><a href="${escapeHtml(uploadLink)}" target="_blank">${escapeHtml(uploadLink)}</a></p>` +
    `<p>If the link does not open from your email, kindly copy and paste it into your browser.</p>` +
    `<p>We are excited to see your work.</p>` +
    buildFooter(phones)
  );
}

export function buildOnlineInterviewEmail(
  candidateName: string,
  role: string,
  schedulingInfo: string,
  interview?: { dateLabel: string; timeLabel: string; meetLink: string },
  phones?: EmailPhones,
) {
  const scheduleBlock = interview
    ? `<p><strong>Date:</strong> ${escapeHtml(interview.dateLabel)}<br>` +
      `<strong>Time:</strong> ${escapeHtml(interview.timeLabel)}</p>` +
      `<p><strong>Join via Google Meet:</strong><br>` +
      `<a href="${escapeHtml(interview.meetLink)}" target="_blank">${escapeHtml(interview.meetLink)}</a></p>` +
      `<p>A calendar invitation has been sent to your email address.</p>`
    : `<p>${escapeHtml(schedulingInfo)}</p>` +
      `<p>Please confirm your availability by reply to this email if a specific time was not already agreed.</p>`;

  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Thank you for your progress on the <strong>${escapeHtml(role)}</strong> role at Silverleaf Academy.</p>` +
    `<p><strong>Online Interview</strong></p>` +
    `<p>We would like to invite you to an online interview with our HR team.</p>` +
    scheduleBlock +
    buildFooter(phones)
  );
}

export function buildInPersonInterviewEmail(
  candidateName: string,
  role: string,
  locationInfo: string,
  schedule?: { location: string; dateLabel: string; timeLabel: string },
  phones?: EmailPhones,
) {
  const scheduleBlock = schedule
    ? `<p><strong>Date:</strong> ${escapeHtml(schedule.dateLabel)}<br>` +
      `<strong>Time:</strong> ${escapeHtml(schedule.timeLabel)}<br>` +
      `<strong>Location:</strong> ${escapeHtml(schedule.location)}</p>` +
      `<p>Please bring a valid ID and any documents you wish to share. Reply to confirm attendance.</p>`
    : `<p>${escapeHtml(locationInfo)}</p>` +
      `<p>Please bring a valid ID and any documents you wish to share. Reply to confirm attendance.</p>`;

  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Thank you for continuing with us for the <strong>${escapeHtml(role)}</strong> position.</p>` +
    `<p><strong>In-Person Interview</strong></p>` +
    `<p>We are pleased to invite you to meet our team in person.</p>` +
    scheduleBlock +
    buildFooter(phones)
  );
}

/** Email to IT asking them to create a work email for the new hire. */
export function buildItOnboardingRequestEmail(
  candidateName: string,
  role: string,
  formLink: string,
) {
  return (
    `<p>Hi IT Team,</p>` +
    `<p>We have a new hire who needs an email account set up:</p>` +
    `<table style="border-collapse:collapse;margin:1rem 0;">` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Name</td><td>${escapeHtml(candidateName)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Role</td><td>${escapeHtml(role)}</td></tr>` +
    `</table>` +
    `<p>Please create a Silverleaf Academy email account for this employee, then fill in the details using the link below:</p>` +
    `<p><a href="${escapeHtml(formLink)}" style="display:inline-block;padding:10px 20px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Fill in account details →</a></p>` +
    `<p>If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(formLink)}</p>` +
    `<p>Once you submit the form, HR will be notified automatically.</p>` +
    `<p>Thank you,<br>Silverleaf Academy HR System</p>`
  );
}

/** Email to HR with the credentials IT just created. */
export function buildItSubmissionNotificationEmail(
  candidateName: string,
  role: string,
  workEmail: string,
  tempPassword: string,
) {
  return (
    `<p>Hi HR Team,</p>` +
    `<p>IT has set up a work email account for the following new hire:</p>` +
    `<table style="border-collapse:collapse;margin:1rem 0;">` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Name</td><td>${escapeHtml(candidateName)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Role</td><td>${escapeHtml(role)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Work Email</td><td>${escapeHtml(workEmail)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Temp Password</td><td>${escapeHtml(tempPassword)}</td></tr>` +
    `</table>` +
    `<p><strong>Next steps:</strong></p>` +
    `<ol>` +
    `<li>Create the ed admin profile for this employee using the above credentials.</li>` +
    `<li>Go to the candidate page in the hiring system and click <strong>"Send welcome email"</strong> when the profile is ready.</li>` +
    `</ol>` +
    `<p style="color:#b91c1c;font-size:0.9em;">Please treat these credentials securely. This email contains sensitive information.</p>` +
    `<p>Silverleaf Academy HR System</p>`
  );
}

/** Welcome email sent to the candidate when HR completes onboarding. */
export function buildWelcomeEmail(
  candidateName: string,
  role: string,
  workEmail: string,
  startInfo?: string,
  phones?: EmailPhones,
  hasContract?: boolean,
) {
  const startBlock = startInfo
    ? `<p><strong>Reporting details:</strong><br>${escapeHtml(startInfo).replace(/\n/g, "<br>")}</p>`
    : `<p>Your manager or HR will be in touch shortly with your reporting instructions and first-day details.</p>`;

  const contractNote = hasContract
    ? `<p>Your employment contract is attached to this email. Please read it carefully and keep a copy for your records.</p>`
    : "";

  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>On behalf of the entire Silverleaf Academy team — <strong>welcome!</strong></p>` +
    `<p>We are thrilled to have you join us as <strong>${escapeHtml(role)}</strong>. You went through a thoughtful process, and we are excited about the value and passion you will bring to our mission of building a future where every child in Tanzania has access to a world-class education.</p>` +
    `<p><strong>Your work email address is:</strong></p>` +
    `<p style="font-size:1.1em;font-weight:700;color:#1e3a5f;">${escapeHtml(workEmail)}</p>` +
    `<p>Please use this email for all official Silverleaf Academy communications.</p>` +
    startBlock +
    contractNote +
    `<p>If you have any questions before your first day, do not hesitate to reach out to us at <a href="mailto:jobs@silverleaf.co.tz">jobs@silverleaf.co.tz</a>.</p>` +
    `<p>We cannot wait to see what we will build together.</p>` +
    buildFooter(phones)
  );
}

export function buildHiredEmail(candidateName: string, role: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://onboarding.silverleaf.co.tz";

  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Congratulations! We are delighted to offer you the <strong>${escapeHtml(role)}</strong> role at Silverleaf Academy.</p>` +
    `<p>Our HR team will share your contract, start date, and onboarding steps by reply to this email.</p>` +
    `<p>Once your ed-admin account is ready, you can sign in to the staff onboarding hub here:<br>` +
    `<a href="${escapeHtml(appUrl)}/en">${escapeHtml(appUrl)}/en</a></p>` +
    `<p>We are excited to welcome you to the team.</p>` +
    buildFooter()
  );
}

export function buildRejectedEmail(candidateName: string, role: string) {
  return (
    `<p>Dear ${escapeHtml(candidateName)},</p>` +
    `<p>Thank you for your interest in the <strong>${escapeHtml(role)}</strong> role at Silverleaf Academy and for the time you invested in our process.</p>` +
    `<p>After careful consideration, we will not be moving forward with your application at this time.</p>` +
    `<p>We encourage you to apply again when a suitable role opens. We wish you every success in your career.</p>` +
    buildFooter()
  );
}
