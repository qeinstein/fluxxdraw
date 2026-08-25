import { neon } from "@neondatabase/serverless";

export const config = { runtime: "edge" };

export default async function handler(
  request: Request,
): Promise<Response> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL;
  if (!databaseUrl) {
    return Response.json(
      { error: "Library storage is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = decodeURIComponent(segments.at(-2) ?? "");
  if (!id) return Response.json({ error: "Library id is required" }, { status: 400 });
  const sql = neon(databaseUrl);
  try {
    const result = await sql<{ content: unknown }[]>`
      select content from libraries where id = ${id} limit 1
    `;
    if (result.length === 0) {
      return Response.json({ error: "Library not found" }, { status: 404 });
    }
    return Response.json(result[0].content, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
