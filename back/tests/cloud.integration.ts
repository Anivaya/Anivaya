import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { openDatabase } from '../database/connection.ts';
import { databaseSchema, postgresCall } from '../database/postgres.ts';
import { createApi } from '../api/app.ts';
import type { AuthUser, Profile } from '../../shared/account.ts';
import type { SocialData } from '../../shared/social.ts';
import { randomUUID } from 'node:crypto';
import type { Dashboard, Document, Animal } from '../../shared/models.ts';
import { adminResources } from '../../shared/admin.ts';

test('Cloud: private objects, account isolation, admin queries, proxy, cron and process restart', async t => {
  assert.ok(process.env.DATABASE_URL, 'Run through npm run test:cloud');
  process.env.NODE_ENV = 'production';
  process.env.MFA_ENCRYPTION_KEY = 'ab'.repeat(32);
  process.env.API_PROXY_SECRET = 'cd'.repeat(32);
  process.env.CRON_SECRET = 'ef'.repeat(32);
  process.env.ALLOWED_ORIGINS = 'https://anivaya.test';
  const db = openDatabase();
  const server = createApi(db);
  await server.ready;
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise<void>(r => server.close(() => r())); db.close(); });
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  const request = (path: string, method='GET', body?: unknown, cookie='') => fetch(base+path, { method, headers: { 'Content-Type':'application/json', Cookie:cookie, 'x-anivaya-proxy':process.env.API_PROXY_SECRET!, 'x-forwarded-for':'203.0.113.8, 127.0.0.1' }, body:body === undefined ? undefined : JSON.stringify(body) });
  async function json<T>(path: string, method='GET', body?: unknown, cookie='', status=200): Promise<T> {
    const result = await request(path, method, body, cookie);
    const payload = result.status === 204 ? null : await result.json();
    assert.equal(result.status, status, JSON.stringify(payload)); return payload as T;
  }
  async function register(email: string) {
    const result = await request('/auth/register','POST',{email,name:'Cloud Test',password:'Cloud-local-test1!',confirmPassword:'Cloud-local-test1!'});
    assert.equal(result.status,201,await result.clone().text());
    return { user:await result.json() as AuthUser,cookie:result.headers.get('set-cookie')!.split(';')[0] };
  }
  const alice = await register('alice@cloud.test'), bob = await register('bob@cloud.test');
  db.prepare("INSERT INTO admin_members(account,role) VALUES (?,'Administrateur')").run(alice.user.id);
  const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
  const animal = await json<Animal>('/animals','POST',{name:'Cloud Pixel',species:'Chat',photo:{type:'image/png',content:photo.toString('base64')}},alice.cookie,201);
  const pdf = Buffer.from('%PDF-1.4\nCloud private document\n%%EOF');
  const doc = await json<Document>('/documents','POST',{name:'Cloud file',animal:animal.id,type:'application/pdf',content:pdf.toString('base64')},alice.cookie,201);
  await t.test('private file roundtrip, RLS and no bytes in PostgreSQL', async () => {
    const result = await request(`/documents/${doc.id}/file`,'GET',undefined,alice.cookie);
    assert.equal(result.status,200); assert.deepEqual(Buffer.from(await result.arrayBuffer()),pdf);
    const picture = await request(`/animals/${animal.id}/photo`,'GET',undefined,alice.cookie);
    assert.equal(picture.status,200); assert.deepEqual(Buffer.from(await picture.arrayBuffer()),photo);
    assert.equal((await request(`/documents/${doc.id}/file`,'GET',undefined,bob.cookie)).status,404);
    const schema = databaseSchema(alice.user.id);
    const stored = postgresCall('query',schema,"SELECT convert_from(content,'UTF8') AS reference FROM documents WHERE id=?",[doc.id]).rows[0].reference;
    assert.match(stored,/^ANIVAYA_OBJECT_V1:/);
    const unsecured = postgresCall('query',schema,"SELECT relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=current_schema() AND c.relkind='r' AND NOT c.relrowsecurity").rows;
    assert.deepEqual(unsecured,[]);
    assert.equal((await json<Dashboard>('/dashboard','GET',undefined,bob.cookie)).animals.length,0);
  });
  await t.test('share grants and revokes access through the application', async () => {
    await json('/shares','POST',{documents:[doc.id],until:new Date(Date.now()+864000000).toISOString().slice(0,10),recipient:'Bob',email:bob.user.profile.email},alice.cookie,201);
    const dashboard = await json<Dashboard>('/dashboard','GET',undefined,bob.cookie);
    const share = dashboard.receivedShares.find(s=>s.title==='Cloud file')!;
    assert.ok(share);
    await json(`/received-shares/${share.id}`,'PATCH',{status:'accepted'},bob.cookie);
    const result = await request(`/received-shares/${share.id}/file`,'GET',undefined,bob.cookie);
    assert.equal(result.status,200); assert.deepEqual(Buffer.from(await result.arrayBuffer()),pdf);
    const {shares} = await json<{shares:{id:string}[]}>('/sharing','GET',undefined,alice.cookie);
    assert.equal((await request(`/shares/${shares[0].id}`,'DELETE',undefined,alice.cookie)).status,204);
    assert.equal((await request(`/received-shares/${share.id}/file`,'GET',undefined,bob.cookie)).status,403);
  });
  await t.test('all admin list queries, analytics and social reads run on PostgreSQL', async () => {
    await json('/admin/overview','GET',undefined,alice.cookie);
    await json('/admin/analytics','GET',undefined,alice.cookie);
    for (const resource of adminResources) await json(`/admin/${resource}?q=Cloud`,'GET',undefined,alice.cookie);
    await json('/social','GET',undefined,alice.cookie);
    await json('/profile','GET',undefined,alice.cookie);
  });
  await t.test('profile photo survives edits without re-uploading; removal is respected', async () => {
    const profile=await json<Profile>('/profile','GET',undefined,alice.cookie);
    await json('/profile','PATCH',{...profile,photo:{type:'image/png',content:photo.toString('base64')}},alice.cookie);
    const {photo: ignored, ...rest}=profile; void ignored;
    await json('/profile','PATCH',{...rest,name:'Updated Cloud'},alice.cookie);
    const picture=await request('/profile/photo','GET',undefined,alice.cookie);
    assert.equal(picture.status,200); assert.deepEqual(Buffer.from(await picture.arrayBuffer()),photo);
    await json('/profile','PATCH',{...rest,photo:null},alice.cookie);
    assert.equal((await request('/profile/photo','GET',undefined,alice.cookie)).status,404);
  });
  await t.test('community messages, thread photos and public lead writes use the hosted store', async () => {
    const group=await json<{id:string}>('/social/communities','POST',{name:'Cloud group',city:'Paris',topic:'Entraide',description:'Local test group'},alice.cookie,201);
    await json(`/social/communities/${group.id}/join`,'POST',{},bob.cookie,204);
    const social=await json<SocialData>('/social','GET',undefined,alice.cookie);
    const thread=social.threads.find(t=>t.kind==='community')!;
    assert.ok(thread);
    await json(`/social/threads/${thread.id}/messages`,'POST',{text:'Cloud message'},alice.cookie,204);
    await json(`/social/threads/${thread.id}`,'PATCH',{photo:{type:'image/png',content:photo.toString('base64')}},alice.cookie,204);
    const other=await json<SocialData>('/social','GET',undefined,bob.cookie);
    assert.equal(other.threads.find(t=>t.id===thread.id)?.messages.at(-1)?.text,'Cloud message');
    assert.equal((await request(`/social/threads/${thread.id}/photo`,'GET',undefined,bob.cookie)).status,200);
    await json('/public/leads','POST',{requestId:randomUUID(),kind:'liste-attente',name:'Cloud Test',email:'lead@cloud.test',consent:true,profile:'proprietaire',animals:['chat'],plan:'gratuit'},'',201);
    assert.equal(db.prepare("SELECT count(*) AS n FROM public_leads WHERE email='lead@cloud.test'").get()!.n,1);
  });
  await t.test('direct requests and forged proxy credentials are rejected; scheduler is separate', async () => {
    assert.equal((await fetch(base+'/dashboard',{headers:{Cookie:alice.cookie}})).status,403);
    assert.equal((await fetch(base+'/dashboard',{headers:{Cookie:alice.cookie,'x-anivaya-proxy':'forged'}})).status,403);
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await request('/internal/reminders','POST',{})).status,401);
    assert.equal((await fetch(base+'/internal/reminders',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`}})).status,204);
  });
  await t.test('a fresh Node process reads the same session, account and remote file', async () => {
    const child = spawn(process.execPath,['back/tests/cloud-restart-probe.ts'], {stdio:['ignore','pipe','inherit'], env:{...process.env,TEST_ACCOUNT:alice.user.id,TEST_DOCUMENT:doc.id,TEST_COOKIE:alice.cookie}});
    let output=''; child.stdout.on('data',chunk=>output+=chunk);
    const [code] = await once(child,'exit'); assert.equal(code,0); assert.match(output,/restart passed/);
  });
  await t.test('rollback is atomic and orphan cleanup retains referenced objects', () => {
    const schema = databaseSchema(alice.user.id);
    postgresCall('exec',schema,'BEGIN');
    postgresCall('query',schema,"INSERT INTO documents(id,name,animal,type,content) VALUES (?,?,?,?,?)",['rollback-doc','Rollback',animal.id,'application/pdf',Buffer.from('%PDF-1.4 orphan')]);
    postgresCall('exec',schema,'ROLLBACK');
    assert.equal(postgresCall('query',schema,"SELECT id FROM documents WHERE id='rollback-doc'").rows.length,0);
    postgresCall('exec',schema,"UPDATE _objects SET created_at=now()-interval '2 days'");
    assert.equal(postgresCall('gc',schema),1);
    assert.equal(postgresCall('query',schema,'SELECT content FROM documents WHERE id=?',[doc.id]).rows[0].content.length,pdf.length);
  });
  await t.test('deleting a disposable account removes its private schema and storage objects', async () => {
    const disposable=await register('delete@cloud.test');
    const pet=await json<Animal>('/animals','POST',{name:'Disposable',species:'Chat',photo:{type:'image/png',content:photo.toString('base64')}},disposable.cookie,201);
    assert.ok(pet.id);
    const schema=databaseSchema(disposable.user.id);
    const key=postgresCall('query',schema,'SELECT key FROM _objects').rows[0].key;
    await json('/account','DELETE',{confirmation:'SUPPRIMER'},disposable.cookie,204);
    assert.equal(db.prepare('SELECT id FROM accounts WHERE id=?').get(disposable.user.id),undefined);
    assert.equal(db.prepare('SELECT nspname FROM pg_namespace WHERE nspname=?').get(schema),undefined);
    const deleted=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/anivaya-private/${key}`,{headers:{Authorization:'Bearer local-storage-fixture'}});
    assert.equal(deleted.status,404);
  });
});
