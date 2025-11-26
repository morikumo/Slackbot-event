
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

// --- Google Calendar ---
const gAuth = new GoogleAuth({
  keyFile: process.env.GCAL_KEY_FILE, // chemin vers le fichier de clé JSON
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
const gcalClientPromise = gAuth.getClient(); // Authentification client Google
const GCAL_ID = process.env.GCAL_CALENDAR_ID;

// --- Crée un événement Google Calendar ---
export async function createGCalEvent({ what, desc, resrc, startAt }) {
  const authClient = await gcalClientPromise;
  const gcal = google.calendar({ version: "v3", auth: authClient });
  const tz = "Europe/Paris";
  
  const res = await gcal.events.insert({
    calendarId: GCAL_ID,
    conferenceDataVersion: 1, // ⬅️ important pour la création de visio
    requestBody: {
      summary: what,
      description: [desc, resrc ? `Ressource: ${resrc}` : ""]
      .filter(Boolean)
      .join("\n\n"),
      start: { dateTime: startAt.toISO(), timeZone: tz },
      end: { dateTime: startAt.plus({ minutes: 60 }).toISO(), timeZone: tz }, // ou 30 si tu as déjà changé
      conferenceData: {
        createRequest: {
          requestId: `learning-${Date.now()}`
        }
      }
    },
  });
  
  return res.data;
}