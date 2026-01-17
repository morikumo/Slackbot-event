// google-calendar.js
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import dotenv from "dotenv";
dotenv.config();

const gAuth = new GoogleAuth({
	keyFile: process.env.GCAL_KEY_FILE, // chemin vers le fichier de clé JSON
	scopes: ["https://www.googleapis.com/auth/calendar"],
});

/**
 * Creates a Google Calendar event with a Google Meet link
 * @param {Object} params
 * @param {string} params.what - Event title/summary
 * @param {string} params.desc - Event description
 * @param {string} params.resrc - Optional resource info
 * @param {Object} params.startAt - Luxon DateTime for event start
 * @param {Object} params.slackUser - Slack user info from slash command
 * @param {string} params.slackUser.id - Slack user ID
 * @param {string} params.slackUser.name - Slack username
 * @param {string} params.slackUser.realName - Slack user's real name
 * @param {string} params.slackUser.email - Slack user's email (if available)
 */
export async function createGCalEvent({ what, desc, resrc, startAt, slackUser }) {
	const authClient = await gAuth.getClient();
	const gcal = google.calendar({ version: "v3", auth: authClient });
	const tz = "Europe/Paris";

	// Build description with Slack user info
	const descParts = [
		desc,
		resrc ? `Ressource: ${resrc}` : "",
		"---",
		`Créé par: ${slackUser?.realName || slackUser?.name || "Utilisateur Slack"}`,
		slackUser?.email ? `Email: ${slackUser.email}` : "",
		slackUser?.id ? `Slack ID: ${slackUser.id}` : "",
	].filter(Boolean);

	const res = await gcal.events.insert({
		calendarId: process.env.GCAL_CALENDAR_ID || "primary",
		conferenceDataVersion: 1,
		requestBody: {
			summary: what,
			description: descParts.join("\n"),
			start: { dateTime: startAt.toISO(), timeZone: tz },
			end: { dateTime: startAt.plus({ minutes: 60 }).toISO(), timeZone: tz },
			conferenceData: {
				createRequest: { requestId: `meet-${Date.now()}` },
			},
			reminders: { useDefault: false },
			// Add Slack user as attendee if email is available
			...(slackUser?.email && {
				attendees: [{ email: slackUser.email, displayName: slackUser.realName || slackUser.name }],
			}),
		},
	});

	return res.data; // contains hangoutLink for Google Meet
}
