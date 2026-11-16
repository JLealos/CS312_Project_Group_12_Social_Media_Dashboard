import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const runFile=promisify(execFile);
import { pool } from '../server/db.js';
const port=process.env.TEST_PORT || '3107';
const base=`http://127.0.0.1:${port}/api`;
let child;
async function start() {
  child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;});
  child.stderr.on('data',chunk=>{output+=chunk;});
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null) throw new Error(`Server exited: ${output}`);
    if(output.includes('Phase 1 API listening')) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Server startup timeout: ${output}`);
}
async function stop() {
  if(!child || child.exitCode!==null) return;
  const ended=once(child,'exit'); child.kill(); await ended;
}
async function request(path,{method='GET',body,token,raw}={}) {
  const res=await fetch(base+path,{method,headers:{...(body!==undefined || raw!==undefined ? {'Content-Type':'application/json'} : {}),...(token ? {Authorization:`Bearer ${token}`} : {})},body:raw ?? (body!==undefined ? JSON.stringify(body) : undefined)});
  return {status:res.status,body:await res.json()};
}
test('PostgreSQL-backed API, ownership, validation, CRUD, and process restart persistence',async t=>{
  let draftId; let testUserId; let token;
  try {
    const seeded=await pool.query("SELECT 1 FROM users WHERE email='demo@example.com'");
    assert.equal(seeded.rowCount,1,'Run npm run db:migrate and npm run db:seed before npm test');
    await start();
    const health=await request('/health'); assert.equal(health.status,200); assert.equal(health.body.data.database,'connected');
    assert.equal((await request('/accounts')).status,401);
    const login=await request('/auth/login',{method:'POST',body:{email:'demo@example.com',password:process.env.DEMO_PASSWORD || 'DemoDashboard312!'}});
    assert.equal(login.status,200,'Demo login failed; check DEMO_PASSWORD and run npm run db:seed'); token=login.body.data.token;
    const preflight=await fetch(base+'/drafts',{method:'OPTIONS',headers:{Origin:process.env.FRONTEND_ORIGIN || 'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
    const {rows:[role]}=await pool.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
    assert.equal(role.rolsuper,false); assert.equal(role.rolcreatedb,false); assert.equal(role.rolcreaterole,false);
    const accounts=await request('/accounts',{token}); assert.equal(accounts.status,200); assert.equal(accounts.body.data.length,3);
    const accountId=accounts.body.data[0].id;
    await t.test('occupied HTTP port fails clearly instead of reporting success',async()=>{
      await assert.rejects(runFile(process.execPath,['server/index.js'],{env:{...process.env,PORT:port},timeout:10000}),error=>{
        assert.equal(error.code,1); assert.match(error.stderr,/HTTP startup failed: EADDRINUSE/);
        assert.doesNotMatch(error.stdout,/API listening/); return true;
      });
    });
    await t.test('calendar dates stay YYYY-MM-DD across server timezones',async()=>{
      const code="import {pool} from './server/db.js'; const r=await pool.query(\"SELECT DATE '2026-11-09' AS day\"); console.log(JSON.stringify(r.rows[0])); await pool.end();";
      for(const TZ of ['America/Phoenix','UTC','Asia/Tokyo']) {
        const {stdout}=await runFile(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ}});
        assert.equal(JSON.parse(stdout).day,'2026-11-09');
      }
      assert.match((await request('/metrics',{token})).body.data[0].snapshot_date,/^\d{4}-\d{2}-\d{2}$/);
    });
    const activity=await request('/activity',{token}); assert.equal(activity.body.data.length,12);
    assert.equal((await request('/activity?type=invalid',{token})).status,400);
    assert.equal((await request(`/activity?account_id=${accountId}&type=comment`,{token})).body.data.length,1);
    assert.equal((await request('/metrics',{token})).body.data.length,21);
    assert.equal((await request('/dashboard',{token})).body.data.accounts,3);
    await t.test('reject invalid drafts, invalid JSON, dates, unknown fields, and IDs',async()=>{
      for(const body of [{},{account_id:accountId,content:''},{account_id:[accountId],content:'array ID'},{account_id:accountId,content:'null\u0000character'},{account_id:accountId,content:'x'.repeat(2201)},{account_id:accountId,content:'ok',status:'published'},{account_id:accountId,content:'ok',status:'scheduled'},{account_id:accountId,content:'ok',scheduled_at:'2020-01-01T10:00:00'},{account_id:accountId,content:'bad date',scheduled_at:'2027-02-30T10:00:00Z'},{account_id:2147483647,content:'no account'},{account_id:accountId,content:'ok',user_id:1},[],null]) {
        const response=await request('/drafts',{method:'POST',token,body}); assert.equal(response.status,400,JSON.stringify(body)); assert.ok(response.body.error.message);
      }
      assert.equal((await request('/drafts',{method:'POST',token,raw:'{bad'})).status,400);
      assert.equal((await request('/drafts',{method:'POST',token,body:{account_id:accountId,content:'x'.repeat(34000)}})).status,413);
      assert.equal((await request('/auth/login',{method:'POST',body:{email:'demo@example.com',password:'short'}})).status,400);
      assert.equal((await request('/auth/register',{method:'POST',body:{email:'demo@example.com',password:'ValidPassword312!',display_name:'Reserved'}})).status,409);
      assert.equal((await request('/auth/register',{method:'POST',body:{email:'null@example.com',password:'ValidPassword312!',display_name:'bad\u0000name'}})).status,400);
      assert.equal((await request('/drafts/nope',{token})).status,400);
      assert.equal((await request('/drafts/2147483647',{token})).status,404);
    });
    const created=await request('/drafts',{method:'POST',token,body:{account_id:accountId,content:'Persistence verification draft'}});
    assert.equal(created.status,201); draftId=created.body.data.id;
    assert.equal(created.body.data.is_sample,false);
    assert.equal((await request(`/drafts/${draftId}`,{token})).body.data.content,'Persistence verification draft');
    const {rows:[saved]}=await pool.query('SELECT content FROM scheduled_posts WHERE id=$1',[draftId]); assert.equal(saved.content,'Persistence verification draft');
    const future=new Date(Date.now()+86400000).toISOString();
    const updated=await request(`/drafts/${draftId}`,{method:'PATCH',token,body:{content:'Updated persistent draft',status:'scheduled',scheduled_at:future}});
    assert.equal(updated.status,200); assert.equal(updated.body.data.status,'scheduled');
    assert.equal((await request(`/drafts/${draftId}`,{method:'PATCH',token,body:{content:'Updated persistent draft'}})).status,200);
    await t.test('concurrent partial edits preserve disjoint fields and overdue content remains editable',async()=>{
      // Holding the row lock forces both HTTP requests to overlap at the read.
      const blocker=await pool.connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM scheduled_posts WHERE id=$1 FOR UPDATE',[draftId]);
        const contentRequest=request(`/drafts/${draftId}`,{method:'PATCH',token,body:{content:'Concurrent content'}});
        const dateRequest=request(`/drafts/${draftId}`,{method:'PATCH',token,body:{scheduled_at:new Date(Date.now()+172800000).toISOString()}});
        await new Promise(resolve=>setTimeout(resolve,150));
        await blocker.query('COMMIT');
        const results=await Promise.all([contentRequest,dateRequest]);
        results.forEach(result=>assert.equal(result.status,200));
        const merged=await request(`/drafts/${draftId}`,{token});
        assert.equal(merged.body.data.content,'Concurrent content');
        assert.equal(merged.body.data.scheduled_at,results[1].body.data.scheduled_at);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      await pool.query("UPDATE scheduled_posts SET scheduled_at=now()-interval '1 day' WHERE id=$1",[draftId]);
      assert.equal((await request(`/drafts/${draftId}`,{method:'PATCH',token,body:{content:'Overdue edit'}})).status,200);
      assert.equal((await request(`/drafts/${draftId}`,{method:'PATCH',token,body:{status:'scheduled'}})).status,400);
      assert.equal((await request(`/drafts/${draftId}`,{method:'PATCH',token,body:{content:'Updated persistent draft',scheduled_at:future}})).status,200);
    });
    await t.test('register, login, and enforce account ownership',async()=>{
      const email=`verification-${Date.now()}@example.com`;
      const registration=await request('/auth/register',{method:'POST',body:{email,password:'VerificationPassword312!',display_name:'Verification User'}});
      assert.equal(registration.status,201); testUserId=registration.body.data.id;
      assert.equal((await request('/auth/register',{method:'POST',body:{email,password:'VerificationPassword312!',display_name:'Duplicate'}})).status,409);
      assert.equal((await request('/auth/login',{method:'POST',body:{email,password:'WrongPassword312!'}})).status,401);
      const other=await request('/auth/login',{method:'POST',body:{email,password:'VerificationPassword312!'}}); const otherToken=other.body.data.token;
      assert.equal((await request(`/activity?account_id=${accountId}`,{token:otherToken})).body.data.length,0);
      assert.equal((await request(`/metrics?account_id=${accountId}`,{token:otherToken})).body.data.length,0);
      assert.deepEqual((await request('/accounts',{token:otherToken})).body.data,[]);
      for(const method of ['GET','PATCH','DELETE']) assert.equal((await request(`/drafts/${draftId}`,{token:otherToken,method,...(method==='PATCH' ? {body:{content:'forbidden'}} : {})})).status,404);
      assert.equal((await request('/drafts',{token:otherToken,method:'POST',body:{account_id:accountId,content:'forbidden'}})).status,400);
      assert.equal((await request('/auth/logout',{method:'POST',token:otherToken})).status,200);
      assert.equal((await request('/auth/me',{token:otherToken})).status,401);
    });
    await t.test('expired sessions are rejected',async()=>{
      const {tokenHash}=await import('../server/passwords.js');
      const expiredToken='a'.repeat(64);
      await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()-interval '1 second')",[tokenHash(expiredToken),login.body.data.user.id]);
      try { assert.equal((await request('/auth/me',{token:expiredToken})).status,401); }
      finally { await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(expiredToken)]); }
    });
    await t.test('repeat migrations and seeds without duplicates or losing saved drafts',async()=>{
      await runFile(process.execPath,['scripts/migrate.js']);
      await runFile(process.execPath,['scripts/seed.js']);
      assert.equal((await request('/accounts',{token})).body.data.length,3);
      assert.equal((await request('/activity',{token})).body.data.length,12);
      assert.equal((await request('/metrics',{token})).body.data.length,21);
      assert.equal((await request(`/drafts/${draftId}`,{token})).body.data.content,'Updated persistent draft');
    });
    await stop(); await start();
    await t.test('saved draft and session survive an Express restart',async()=>{
      const persisted=await request(`/drafts/${draftId}`,{token}); assert.equal(persisted.status,200); assert.equal(persisted.body.data.content,'Updated persistent draft'); assert.equal(persisted.body.data.scheduled_at,future);
    });
    assert.equal((await request(`/drafts/${draftId}`,{method:'DELETE',token})).status,200);
    assert.equal((await request(`/drafts/${draftId}`,{token})).status,404);
    assert.equal((await request(`/drafts/${draftId}`,{method:'DELETE',token})).status,404);
    assert.equal((await pool.query('SELECT 1 FROM scheduled_posts WHERE id=$1',[draftId])).rowCount,0);
  } finally {
    await stop();
    if(draftId) await pool.query('DELETE FROM scheduled_posts WHERE id=$1',[draftId]);
    if(testUserId) await pool.query('DELETE FROM users WHERE id=$1',[testUserId]);
    if(token) { const {tokenHash}=await import('../server/passwords.js'); await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(token)]); }
    await pool.end();
  }
});
