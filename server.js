import express from "express";
import dotenv from "dotenv";
import getRawBody from "raw-body";
import crypto from "crypto";
import { WebClient } from "@slack/web-api";

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;
const slack = new WebClient(process.env.BOT_USER_TOKEN);

// Middleware pour vérifier la signature Slack
// Voir https://api.slack.com/authentication/verifying-requests-from-slack
// Necessaire pour les commandes slash et les interactions
async function verifySlack(req, res, next) {
  try {
    const raw = await getRawBody(req);
    const timestamp = req.headers["x-slack-request-timestamp"];
    const slackSig = req.headers["x-slack-signature"];
    if (!timestamp || !slackSig) return res.status(400).send("Bad Request");
    if (Math.abs(Date.now()/1000 - Number(timestamp)) > 60*5) {
      return res.status(400).send("Ignore stale request");
    }
    const base = `v0:${timestamp}:${raw.toString("utf8")}`;
    const mySig = "v0=" + crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET).update(base).digest("hex");
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


// Routes
// Pour les commandes slash
// Logique pour la commande /learning
app.post("/slack/commands", verifySlack, async (req, res) => {
  try {
    if (req.body.command === "/ping") {
       return res.json({ response_type: "ephemeral", text: "pong 🏓" });
    }

    // Ouvre le modal pour la commande /learning
    if (req.body.command === "/learning") {
      const { trigger_id, channel_id } = req.body;
      res.status(200).send(); // ACK rapide
        
      // Await sinon Slack annule la requête au bout de 3s
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
              element: { type: "users_select", action_id: "who_input", placeholder: { type: "plain_text", text: "Choisir une personne" } }
            },
            {
              type: "input",
              block_id: "what_block",
              label: { type: "plain_text", text: "Nom de la learning" },
              element: { type: "plain_text_input", action_id: "what_input", placeholder: { type: "plain_text", text: "ex: Express + Slack API" } }
            },
            {
              type: "input",
              block_id: "when_block",
              label: { type: "plain_text", text: "Jour" },
              element: { type: "datepicker", action_id: "when_input", placeholder: { type: "plain_text", text: "Sélectionne une date" } }
            },
            {
              type: "input",
              block_id: "desc_block",
              label: { type: "plain_text", text: "Description" },
              element: { type: "plain_text_input", action_id: "desc_input", multiline: true, placeholder: { type: "plain_text", text: "Quelques lignes…" } }
            },
            {
              type: "input",
              block_id: "res_block",
              optional: true,
              label: { type: "plain_text", text: "Ressource (URL)" },
              element: { type: "plain_text_input", action_id: "res_input", placeholder: { type: "plain_text", text: "https://…" } }
            }
          ]
        }
      });

      return;
    }

    res.status(404).send("Unknown command");
  } catch (err) {
    // En cas d'erreur, on log côté serveur
    // Pour debugger
    console.error("commands ERROR:", err?.data || err);
  }
});

// Pour les interactions (modals, buttons, etc.)
// Logique pour le modal de la commande /learning
// Les interactions sont envoyées en POST à l'URL définie dans l'app Slack
// Permettes de finaliser le formulaire et de poster dans le channel
// Voir https://api.slack.com/interactivity
app.post("/slack/interactions", verifySlack, async (req, res) => {
  const payload = JSON.parse(req.body.payload || "{}");

  if (payload.type === "view_submission" && payload.view.callback_id === "learning_form") {
    const pv = payload.view.state.values;

    const who   = pv["who_block"]["who_input"].selected_user;
    const what  = pv["what_block"]["what_input"].value?.trim();
    const when  = pv["when_block"]["when_input"].selected_date;
    const desc  = pv["desc_block"]["desc_input"].value?.trim();
    const resrc = pv["res_block"]?.["res_input"]?.value?.trim() || "";

    // Validation simple
    // Si ces champs sont vides, on renvoie une erreur
    // Le modal reste ouvert et affiche les erreurs
    // Voir https://api.slack.com/surfaces/modals/using#validating
    const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);
    const errors = {};
    if (!what) errors["what_block"] = "Nom requis";
    if (!when) errors["when_block"] = "Date requise";
    if (resrc && !isUrl(resrc)) errors["res_block"] = "URL invalide (http/https)";

    if (Object.keys(errors).length) {
      return res.json({ response_action: "errors", errors });
    }

    // Channel cible unique (depuis .env) Ici le channel learning session
    const targetChannel = process.env.LEARNING_CHANNEL_ID;
    // Sécurité si on ne trouve pas le channel
    if (!targetChannel) {
      console.error("LEARNING_CHANNEL_ID manquant dans .env");
      await slack.chat.postMessage({
        channel: payload.user.id,
        text: "Configuration manquante: LEARNING_CHANNEL_ID n'est pas défini côté serveur."
      });
      return res.json({ response_action: "clear" });
    }

    // Poste le récap dans le channel cible
    await slack.chat.postMessage({
      channel: targetChannel,
      text: `Learning: ${what}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "Nouvelle learning" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Présentateur de la learning:*\n<@${who}>` },
            { type: "mrkdwn", text: `*Date:*\n${when}` },
            { type: "mrkdwn", text: `*Sujet de la learning:*\n${what}` }
          ]
        },
        ...(desc ? [{ type: "section", text: { type: "mrkdwn", text: `*Description:*\n${desc}` } }] : []),
        ...(resrc ? [{ type: "section", text: { type: "mrkdwn", text: `*Ressource:*\n${resrc}` } }] : []),
        { type: "context", elements: [{ type: "mrkdwn", text: `Ajouté par <@${payload.user.id}>` }] }
      ]
    });

    return res.json({ response_action: "clear" });
  }

  res.status(200).send();
});

app.listen(port, () => console.log(`Listening on http://localhost:${port}`));