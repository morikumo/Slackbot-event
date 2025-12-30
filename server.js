import express from "express";
import dotenv from "dotenv";
import getRawBody from "raw-body";
import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import { DateTime } from "luxon";
import { createNotionLearning } from "./notion.js";
import { createGCalEvent } from "./google-calendar.js";
import { scheduleLearningReminders } from "./reminder.js";
import { healthRoutes } from "./health.js";
import { google } from "googleapis";

// --- Load .env ---

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GCAL_OAUTH_CLIENT_ID,
  process.env.GCAL_OAUTH_CLIENT_SECRET,
  process.env.GCAL_OAUTH_REDIRECT_URI
);


// --- Setup Express ---
const app = express();
const port = process.env.PORT || 4000;
const slack = new WebClient(process.env.BOT_USER_TOKEN);

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

// --- Health check pour la CI github actions ---
healthRoutes(app);

// --- Slash commands ---
app.post("/slack/commands", verifySlack, async (req, res) => {
  console.log("➡️ Requête Slack reçue");
  try {
    if (req.body.command === "/ping") { // simple test
      return res.json({ response_type: "ephemeral", text: "pong" });
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
    
    //const endAt = startAt.plus({ minutes: 30 }); // Non utilisé mais peut servir si besoin
    
    await scheduleLearningReminders({
      startAt,
      what,
      who,
      targetChannel,
      slack
    });
    
    
    // Crée l'événement Google Calendar
    let meetLink = "";
    try {
      const event = await createGCalEvent({ what, desc, resrc, startAt });
      meetLink = event?.hangoutLink || "";
    } catch (err) {
      console.error("Erreur GCal:", err?.response?.data || err);
      await slack.chat.postMessage({
        channel: payload.user.id,
        text: "Impossible de créer l'événement Google Calendar.",
      });
    }
    
    // Message dans le channel Slack
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "Nouvelle learning" } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Présentateur de la learning:*\n<@${who}>` },
          { type: "mrkdwn", text: `*Date:*\n${when} ${startAt.toFormat("HH:mm")}` },
          { type: "mrkdwn", text: `*Sujet de la learning:*\n${what}` }
        ]
      },
      ...(desc
        ? [{ type: "section", text: { type: "mrkdwn", text: `*Description:*\n${desc}` } }]
        : []),
        ...(resrc
          ? [{ type: "section", text: { type: "mrkdwn", text: `*Ressource:*\n${resrc}` } }]
          : []),
          ...(meetLink
            ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Lien Meet:*\n${meetLink}` }
            }]
            : []),
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Ajouté par <@${payload.user.id}>` }]
            }
          ];
          
          await createNotionLearning({ // Enregistrement Notion
            who, what, when, startAt, desc, resrc 
          });          
          
          await slack.chat.postMessage({ // Message Slack une fois tout prêt
            channel: targetChannel,
            text: `Learning: ${what}`,
            blocks,
          });
          
          
          return;
        }
        res.status(200).send();
      });
      
      
      
      // --- Functional test part ---
      app.get("/google/oauth/start", (req, res) => {
        const url = oauth2Client.generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: ["https://www.googleapis.com/auth/calendar"],
        });
        res.redirect(url);
      });
      
      app.get("/google/oauth/callback", async (req, res) => {
        const code = req.query.code;
        if (!code) return res.status(400).send("Missing code");
        
        const { tokens } = await oauth2Client.getToken(code);
        
        // ⚠️ IMPORTANT: copie le refresh_token et mets-le dans Render (Environment)
        res.send(`<pre>${tokens.refresh_token || "NO_REFRESH_TOKEN_RETURNED"}</pre>`);
      });
      
      app.get("/debug/env", (req, res) => {
        res.json({
          hasClientId: Boolean(process.env.GCAL_OAUTH_CLIENT_ID),
          hasClientSecret: Boolean(process.env.GCAL_OAUTH_CLIENT_SECRET),
          redirectUri: process.env.GCAL_OAUTH_REDIRECT_URI || null,
          hasRefreshToken: Boolean(process.env.GCAL_OAUTH_REFRESH_TOKEN),
          refreshLen: (process.env.GCAL_OAUTH_REFRESH_TOKEN || "").length,
          calendarId: process.env.GCAL_CALENDAR_ID || null,
        });
      });
      
      app.get("/debug/status", requireAdmin, async (req, res) => {
        const now = new Date().toISOString();
        
        const env = {
          slack: {
            hasBotToken: Boolean(process.env.BOT_USER_TOKEN),
            hasSigningSecret: Boolean(process.env.SLACK_SIGNING_SECRET),
            learningChannel: Boolean(process.env.LEARNING_CHANNEL_ID),
          },
          notion: {
            hasApiKey: Boolean(process.env.NOTION_API_KEY),
            hasDbId: Boolean(process.env.NOTION_DATABASE_ID || process.env.NOTION_PARENT_PAGE_ID),
          },
          gcal: {
            hasClientId: Boolean(process.env.GCAL_OAUTH_CLIENT_ID),
            hasClientSecret: Boolean(process.env.GCAL_OAUTH_CLIENT_SECRET),
            hasRedirectUri: Boolean(process.env.GCAL_OAUTH_REDIRECT_URI),
            hasRefreshToken: Boolean(process.env.GCAL_REFRESH_TOKEN),
            calendarId: process.env.GCAL_CALENDAR_ID ? "set" : "missing",
          },
        };
        
        // Ping Google OAuth (sans créer d’event) -> rapide et safe
        let gcalPing = { ok: null, error: null };
        try {
          const { google } = await import("googleapis");
          const oauth2Client = new google.auth.OAuth2(
            process.env.GCAL_OAUTH_CLIENT_ID,
            process.env.GCAL_OAUTH_CLIENT_SECRET,
            process.env.GCAL_OAUTH_REDIRECT_URI
          );
          oauth2Client.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
          await oauth2Client.getAccessToken(); // ← détecte invalid_grant direct
          gcalPing.ok = true;
        } catch (e) {
          gcalPing.ok = false;
          gcalPing.error = e?.response?.data || e?.message || String(e);
        }
        
        // (Optionnel) ping Notion léger (sans écrire) : récupérer la DB
        let notionPing = { ok: null, error: null };
        try {
          const { Client } = await import("@notionhq/client");
          const notion = new Client({ auth: process.env.NOTION_API_KEY });
          const dbId = process.env.NOTION_DATABASE_ID || process.env.NOTION_PARENT_PAGE_ID;
          if (!dbId) throw new Error("Missing Notion DB ID");
          await notion.databases.retrieve({ database_id: dbId });
          notionPing.ok = true;
        } catch (e) {
          notionPing.ok = false;
          notionPing.error = e?.body || e?.message || String(e);
        }
        
        // Slack ping léger : auth.test
        let slackPing = { ok: null, error: null };
        try {
          const { WebClient } = await import("@slack/web-api");
          const slack = new WebClient(process.env.BOT_USER_TOKEN);
          await slack.auth.test();
          slackPing.ok = true;
        } catch (e) {
          slackPing.ok = false;
          slackPing.error = e?.data || e?.message || String(e);
        }
        
        res.json({
          at: now,
          env,
          ping: {
            slack: slackPing,
            notion: notionPing,
            gcal: gcalPing,
          },
          lastKnown: healthState,
        });
      });
      
      
      // --- Start server --- On écoute le serveur
      app.listen(port, () =>
        console.log(`Listening on http://localhost:${port}`)
    );