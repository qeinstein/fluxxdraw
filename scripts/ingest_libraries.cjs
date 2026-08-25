const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_E6ulRbwKfhV1@ep-twilight-bar-axgybo21-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('Creating table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS libraries (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      authors JSONB,
      source TEXT,
      preview TEXT,
      created DATE,
      updated DATE,
      version INT,
      content JSONB
    )
  `);

  console.log('Fetching libraries.json...');
  const res = await fetch('https://libraries.excalidraw.com/libraries.json');
  const libraries = await res.json();

  console.log(`Found ${libraries.length} libraries. Starting ingestion...`);

  for (const lib of libraries) {
    try {
      const dbId = lib.id || lib.source;
      console.log(`Processing: ${lib.name} (${dbId})`);
      const rawUrl = `https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/${lib.source}`;
      
      const contentRes = await fetch(rawUrl);
      if (!contentRes.ok) {
        console.warn(`  Failed to fetch content for ${lib.name}, status: ${contentRes.status}`);
        continue;
      }
      const content = await contentRes.text();

      await client.query(`
        INSERT INTO libraries (id, name, description, authors, source, preview, created, updated, version, content)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          authors = EXCLUDED.authors,
          source = EXCLUDED.source,
          preview = EXCLUDED.preview,
          updated = EXCLUDED.updated,
          version = EXCLUDED.version,
          content = EXCLUDED.content
      `, [
        dbId,
        lib.name,
        lib.description,
        JSON.stringify(lib.authors || []),
        lib.source,
        lib.preview,
        lib.created,
        lib.updated,
        lib.version,
        content
      ]);
      console.log(`  Saved ${lib.name}`);
    } catch (err) {
      console.error(`  Error on ${lib.name}:`, err.message);
    }
  }

  console.log('Done.');
  await client.end();
}

main().catch(console.error);
