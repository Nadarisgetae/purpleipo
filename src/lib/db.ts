import postgres from 'postgres';

/**
 * Lazily creates the postgres client on first use.
 * The client is NEVER instantiated at module-load time —
 * only when a query is actually executed.
 *
 * This prevents Vercel build errors (ERR_INVALID_URL / missing DATABASE_URL).
 *
 * CRITICAL FIX: The Proxy target MUST be a function (not {}),
 * otherwise sql`...` tagged template calls fail with "sql is not a function".
 */

let _client: postgres.Sql | null = null;

function getClient(): postgres.Sql {
  if (_client) return _client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to Vercel Environment Variables.');
  }

  _client = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'prefer',
  });

  return _client;
}

// The target MUST be a function so the apply trap fires for sql`...` calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = new Proxy((() => {}) as unknown as postgres.Sql, {
  // Handles: sql`SELECT ...`  (tagged template = function call)
  apply(_target, _thisArg, args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getClient() as any)(...args);
  },
  // Handles: sql.begin(), sql.end(), sql.unsafe() etc.
  get(_target, prop: string | symbol) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

export { sql };
export default sql;
