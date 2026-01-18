import { google } from "googleapis";
import { Client as NotionClient } from "@notionhq/client";
import { WebClient } from "@slack/web-api";
import { requireAdmin } from "./admin.js";

export function registerDebugRoutes(app) {
  app.get("/debug/status", requireAdmin, async (req, res) => {
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
        hasRefreshToken: Boolean(process.env.GCAL_OAUTH_REFRESH_TOKEN),
        calendarId: process.env.GCAL_CALENDAR_ID ? "set" : "missing",
      },
    };

    // Slack ping
    let slackPing = { ok: null, error: null };
    try {
      const slack = new WebClient(process.env.BOT_USER_TOKEN);
      await slack.auth.test();
      slackPing.ok = true;
    } catch (e) {
      slackPing.ok = false;
      slackPing.error = e?.data || e?.message || String(e);
    }

    // Notion ping
    let notionPing = { ok: null, error: null };
    try {
      const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
      const dbId = process.env.NOTION_DATABASE_ID || process.env.NOTION_PARENT_PAGE_ID;
      if (!dbId) throw new Error("Missing Notion DB ID");
      await notion.databases.retrieve({ database_id: dbId });
      notionPing.ok = true;
    } catch (e) {
      notionPing.ok = false;
      notionPing.error = e?.body || e?.message || String(e);
    }

    // Google OAuth ping (detect invalid_grant)
    let gcalPing = { ok: null, error: null };
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GCAL_OAUTH_CLIENT_ID,
        process.env.GCAL_OAUTH_CLIENT_SECRET,
        process.env.GCAL_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: process.env.GCAL_OAUTH_REFRESH_TOKEN });
      await oauth2Client.getAccessToken();
      gcalPing.ok = true;
    } catch (e) {
      gcalPing.ok = false;
      gcalPing.error = e?.response?.data || e?.message || String(e);
    }

    res.json({
      at: new Date().toISOString(),
      env,
      ping: { slack: slackPing, notion: notionPing, gcal: gcalPing },
    });
  });
}

/* LA COMMANDE CURL POUR TESTER

curl -H "x-admin-token: un_token_long_random" \
  https://slackbot-event.onrender.com/debug/status


Sinon directement sur navigateur (Mozilla) :
https://slackbot-event.onrender.com/debug/status

Inspecteur -> Network -> Cliquer sur la requete (Forbidden)
Vous verrez la possibilité de renvoyer, cliquez dessus.
Une liste de header (en-tetes) sera afficher, ajoutez-y votre entete, ici :
- En tete : x-admin-token 
- Value : un_token_long_random

Lancer la requete et regarder la réponse.

N'oubliez pas que c'est plus simple via curl
*/
