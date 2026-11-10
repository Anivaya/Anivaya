-- Run once in the SQL editor of a NEW, dedicated Supabase project.
-- The app owns only its own schemas. Do not use the postgres owner in Render.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anivaya_app') THEN
    CREATE ROLE anivaya_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;
GRANT CONNECT, CREATE ON DATABASE postgres TO anivaya_app;
-- Set a unique password and enable LOGIN in your private SQL editor separately:
-- ALTER ROLE anivaya_app LOGIN PASSWORD '<your-generated-password>';
-- Do not commit this statement with a real password.

-- Create the private bucket using the Storage dashboard, named anivaya-private.
-- Keep Public OFF; allow application/octet-stream and a 10 MB object limit.
-- Do not expose anivaya or anivaya_u_* schemas in the Data API configuration.
-- Do not add anon/authenticated policies to the private bucket.
