import express from "express";
import dotenv from "dotenv";
import getRawBody from "raw-body";
import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { DateTime } from "luxon";

dotenv.config();

// --- Setup Express ---
const app = express();
const port = process.env.PORT || 4000;
const slack = new WebClient(process.env.BOT_USER_TOKEN);

// --- Google Calendar ---
const gAuth = new GoogleAuth({
  keyFile: process.env.GCAL_KEY_FILE, // chemin vers le fichier de clé JSON
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
const gcalClientPromise = gAuth.getClient(); // Authentification client Google
const GCAL_ID = process.env.GCAL_CALENDAR_ID;

// --- Crée un événement Google Calendar ---
async function createGCalEvent({ what, desc, resrc, startAt }) {
  const authClient = await gcalClientPromise;
  const gcal = google.calendar({ version: "v3", auth: authClient });
  const tz = "Europe/Paris"; // Fuseau horaire

  // Crée l'événement a 14h15 - 14h45 à chaque fois
  await gcal.events.insert({
    calendarId: GCAL_ID,
    requestBody: {
      summary: what,
      description: [desc, resrc ? `Ressource: ${resrc}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      start: { dateTime: startAt.toISO(), timeZone: tz },
      end: { dateTime: startAt.plus({ minutes: 30 }).toISO(), timeZone: tz },
    },
  });
}

// --- Vérification signature Slack --- (middleware) obligatoire pour les routes Slack
async function verifySlack(req, res, next) {
  try {
    const raw = await getRawBody(req);
    const timestamp = req.headers["x-slack-request-timestamp"];
    const slackSig = req.headers["x-slack-signature"];
    if (!timestamp || !slackSig) return res.status(400).send("Bad Request");
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) {
      return res.status(400).send("Ignore stale request");
    }
    const base = `v0:${timestamp}:${raw.toString("utf8")}`;
    const mySig =
      "v0=" +
      crypto
        .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
        .update(base)
        .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(mySig), Buffer.from(slackSig))) {
      return res.status(401).send("Invalid signature");
    }
    const params = new URLSearchParams(raw.toString("utf8"));
    req.body = Object.fromEntries(params.entries());
    next();
  } catch (e) {
    console.error(e);
    return res.status(400).send("Bad Request");
  }
}

// --- Slash commands ---
app.post("/slack/commands", verifySlack, async (req, res) => {
  try {
    if (req.body.command === "/ping") { // simple test
      return res.json({ response_type: "ephemeral", text: "pong 🏓" });
    }

    // Le gros de notre application
    if (req.body.command === "/learning") {
      const { trigger_id, channel_id } = req.body;
      res.status(200).send();

      await slack.views.open({
        trigger_id,
        view: {
          type: "modal",
          callback_id: "learning_form",
          private_metadata: JSON.stringify({ channel_id }),
          title: { type: "plain_text", text: "Learning" },
          submit: { type: "plain_text", text: "Enregistrer" },
          close: { type: "plain_text", text: "Annuler" },
          blocks: [
            {
              type: "input",
              block_id: "who_block",
              label: { type: "plain_text", text: "Personne" },
              element: {
                type: "users_select",
                action_id: "who_input",
                placeholder: {
                  type: "plain_text",
                  text: "Choisir une personne",
                },
              },
            },
            {
              type: "input",
              block_id: "what_block",
              label: { type: "plain_text", text: "Nom de la learning" },
              element: {
                type: "plain_text_input",
                action_id: "what_input",
                placeholder: {
                  type: "plain_text",
                  text: "ex: Express + Slack API",
                },
              },
            },
            {
              type: "input",
              block_id: "when_block",
              label: { type: "plain_text", text: "Jour" },
              element: {
                type: "datepicker",
                action_id: "when_input",
                placeholder: {
                  type: "plain_text",
                  text: "Sélectionne une date",
                },
              },
            },
            // Pour ajouter l'heure à voir si besoin
            // {
            //   type: "input",
            //   block_id: "time_block",
            //   label: { type: "plain_text", text: "Heure de début" },
            //   element: {
            //     type: "timepicker",
            //     action_id: "time_input",
            //     placeholder: { type: "plain_text", text: "HH:MM" },
            //   },
            // },
            {
              type: "input",
              block_id: "desc_block",
              label: { type: "plain_text", text: "Description" },
              element: {
                type: "plain_text_input",
                action_id: "desc_input",
                multiline: true,
                placeholder: {
                  type: "plain_text",
                  text: "Quelques lignes…",
                },
              },
            },
            {
              type: "input",
              block_id: "res_block",
              optional: true,
              label: { type: "plain_text", text: "Ressource (URL)" },
              element: {
                type: "plain_text_input",
                action_id: "res_input",
                placeholder: { type: "plain_text", text: "https://…" },
              },
            },
          ],
        },
      });
      return;
    }

    res.status(404).send("Unknown command");
  } catch (err) {
    console.error("commands ERROR:", err?.data || err);
    res.status(500).send("Internal error");
  }
});

// --- Interactions ---
// Une fois le formulaire soumis, on traite les données
app.post("/slack/interactions", verifySlack, async (req, res) => {
  const payload = JSON.parse(req.body.payload || "{}");

  if (
    payload.type === "view_submission" &&
    payload.view.callback_id === "learning_form"
  ) {
    const pv = payload.view.state.values;

    const who = pv["who_block"]["who_input"].selected_user;
    const what = pv["what_block"]["what_input"].value?.trim();
    const when = pv["when_block"]["when_input"].selected_date;
    const desc = pv["desc_block"]["desc_input"].value?.trim();
    const resrc = pv["res_block"]?.["res_input"]?.value?.trim() || "";

    const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);
    const errors = {};
    if (!what) errors["what_block"] = "Nom requis";
    if (!when) errors["when_block"] = "Date requise";
    if (resrc && !isUrl(resrc)) errors["res_block"] = "URL invalide";

    if (Object.keys(errors).length) {
      return res.json({ response_action: "errors", errors });
    }

    const targetChannel = process.env.LEARNING_CHANNEL_ID;
    if (!targetChannel) {
      await slack.chat.postMessage({
        channel: payload.user.id,
        text: "LEARNING_CHANNEL_ID non défini côté serveur.",
      });
      return res.json({ response_action: "clear" });
    }

    // Ferme le modal immédiatement
    res.json({ response_action: "clear" });

   // Heure fixe : 14h15 → 14h45 (30 min)
const tz = "Europe/Paris";
const startAt = DateTime.fromISO(when, { zone: tz }).set({
  hour: 14,
  minute: 15,
  second: 0,
  millisecond: 0,
});
const endAt = startAt.plus({ minutes: 30 }); // Non utilisé mais peut servir si besoin


    // Crée l'événement Google Calendar
    try {
      await createGCalEvent({ what, desc, resrc, startAt });
    } catch (err) {
      console.error("Erreur GCal:", err?.response?.data || err);
      await slack.chat.postMessage({
        channel: payload.user.id,
        text: "Impossible de créer l'événement Google Calendar.",
      });
    }

    // Message dans le channel Slack
    await slack.chat.postMessage({
      channel: targetChannel,
      text: `Learning: ${what}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "Nouvelle learning" } },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Présentateur de la learning:*\n<@${who}>`,
            },
            {
              type: "mrkdwn",
              text: `*Date:*\n${when} ${startAt.toFormat("HH:mm")}`,
            },
            { type: "mrkdwn", text: `*Sujet de la learning:*\n${what}` },
          ],
        },
        ...(desc
          ? [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Description:*\n${desc}` },
              },
            ]
          : []),
        ...(resrc
          ? [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Ressource:*\n${resrc}` },
              },
            ]
          : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Ajouté par <@${payload.user.id}>`,
            },
          ],
        },
      ],
    });

    return;
  }
  res.status(200).send();
});

// --- Start server --- On écoute le serveur
app.listen(port, () =>
  console.log(`Listening on http://localhost:${port}`)
);