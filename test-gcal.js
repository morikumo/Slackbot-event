// test-gcal.js
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import dotenv from "dotenv";
dotenv.config();

const auth = new GoogleAuth({
  keyFile: "./learning-bot-475912-7eb8ef794b96.json", // ton fichier
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
const gcal = google.calendar({ version: "v3", auth: await auth.getClient() });

const calendarId = process.env.GCAL_CALENDAR_ID; // <- IMPORTANT
if (!calendarId) throw new Error("GCAL_CALENDAR_ID manquant dans .env");

const start = new Date(Date.now() + 60 * 60 * 1000); // +1h
const end   = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h

const evt = await gcal.events.insert({
  calendarId,
  requestBody: {
    summary: "Test SlackBot",
    description: "Créé depuis script de test",
    start: { dateTime: start.toISOString(), timeZone: "Europe/Paris" },
    end:   { dateTime: end.toISOString(),   timeZone: "Europe/Paris" },
  },
});

console.log("Created:", evt.data.htmlLink);

