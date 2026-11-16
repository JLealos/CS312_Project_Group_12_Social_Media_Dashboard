import 'dotenv/config';
import pg from 'pg';
// SQL DATE is a calendar label, not an instant; preserve YYYY-MM-DD in all timezones.
pg.types.setTypeParser(1082, value => value);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; see .env.example');
// Share a connection pool across requests instead of opening a client per query.
// Transaction scripts check out one client and release it when finished.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
// Idle connection failures happen outside a request; log without exposing credentials.
pool.on('error', () => console.error('Unexpected idle PostgreSQL connection error'));
