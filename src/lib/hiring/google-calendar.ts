import "server-only";

import { randomUUID } from "crypto";

// Calendar events are created on the OAuth account's own calendar (it@silverleaf.co.tz).
// HR_EMAIL (jobs@silverleaf.co.tz) is always added as an attendee so they receive the invite.
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const HR_EMAIL = process.env.GOOGLE_HR_EMAIL || "jobs@silverleaf.co.tz";
const TZ = "Africa/Dar_es_Salaam";

export type CalendarEventResult =
  | { ok: true; eventId: string; meetLink: string; eventLink: string }
  | { ok: false; error: string };

export async function createInterviewEvent(params: {
  candidateName: string;
  candidateEmail: string;
  role: string;
  startIso: string;
  endIso: string;
  additionalAttendees?: string[];
}): Promise<CalendarEventResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: "Google OAuth credentials not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)" };
  }

  try {
    const { google } = await import("googleapis");

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: `Interview: ${params.candidateName} — ${params.role}`,
        start: { dateTime: params.startIso, timeZone: TZ },
        end: { dateTime: params.endIso, timeZone: TZ },
        attendees: [
          { email: params.candidateEmail, displayName: params.candidateName },
          { email: HR_EMAIL, displayName: "Silverleaf HR" },
          ...(params.additionalAttendees ?? []).map((email) => ({ email })),
        ],
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        description: `Online interview for the ${params.role} position at Silverleaf Academy.`,
      },
    });

    const meetLink = event.data.hangoutLink || "";
    const eventLink = event.data.htmlLink || "";
    const eventId = event.data.id || "";

    if (!meetLink) {
      return {
        ok: false,
        error: "Event created but no Meet link returned — check that the Google account has Meet enabled.",
      };
    }

    return { ok: true, eventId, meetLink, eventLink };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
