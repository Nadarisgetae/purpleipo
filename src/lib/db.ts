import postgres from 'postgres';

/**
 * Singleton postgres client — created lazily on first query.
 * Uses globalThis so HMR in dev doesn't create multiple pools.
 */

const globalRef = globalThis as typeof globalThis & { _purpleDb?: postgres.Sql };

function getDb(): postgres.Sql {
  if (globalRef._purpleDb) return globalRef._purpleDb;

  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('❌ PurpleIPO: DATABASE_URL is not set. Go to Vercel → Settings → Environment Variables and add it.');
    throw new Error('DATABASE_URL environment variable is missing. Add it in Vercel → Settings → Environment Variables.');
  }

  try {
    globalRef._purpleDb = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    console.log('✅ PurpleIPO: Database client created successfully');
  } catch (err) {
    console.error('❌ PurpleIPO: Failed to create postgres client:', err);
    throw err;
  }

  return globalRef._purpleDb;
}

/**
 * Proxy target MUST be a function (not {}) so that sql`...`
 * tagged template calls work correctly — the apply trap only fires
 * when the target is callable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = new Proxy(function sql_proxy() {} as any, {
  apply(_target, _thisArg, args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)(...args);
  },
  get(_target, prop: string | symbol) {
    // Prevent Promise detection — sql is not a Promise
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (db as any)[prop];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof val === 'function' ? (val as any).bind(db) : val;
  },
}) as postgres.Sql;

export { sql };
export default sql;
