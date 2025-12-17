import { Client as NotionClient } from "@notionhq/client"; 
import dotenv from "dotenv"; 
dotenv.config(); 

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY }); 
const page_id = process.env.NOTION_PARENT_PAGE_ID;

export async function createNotionLearning({ who, what, when, startAt, desc, resrc }) {
  // Si le parent ou la clé est manquante, on s’arrête
  if (!page_id || !notion) return;

  const dateIso = startAt?.toISO?.() ?? `${when}T00:00:00.000Z`;

  await notion.pages.create({
    parent: { page_id: page_id },      // page_id au lieu de database_id
    properties: {
      title: {
        title: [{ text: { content: what } }],
      },
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: `Présentateur: <@${who}>` } },
            { type: "text", text: { content: `\nDate: ${when} ${startAt?.toFormat?.("HH:mm") || ""}` } },
            { type: "text", text: { content: desc ? `\nDescription: ${desc}` : "" } },
            { type: "text", text: { content: resrc ? `\nRessource: ${resrc}` : "" } },
          ].filter(t => t.text.content),
        },
      },
    ],
  });
}


