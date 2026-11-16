import { pool } from '../server/db.js';
import { hashPassword, verifyPassword } from '../server/passwords.js';
// This password only initializes the demo user; rerunning seeds does not reset it.
const password = process.env.DEMO_PASSWORD || 'DemoDashboard312!';
if (password.length < 12 || password.length > 128) throw new Error('DEMO_PASSWORD must have 12 to 128 characters');
const hash = await hashPassword(password);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Conflict handling preserves existing passwords, edited drafts, and real records.
  await client.query(`INSERT INTO users(email,display_name,password_hash) VALUES ('demo@example.com','Sample Dashboard User',$1) ON CONFLICT(email) DO NOTHING`, [hash]);
  const { rows: [user] } = await client.query("SELECT id,password_hash FROM users WHERE email='demo@example.com'");
  if (!await verifyPassword(password,user.password_hash)) throw new Error('Existing demo user password differs from DEMO_PASSWORD. Supply its existing password; no records or passwords were changed.');
  // Fictional accounts supply predictable content for the React screens.
  // Each row contains platform, handle, display name, and starting follower count.
  const samples = [['instagram','@pineandtrail','Pine & Trail Studio',1240],['facebook','pineandtrail','Pine & Trail Community',870],['x','@pineandtrail','Pine & Trail Updates',640]];
  for (const [platform, handle, name, followers] of samples) {
    // The no-op conflict update returns the existing account ID without replacing
    // its display name or other fields a developer may have changed.
    const { rows: [account] } = await client.query(`INSERT INTO accounts(user_id,platform,handle,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,platform,handle) DO UPDATE SET handle=EXCLUDED.handle RETURNING id`, [user.id,platform,handle,name]);
    // Stable seed keys prevent duplicates even when identity IDs have gaps.
    for (const [i,type] of ['post','comment','message','notification'].entries()) {
      await client.query(`INSERT INTO activity(account_id,seed_key,type,actor,content,occurred_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(seed_key) DO NOTHING`, [account.id,`${platform}-${type}`,type,['Pine & Trail','Alex Rivera','Morgan Chen','Sample Platform'][i],['Sample: Weekend trail guide is ready.','Sample: Is the Saturday meetup beginner friendly?','Sample: Can you share the event details?','Sample: Your community reached a new milestone.'][i],`2026-11-${15-i}T16:00:00Z`]);
    }
    // Existing sample draft edits survive reseeding; a deleted sample is recreated.
    await client.query(`INSERT INTO scheduled_posts(user_id,account_id,seed_key,content,status,scheduled_at,is_sample) VALUES($1,$2,$3,$4,'draft',NULL,true) ON CONFLICT(seed_key) DO NOTHING`,[user.id,account.id,`${platform}-draft`,'Sample draft: Join our next community trail cleanup.']);
    // Fixed dates and synthetic growth make charts reproducible for demonstrations.
    for (let day=9;day<=15;day++) {
      await client.query(`INSERT INTO metric_snapshots(account_id,snapshot_date,followers,impressions,engagements) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,snapshot_date) DO NOTHING`,[account.id,`2026-11-${String(day).padStart(2,'0')}`,followers+(day-9)*8,900+(day-9)*125,65+(day-9)*9]);
    }
  }
  // Commit all sample tables together so a failure cannot leave half a dataset.
  await client.query('COMMIT');
  console.log('Sample data ready. Demo login: demo@example.com (password from DEMO_PASSWORD or documented default).');
} catch(error) {
  await client.query('ROLLBACK'); console.error('Seed failed:',error.message); process.exitCode=1;
} finally { client.release(); await pool.end(); }
