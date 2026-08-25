import { createClient } from "@neondatabase/serverless";

export const config = { runtime: "edge" };

export default async function handler(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Library storage is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const { id } = await context.params;
  const sql = createClient(process.env.DATABASE_URL);
  try {
    const result = await sql.query<{ content: unknown }>(
      "select content from libraries where id = $1 limit 1",
      [id],
    );
    if (result.rows.length === 0) {
      return Response.json({ error: "Library not found" }, { status: 404 });
    }
    return Response.json(result.rows[0].content, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
