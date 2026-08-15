import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const globalForDb = global as unknown as {
  sql: postgres.Sql | undefined;
};

function getDb() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is missing. Add it in .env.local.');
  }

  // Disable TLS certificate verification since we are connecting to a serverless pooler
  // and need stable connections.
  return postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = globalForDb.sql || getDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.sql = sql;
}

export default sql;
