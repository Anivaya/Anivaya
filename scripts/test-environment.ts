/** Test processes must never inherit live database, mail, AI or proxy credentials. */
export function testEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/^(DATABASE_|SUPABASE_|SMTP_|RESEND_|MAIL_|OPENROUTER_|API_PROXY_SECRET$|CRON_SECRET$|LEGAL_CONTENT_|RENDER$|MFA_ENCRYPTION_KEY$|REMINDERS_MODE$|ANIVAYA_EMPTY_STATE$|ALLOWED_ORIGINS$|APP_URL$|PUBLIC_SITE_URL$|TRUST_PROXY$)/.test(key)) delete env[key];
  env.NODE_ENV = 'test';
  delete env.ANIVAYA_TESTING_PREVIEW;
  delete env.VITE_TESTING_PREVIEW;
  return env;
}
