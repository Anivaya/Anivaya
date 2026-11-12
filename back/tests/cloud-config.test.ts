import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../api/config.ts';
import { vercelConfig } from '../../scripts/vercel-output.ts';
import { postgresSql } from '../database/postgres-sql.ts';
import { sendMail } from '../api/mail.ts';
import { clientAddress } from '../api/validation.ts';
import type { IncomingMessage } from 'node:http';

test('cloud configuration rejects ephemeral databases, insecure TLS and incomplete secrets', () => {
  const env = {NODE_ENV:'production',RENDER:'true',DATABASE_URL:'postgresql://anivaya_app:local-test@db.supabase.test/postgres',SUPABASE_URL:'https://local-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'local-test',SUPABASE_STORAGE_BUCKET:'anivaya-private',APP_URL:'https://anivaya.com',PUBLIC_SITE_URL:'https://anivaya.com',ALLOWED_ORIGINS:'https://anivaya.com',MFA_ENCRYPTION_KEY:'ab'.repeat(32),API_PROXY_SECRET:'cd'.repeat(32),CRON_SECRET:'ef'.repeat(32),REMINDERS_MODE:'external',MAIL_PROVIDER:'resend',RESEND_API_KEY:'local-test',MAIL_FROM:'Anivaya <test@anivaya.test>',LEGAL_CONTENT_JSON:JSON.stringify({reviewed:true,sections:['mentions-legales','confidentialite','cookies'].map(id=>({id,title:id,paragraphs:['Contenu de test local uniquement.']}))}),DATABASE_SSL:'',ANIVAYA_POSTGRES_TEST:'',OPENROUTER_API_KEY:''};
  const before = {...process.env};
  try {
    Object.assign(process.env,env); assert.doesNotThrow(validateProductionConfig);
    process.env.DATABASE_SSL='disable'; assert.throws(validateProductionConfig,/TLS/); process.env.DATABASE_SSL='';
    process.env.DATABASE_URL=env.DATABASE_URL+'?sslmode=no-verify'; assert.throws(validateProductionConfig,/TLS/); process.env.DATABASE_URL=env.DATABASE_URL;
    process.env.API_PROXY_SECRET=''; assert.throws(validateProductionConfig,/API_PROXY_SECRET/); process.env.API_PROXY_SECRET=env.API_PROXY_SECRET;
    process.env.CRON_SECRET=env.API_PROXY_SECRET; assert.throws(validateProductionConfig,/different/); process.env.CRON_SECRET=env.CRON_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY=''; assert.throws(validateProductionConfig,/SUPABASE_SERVICE_ROLE_KEY/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env,before); }
});

test('Vercel routes proxy API before SPA fallback and never publish the secret as response headers', () => {
  const secret='ab'.repeat(32), config=vercelConfig('https://anivaya-api.onrender.com',secret);
  assert.equal(config.routes[0].status,404);
  const api=config.routes[1]; assert.equal(api.dest,'https://anivaya-api.onrender.com/api/$1');
  assert.equal(api.headers?.['Cache-Control'],'private, no-store');
  assert.equal(api.transforms?.[0].type,'request.headers');
  assert.ok(!JSON.stringify(api.headers).includes(secret));
  assert.throws(()=>vercelConfig('http://anivaya-api.onrender.com',secret));
  assert.throws(()=>vercelConfig('https://attacker.test',secret));
});

test('Vercel permits same-origin PDF previews without allowing the application to be framed', () => {
  const config=vercelConfig('https://anivaya-api.onrender.com','ab'.repeat(32));
  const policies=config.routes.filter(route => route.headers && 'X-Frame-Options' in route.headers)
    .map(route => ({src: route.src!, headers: route.headers as Record<string,string | undefined>}));
  for (const path of ['/api/documents/demo/file','/api/received-shares/demo/file','/api/admin/pros/demo/documents/proof/file']) {
    const matches=policies.filter(route => new RegExp(`^${route.src}$`).test(path));
    assert.equal(matches.length,1);
    assert.equal(matches[0].headers?.['X-Frame-Options'],'SAMEORIGIN');
    assert.match(matches[0].headers?.['Content-Security-Policy'] || '', /frame-ancestors 'self'/);
  }
  for (const path of ['/','/index.html','/api/dashboard','/api/documents/demo/file/extra','/api/admin/users']) {
    const matches=policies.filter(route => new RegExp(`^${route.src}$`).test(path));
    assert.equal(matches.length,1);
    assert.equal(matches[0].headers?.['X-Frame-Options'],'DENY');
    assert.match(matches[0].headers?.['Content-Security-Policy'] || '', /frame-ancestors 'none'/);
  }
});

test('SQL conversion preserves literals, bound values, aliases and insertion order', () => {
  const sql=postgresSql("SELECT 'INTEGER ? LIKE rowid; it''s' AS message,first_name AS firstName FROM animals WHERE name LIKE ? AND id=? ORDER BY rowid");
  assert.match(sql,/'INTEGER \? LIKE rowid; it''s'/);
  assert.match(sql,/AS "firstName"/); assert.match(sql,/ILIKE \$1 AND id=\$2/); assert.match(sql,/ORDER BY _rowid/);
  assert.match(postgresSql('INSERT OR IGNORE INTO professional_favorites VALUES (?)'),/ON CONFLICT DO NOTHING$/);
});

test('trusted proxy IP requires the shared secret', () => {
  const previous=process.env.API_PROXY_SECRET, trust=process.env.TRUST_PROXY;
  process.env.API_PROXY_SECRET='ab'.repeat(32); delete process.env.TRUST_PROXY;
  try {
    const req={headers:{'x-forwarded-for':'203.0.113.7, 127.0.0.1','x-anivaya-proxy':'forged'},socket:{remoteAddress:'127.0.0.2'}};
    assert.equal(clientAddress(req as unknown as IncomingMessage),'127.0.0.2');
    req.headers['x-anivaya-proxy']=process.env.API_PROXY_SECRET;
    assert.equal(clientAddress(req as unknown as IncomingMessage),'203.0.113.7');
  } finally {
    if(previous===undefined) delete process.env.API_PROXY_SECRET; else process.env.API_PROXY_SECRET=previous;
    if(trust===undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY=trust;
  }
});

test('Resend sends through HTTPS and reports provider failure without a local fallback', async t => {
  const saved={MAIL_PROVIDER:process.env.MAIL_PROVIDER,RESEND_API_KEY:process.env.RESEND_API_KEY};
  process.env.MAIL_PROVIDER='resend';process.env.RESEND_API_KEY='fixture-key';
  let calls=0;
  t.mock.method(globalThis,'fetch',async (url:string,init:RequestInit)=>{
    calls++;assert.equal(url,'https://api.resend.com/emails');
    const headers=init.headers as Record<string,string>;
    assert.equal(headers.Authorization,'Bearer fixture-key'); assert.equal(headers['Idempotency-Key'],'reminder/test');
    assert.deepEqual(JSON.parse(init.body as string).to,['person@example.net']);
    return new Response(calls===1?'{}':'{"error":"quota"}',{status:calls===1?200:429});
  });
  try {
    const mail={to:'person@example.net',subject:'Test',text:'Test',idempotencyKey:'reminder/test'};
    assert.equal(await sendMail(mail),'sent'); assert.equal(await sendMail(mail),'failed'); assert.equal(calls,2);
  } finally { for(const [key,value] of Object.entries(saved)) if(value===undefined) delete process.env[key]; else process.env[key]=value; }
});
