-- Isolated test infrastructure; not a migration for hosted Supabase.
\getenv pgpass POSTGRES_PASSWORD
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
CREATE ROLE identify_saas LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD :'pgpass';
GRANT authenticated TO identify_saas;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD :'pgpass';
GRANT anon,authenticated,service_role TO authenticator;
CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD :'pgpass';
CREATE ROLE supabase_storage_admin LOGIN CREATEROLE BYPASSRLS PASSWORD :'pgpass';
GRANT anon,authenticated,service_role TO supabase_storage_admin;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public,extensions,auth TO anon,authenticated,service_role,supabase_auth_admin,supabase_storage_admin;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
 (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role')) $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
GRANT CREATE ON SCHEMA public TO supabase_storage_admin;
ALTER ROLE supabase_auth_admin SET search_path TO auth,public,extensions;
ALTER ROLE supabase_storage_admin SET search_path TO storage,public,extensions;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,service_role;

ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
