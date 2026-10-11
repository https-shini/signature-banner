CREATE TABLE IF NOT EXISTS __SCHEMA__.profiles (id uuid PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS __SCHEMA__.assets (id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES __SCHEMA__.profiles(id) ON DELETE CASCADE, payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS assets_profile ON __SCHEMA__.assets(profile_id);
CREATE TABLE IF NOT EXISTS __SCHEMA__.revisions (id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES __SCHEMA__.assets(id) ON DELETE CASCADE, version integer NOT NULL CHECK (version > 0), payload jsonb NOT NULL, UNIQUE(asset_id, version));
CREATE TABLE IF NOT EXISTS __SCHEMA__.templates (id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES __SCHEMA__.profiles(id) ON DELETE CASCADE, payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS templates_profile ON __SCHEMA__.templates(profile_id);
CREATE TABLE IF NOT EXISTS __SCHEMA__.media (id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES __SCHEMA__.profiles(id) ON DELETE CASCADE, payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS media_profile ON __SCHEMA__.media(profile_id);
CREATE TABLE IF NOT EXISTS __SCHEMA__.metadata (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE IF NOT EXISTS __SCHEMA__.storage_cleanup (path text PRIMARY KEY);
-- Backend somente. Nenhuma policy permite acesso anônimo via Data API.
ALTER TABLE __SCHEMA__.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.storage_cleanup ENABLE ROW LEVEL SECURITY;
