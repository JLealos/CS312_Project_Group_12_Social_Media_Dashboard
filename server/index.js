import { app } from './app.js';
import { pool } from './db.js';
const port=Number(process.env.PORT || 3001);
try {
  // Verify database access before accepting HTTP requests.
  await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
  const server=app.listen(port,'127.0.0.1');
  server.once('listening',()=>console.log(`Phase 1 API listening at http://localhost:${port}`));
  // Listen failures are asynchronous; the surrounding try/catch cannot catch them.
  server.once('error',async error=>{
    console.error('HTTP startup failed:',error.code || error.name);
    await pool.end(); process.exitCode=1;
  });
  const shutdown=()=>server.close(()=>pool.end().then(()=>process.exit(0)));
  process.on('SIGTERM',shutdown);
  process.on('SIGINT',shutdown);
} catch(error) {
  console.error('Database startup check failed. Check DATABASE_URL and run npm run db:migrate.',error.code || error.name);
  await pool.end(); process.exitCode=1;
}
