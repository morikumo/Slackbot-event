// reminders.js
import { DateTime } from "luxon";
import dotenv from "dotenv";
dotenv.config();

// Programme les rappels Slack (veille + jour J)
export async function scheduleLearningReminders({ startAt, what, who, targetChannel, slack }) {
  const tz = "Europe/Paris";
  const now = DateTime.now().setZone(tz);

  const reminderHours = Number(process.env.LEARNING_REMINDER_HOURS ?? 0);
  const reminderMinutes = Number(process.env.LEARNING_REMINDER_MINUTES ?? 0);

  // --- 1) Rappel veille) ---
  if (reminderHours > 0 || reminderMinutes > 0) {
    const reminderAt = startAt.minus({
      hours: reminderHours,
      minutes: reminderMinutes,
    });

    if (reminderAt > now) {
      await slack.chat.scheduleMessage({
        channel: targetChannel,
        post_at: Math.floor(reminderAt.toSeconds()),
        text: `Rappel: la learning «${what}» commence bientôt.
Présentateur: <@${who}>`,
      });
    } else {
      console.log("[RAPPEL VEILLE] ignoré → passé");
    }
  }

  // --- 2) Rappel jour J à 11h ---
  const sameDayReminder = startAt.set({
    hour: 11,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  if (sameDayReminder > now) {
    await slack.chat.scheduleMessage({
      channel: targetChannel,
      post_at: Math.floor(sameDayReminder.toSeconds()),
      text: `Rappel: la learning «${what}» commence aujourd’hui à ${startAt.toFormat("HH:mm")}
Présentateur: <@${who}>`,
    });
  } else {
    console.log("[RAPPEL JOUR J] ignoré → passé");
  }
}
