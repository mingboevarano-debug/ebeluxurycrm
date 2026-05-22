// src/meeting.js
import { client } from "./db.js";

/** Get the upcoming meeting (the one with the nearest future datetime) */
export async function getNextMeeting() {
  if (!client) return null;
  const col = client.db().collection("meetings");
  const now = new Date();
  const doc = await col.findOne({ datetime: { $gt: now } }, { sort: { datetime: 1 } });
  return doc ? { id: String(doc._id), datetime: doc.datetime } : null;
}

/** Set (or replace) the next meeting datetime */
export async function setNextMeeting(datetime) {
  if (!client) throw new Error("Mongo client not initialized");
  const col = client.db().collection("meetings");
  // Remove any existing future meetings and insert the new one
  await col.deleteMany({});
  const r = await col.insertOne({ datetime: new Date(datetime) });
  return { id: String(r.insertedId), datetime: new Date(datetime) };
}
