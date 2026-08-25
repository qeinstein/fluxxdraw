import { createClient } from "@neondatabase/serverless";

export const config = { runtime: "edge" };

type LibraryRow = {
  id: string;
  name: string;
  description: string | null;
  authors: unknown;
  source: string | null;
  preview: string | null;
  created: string | null;
  updated: string | null;
  version: number | null;
};

export default async function handler(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Library storage is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const sql = createClient(process.env.DATABASE_URL);
  try {
    const result = await sql.query<LibraryRow>(
      `select id, name, description, authors, source, preview, created, updated, version
       from libraries order by name asc`,
    );
    return Response.json(result.rows, { headers: { "cache-control": "public, max-age=300" } });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
