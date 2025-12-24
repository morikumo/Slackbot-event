// google-calendar.js
import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

export async function createGCalEvent({ what, desc, resrc, startAt }) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GCAL_OAUTH_CLIENT_ID,
    process.env.GCAL_OAUTH_CLIENT_SECRET,
    process.env.GCAL_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GCAL_OAUTH_REFRESH_TOKEN,
  });

  const gcal = google.calendar({ version: "v3", auth: oauth2Client });
  const tz = "Europe/Paris";

  const res = await gcal.events.insert({
    calendarId: process.env.GCAL_CALENDAR_ID || "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: what,
      description: [desc, resrc ? `Ressource: ${resrc}` : ""].filter(Boolean).join("\n\n"),
      start: { dateTime: startAt.toISO(), timeZone: tz },
      end: { dateTime: startAt.plus({ minutes: 60 }).toISO(), timeZone: tz },
      conferenceData: {
        createRequest: { requestId: `learning-${Date.now()}` },
      },
      reminders: { useDefault: false },
    },
  });

  return res.data; // contient hangoutLink si OK
}
