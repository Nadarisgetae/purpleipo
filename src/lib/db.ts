import postgres from 'postgres';

const globalForDb = global as unknown as {
  sql: postgres.Sql | undefined;
};

function createSqlInstance(): postgres.Sql {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    // Provide a dummy connection string during static build analysis to avoid ERR_INVALID_URL
    return postgres('postgres://dummy:dummy@localhost:5432/dummy', {
      ssl: false,
      max: 1,
      idle_timeout: 1,
      connect_timeout: 1,
    });
  }

  return postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Lazy initialization or global cache to prevent build-time crashes on Vercel
export function getDb(): postgres.Sql {
  if (!globalForDb.sql) {
    globalForDb.sql = createSqlInstance();
  }
  return globalForDb.sql;
}

// Proxy wrapper so existing tagged template `sql\`...\`` syntax continues to work transparently
export const sql: postgres.Sql = new Proxy((() => {}) as any, {
  apply(_target, thisArg, argArray: any) {
    const client = getDb();
    return (client as any).apply(thisArg, argArray);
  },
  get(_target, prop) {
    const client = getDb();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

export default sql;
