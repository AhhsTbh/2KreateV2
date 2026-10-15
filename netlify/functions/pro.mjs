// Netlify runs this at /api/pro. The real logic is in ../lib/pro-core.mjs.
// Needs PRO_ADMIN_KEY set in Netlify > Site configuration > Environment variables.
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/pro-core.mjs";

export default async (req) => {
  const store = getStore({ name: "pro-codes", consistency: "strong" });
  return handle(req, store, process.env);
};

export const config = { path: "/api/pro" };
