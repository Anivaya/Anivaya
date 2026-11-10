-- Enable pg_cron + pg_net in Supabase Extensions first.
-- In Vault create two secrets, without committing their values:
-- anivaya_api_url = https://YOUR-SERVICE.onrender.com
-- anivaya_cron_secret = the separate CRON_SECRET configured on Render
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='anivaya_api_url')
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='anivaya_cron_secret') THEN
    RAISE EXCEPTION 'Configure the Anivaya URL and cron secret in Vault first';
  END IF;
END $$;
SELECT cron.schedule(
  'anivaya-reminders', '15 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='anivaya_api_url') || '/api/internal/reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='anivaya_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $job$
);
-- Inspect cron.job_run_details AND net._http_response: cron success alone only
-- means the HTTP call was queued. Expected HTTP response: 204.
-- Disable if no longer needed: SELECT cron.unschedule('anivaya-reminders');
