import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { hashPassword, verifyPassword, tokenHash } from './passwords.js';

export const app = express();
app.disable('x-powered-by');
// Allow the configured React development origin; authentication still requires a token.
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
// Keep response envelopes consistent for every screen using this API.
// Express 5 forwards thrown/rejected async handler errors to the final middleware.
const fail = (status, message, fields) => Object.assign(new Error(message), { status, fields });
const send = (res, data, status=200) => res.status(status).json({ data });
// Explicitly select public fields so password hashes never appear in auth responses.
const publicUser = user => ({ id: user.id, email: user.email, display_name: user.display_name });
function objectBody(req) {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') throw fail(400, 'A JSON object is required');
  if (Object.values(req.body).some(value => typeof value === 'string' && value.includes('\u0000'))) throw fail(400, 'Text fields cannot contain null characters');
  return req.body;
}
// Reject malformed IDs before sending them to PostgreSQL's signed integer columns.
function id(value, name='id') {
  if (!['string','number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || Number(value)>2147483647) throw fail(400, `Invalid ${name}`);
  return Number(value);
}
function credentials(req, registration=false) {
  const body = objectBody(req);
  const allowed = registration ? ['email','password','display_name'] : ['email','password'];
  if (Object.keys(body).some(k => !allowed.includes(k))) throw fail(400, 'Unknown input field');
  if (typeof body.email !== 'string' || body.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw fail(400, 'A valid email is required');
  if (typeof body.password !== 'string' || body.password.length<12 || body.password.length>128) throw fail(400, 'Password must contain 12 to 128 characters');
  if (registration && (typeof body.display_name !== 'string' || !body.display_name.trim() || body.display_name.length>100)) throw fail(400, 'display_name must contain 1 to 100 characters');
  return { ...body, email: body.email.trim().toLowerCase() };
}
app.get('/api/health', async (req,res) => {
  await pool.query('SELECT 1');
  send(res, { status: 'ok', database: 'connected', mode: 'phase1-demo' });
});
app.post('/api/auth/register', async (req,res) => {
  const input = credentials(req,true);
  if (input.email === 'demo@example.com') throw fail(409,'This email is reserved for the sample dataset');
  const hash = await hashPassword(input.password);
  const { rows: [user] } = await pool.query('INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id,email,display_name',[input.email,input.display_name.trim(),hash]);
  send(res, publicUser(user),201);
});
app.post('/api/auth/login', async (req,res) => {
  const input = credentials(req);
  const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email=$1',[input.email]);
  if (!user || !await verifyPassword(input.password,user.password_hash)) throw fail(401,'Invalid email or password');
  // Sessions live in PostgreSQL so restarting Express does not log everyone out.
  const token = randomBytes(32).toString('hex');
  const { rows: [session] } = await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours') RETURNING expires_at",[tokenHash(token),user.id]);
  send(res,{ token, expires_at:session.expires_at, user:publicUser(user) });
});
// These public routes must remain above this middleware. Every API route below
// receives its user identity from the session, never from a client-supplied user_id.
app.use('/api', async (req,res,next) => {
  const header = req.get('Authorization') || '';
  const match = /^Bearer ([a-f0-9]{64})$/.exec(header);
  if (!match) throw fail(401,'A valid Bearer token is required');
  const hash = tokenHash(match[1]);
  const { rows: [user] } = await pool.query('SELECT u.id,u.email,u.display_name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash]);
  if (!user) throw fail(401,'Session expired or invalid');
  req.user=user; req.sessionHash=hash; next();
});
app.get('/api/auth/me',(req,res)=>send(res,req.user));
app.post('/api/auth/logout',async(req,res)=>{
  await pool.query('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);
  send(res,{ logged_out:true });
});
app.get('/api/accounts', async(req,res)=>{
  const {rows}=await pool.query('SELECT id,platform,handle,display_name,connection_status,is_sample FROM accounts WHERE user_id=$1 ORDER BY id',[req.user.id]);
  send(res,rows);
});
// Activity and metrics inherit ownership through their associated account.
// Nullable filter parameters make an omitted filter select all owned records.
app.get('/api/activity',async(req,res)=>{
  const accountId=req.query.account_id===undefined ? null : id(req.query.account_id,'account_id');
  const type=req.query.type ?? null;
  if (type!==null && !['post','comment','message','notification'].includes(type)) throw fail(400,'Invalid activity type');
  const {rows}=await pool.query(`SELECT a.id,a.account_id,c.platform,c.handle,a.type,a.actor,a.content,a.occurred_at,a.is_sample FROM activity a JOIN accounts c ON c.id=a.account_id WHERE c.user_id=$1 AND ($2::integer IS NULL OR c.id=$2) AND ($3::text IS NULL OR a.type=$3) ORDER BY a.occurred_at DESC,a.id DESC`,[req.user.id,accountId,type]);
  send(res,rows);
});
app.get('/api/metrics',async(req,res)=>{
  const accountId=req.query.account_id===undefined ? null : id(req.query.account_id,'account_id');
  const {rows}=await pool.query(`SELECT m.*,c.platform,c.handle FROM metric_snapshots m JOIN accounts c ON c.id=m.account_id WHERE c.user_id=$1 AND ($2::integer IS NULL OR c.id=$2) ORDER BY m.snapshot_date,m.account_id`,[req.user.id,accountId]);
  send(res,rows);
});
app.get('/api/dashboard',async(req,res)=>{
  const {rows:[summary]}=await pool.query(`SELECT (SELECT count(*)::integer FROM accounts WHERE user_id=$1) AS accounts, (SELECT count(*)::integer FROM activity a JOIN accounts c ON c.id=a.account_id WHERE c.user_id=$1) AS activity_items, (SELECT count(*)::integer FROM scheduled_posts WHERE user_id=$1) AS saved_posts`,[req.user.id]);
  send(res,{...summary,mode:'phase1-demo'});
});
// Both drafts and planned posts use scheduled_posts; Phase 1 never publishes them.
const postColumns='id,account_id,content,status,scheduled_at,is_sample,created_at,updated_at';
app.get('/api/drafts',async(req,res)=>{
  const {rows}=await pool.query(`SELECT ${postColumns} FROM scheduled_posts WHERE user_id=$1 ORDER BY updated_at DESC,id DESC`,[req.user.id]);
  send(res,rows);
});
// Missing and foreign-owned IDs share a 404 so other users' records are not revealed.
async function findPost(req, database=pool, lock=false) {
  const {rows:[post]}=await database.query(`SELECT ${postColumns} FROM scheduled_posts WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`,[id(req.params.id),req.user.id]);
  if (!post) throw fail(404,'Draft not found');
  return post;
}
app.get('/api/drafts/:id',async(req,res)=>send(res,await findPost(req)));
async function validatePost(req, existing, database=pool) {
  const body=objectBody(req);
  const allowed=['account_id','content','status','scheduled_at'];
  if (!Object.keys(body).length || Object.keys(body).some(k=>!allowed.includes(k))) throw fail(400,'Supply only account_id, content, status, and scheduled_at');
  // PATCH keeps omitted fields; POST uses the defaults. Convert PostgreSQL Date
  // objects back to ISO text before applying the same validation to both operations.
  const input={account_id:existing?.account_id,content:existing?.content,status:existing?.status || 'draft',scheduled_at:existing?.scheduled_at ? new Date(existing.scheduled_at).toISOString() : null,...body};
  input.account_id=id(input.account_id,'account_id');
  if (typeof input.content!=='string' || !input.content.trim() || input.content.trim().length>2200) throw fail(400,'content must contain 1 to 2200 characters');
  input.content=input.content.trim();
  if (!['draft','scheduled'].includes(input.status)) throw fail(400,'status must be draft or scheduled');
  if (input.scheduled_at!==null) {
    // Require a timezone so the browser and server agree on the selected instant.
    if (typeof input.scheduled_at!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(input.scheduled_at) || !Number.isFinite(Date.parse(input.scheduled_at))) throw fail(400,'scheduled_at must be an ISO timestamp with timezone, or null');
    // Date.parse can normalize impossible dates (for example February 30).
    // Check the calendar components separately before normalizing the instant to UTC.
    const [year,month,day]=input.scheduled_at.slice(0,10).split('-').map(Number);
    const dateCheck=new Date(Date.UTC(year,month-1,day));
    if (dateCheck.getUTCFullYear()!==year || dateCheck.getUTCMonth()!==month-1 || dateCheck.getUTCDate()!==day || Number(input.scheduled_at.slice(11,13))>23) throw fail(400,'scheduled_at must contain a valid calendar date and time');
    input.scheduled_at=new Date(input.scheduled_at).toISOString();
  }
  const changesSchedule = !existing || Object.hasOwn(body,'status') || Object.hasOwn(body,'scheduled_at');
  if (input.status==='scheduled' && changesSchedule && (!input.scheduled_at || Date.parse(input.scheduled_at)<=Date.now())) throw fail(400,'Scheduled posts require a future scheduled_at timestamp');
  // The API reports a useful validation error; the composite foreign key also
  // enforces account ownership if data changes between this check and the write.
  const {rowCount}=await database.query('SELECT 1 FROM accounts WHERE id=$1 AND user_id=$2',[input.account_id,req.user.id]);
  if (!rowCount) throw fail(400,'account_id must belong to your account');
  return input;
}
app.post('/api/drafts',async(req,res)=>{
  const p=await validatePost(req);
  const {rows:[post]}=await pool.query(`INSERT INTO scheduled_posts(user_id,account_id,content,status,scheduled_at) VALUES($1,$2,$3,$4,$5) RETURNING ${postColumns}`,[req.user.id,p.account_id,p.content,p.status,p.scheduled_at]);
  res.location(`/api/drafts/${post.id}`); send(res,post,201);
});
app.patch('/api/drafts/:id',async(req,res)=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock before reading/merging. Overlapping PATCH requests see the preceding
    // committed edit instead of restoring stale values in fields they omitted.
    const existing=await findPost(req,client,true);
    const p=await validatePost(req,existing,client);
    const {rows:[post]}=await client.query(`UPDATE scheduled_posts SET account_id=$1,content=$2,status=$3,scheduled_at=$4,updated_at=now() WHERE id=$5 AND user_id=$6 RETURNING ${postColumns}`,[p.account_id,p.content,p.status,p.scheduled_at,existing.id,req.user.id]);
    await client.query('COMMIT');
    send(res,post);
  } catch(error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
});
app.delete('/api/drafts/:id',async(req,res)=>{
  const {rowCount}=await pool.query('DELETE FROM scheduled_posts WHERE id=$1 AND user_id=$2',[id(req.params.id),req.user.id]);
  if (!rowCount) throw fail(404,'Draft not found');
  send(res,{id:Number(req.params.id),deleted:true});
});
app.use((req,res)=>res.status(404).json({error:{message:'Route not found'}}));
// Translate expected database/parser errors; hide internal details on server errors.
// Express recognizes error middleware by its four-argument signature.
app.use((error,req,res,next)=>{
  let status=error.status || 500;
  let message=error.message;
  if(error.code==='23505') {status=409;message='A record with these details already exists';}
  if(error.code==='22021') {status=400;message='Text contains unsupported characters';}
  if(error.code==='23503') {status=400;message='Referenced record no longer exists';}
  if(error.type==='entity.parse.failed') {status=400;message='Malformed JSON';}
  if(status>=500) {console.error('Request failed:',process.env.NODE_ENV === 'production' ? error.code || error.name : error.stack);message='Internal server error';}
  res.status(status).json({error:{message}});
});
