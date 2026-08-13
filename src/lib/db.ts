import postgres from 'postgres';

/**
 * Lazily creates the postgres client on first use.
 * Defers DATABASE_URL validation to runtime so Vercel build phase
 * never throws ERR_INVALID_URL when env vars aren't set during build.
 */
let _sql: postgres.Sql | null = null;

function getClient(): postgres.Sql {
  if (_sql) return _sql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables');
  }

  _sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return _sql;
}

/**
 * Tagged template literal proxy — works exactly like `sql\`...\``
 * but the client is only created on first actual query.
 */
const sql = new Proxy({} as postgres.Sql, {
  get(_target, prop) {
    const client = getClient();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
  apply(_target, _thisArg, args) {
    return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
});

export { sql };
export default sql;

