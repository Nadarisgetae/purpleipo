import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL || '', { max: 1 }); // no ssl

sql`SELECT 1`.then(console.log).catch(console.error).finally(() => sql.end());
