import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { setupDatabase } from '../scripts/setup-db.js';
let password=process.env.POSTGRES_ADMIN_PASSWORD;
if(!password) {
  try { password=dotenv.parse(await readFile('.postgres-admin.env')).POSTGRES_ADMIN_PASSWORD; }
  catch { throw new Error('Setup regression tests require POSTGRES_ADMIN_PASSWORD or the local installer credential file'); }
}
const adminConfig={host:process.env.PGHOST || 'localhost',port:Number(process.env.PGPORT || 5432),user:'postgres',password};
// Never point these destructive fixture cleanups at application names.
const prefix=`review_${randomBytes(6).toString('hex')}`;
const admin=new pg.Client({...adminConfig,database:'postgres'});
const roles=[]; const databases=[]; const directories=[];
async function fixture(suffix) {
  const roleName=`${prefix}_${suffix}`; const databaseName=`${prefix}_${suffix}`;
  roles.push(roleName); databases.push(databaseName);
  const directory=await mkdtemp(join(tmpdir(),'dashboard-setup-review-')); directories.push(directory);
  return {roleName,databaseName,directory,adminConfig};
}
test('database bootstrap recovery with real PostgreSQL and isolated fixtures',async t=>{
  await admin.connect();
  try {
    await t.test('retry after role creation succeeds but CREATE DATABASE fails',async()=>{
      const options=await fixture('partial');
      const operator=`${prefix}_operator`; roles.push(operator);
      const operatorPassword=randomBytes(20).toString('hex');
      await admin.query(`CREATE ROLE ${pg.escapeIdentifier(operator)} LOGIN CREATEROLE NOCREATEDB PASSWORD ${pg.escapeLiteral(operatorPassword)}`);
      await assert.rejects(setupDatabase({...options,adminConfig:{...adminConfig,user:operator,password:operatorPassword}}),/permission denied to create database/);
      assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[options.roleName])).rowCount,1);
      assert.ok((await readdir(options.directory)).some(name=>name.startsWith('.env.database-created.')));
      await setupDatabase(options);
      const before=await readFile(join(options.directory,'.env'),'utf8');
      await setupDatabase(options);
      assert.equal(await readFile(join(options.directory,'.env'),'utf8'),before);
    });
    await t.test('existing configuration files never destroy new credentials',async()=>{
      const options=await fixture('existing');
      await writeFile(join(options.directory,'.env'),'DATABASE_URL=postgresql://unrelated:wrong@localhost/unrelated\n');
      await writeFile(join(options.directory,'.env.database-created'),'unrelated recovery file');
      await assert.rejects(setupDatabase(options),/Existing .env was preserved/);
      assert.equal(await readFile(join(options.directory,'.env.database-created'),'utf8'),'unrelated recovery file');
      assert.match(await readFile(join(options.directory,'.env'),'utf8'),/unrelated/);
      // Simulate the developer moving the unrelated .env aside, then retry.
      const {rename}=await import('node:fs/promises');
      await rename(join(options.directory,'.env'),join(options.directory,'old-env.txt'));
      await setupDatabase(options);
      assert.equal(new URL(dotenv.parse(await readFile(join(options.directory,'.env'))).DATABASE_URL).username,options.roleName);
    });
    await t.test('existing role without credentials is never reset automatically',async()=>{
      const options=await fixture('no_config');
      const originalPassword=randomBytes(20).toString('hex');
      await admin.query(`CREATE ROLE ${pg.escapeIdentifier(options.roleName)} LOGIN PASSWORD ${pg.escapeLiteral(originalPassword)}`);
      await assert.rejects(setupDatabase(options),/No password was changed/);
      const probe=new pg.Client({...adminConfig,user:options.roleName,password:originalPassword,database:'postgres'});
      try { await probe.connect(); await probe.query('SELECT 1'); }
      finally { await probe.end(); }
      assert.equal((await readdir(options.directory)).length,0);
    });
    await t.test('wrong database owner fails clearly without changing ownership',async()=>{
      const options=await fixture('owner');
      await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(options.databaseName)}`);
      await assert.rejects(setupDatabase(options),/An administrator must review ownership/);
      assert.equal((await readdir(options.directory)).length,0);
    });
  } finally {
    for(const name of databases) {
      assert.ok(name.startsWith(prefix+'_'));
      await admin.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(name)} WITH (FORCE)`);
    }
    for(const name of roles) {
      assert.ok(name.startsWith(prefix+'_'));
      await admin.query(`DROP ROLE IF EXISTS ${pg.escapeIdentifier(name)}`);
    }
    await admin.end();
    for(const directory of directories) {
      assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
      assert.ok(directory.includes('dashboard-setup-review-'));
      await rm(directory,{recursive:true,force:true});
    }
  }
});
