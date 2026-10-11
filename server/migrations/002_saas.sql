-- Explicit administration only. Never applied by personal-mode startup.
-- Existing rows remain unowned (NULL); authenticated policies hide them.
CREATE TABLE __SCHEMA__.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE __SCHEMA__.members (
  workspace_id uuid REFERENCES __SCHEMA__.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE __SCHEMA__.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES __SCHEMA__.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,workspace_id)
);
-- Definer is deliberately narrow: no dynamic SQL, fixed search_path, boolean only.
CREATE FUNCTION __SCHEMA__.owns_workspace(w uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM __SCHEMA__.workspaces WHERE id=w AND owner_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION __SCHEMA__.owns_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION __SCHEMA__.owns_workspace(uuid) TO authenticated;
CREATE FUNCTION __SCHEMA__.workspace_scope(w uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT __SCHEMA__.owns_workspace(w) AND
  (nullif(current_setting('app.workspace_id',true),'') IS NULL OR
   w = nullif(current_setting('app.workspace_id',true),'')::uuid) $$;
REVOKE ALL ON FUNCTION __SCHEMA__.workspace_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION __SCHEMA__.workspace_scope(uuid) TO authenticated;
CREATE FUNCTION __SCHEMA__.project_scope(p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT nullif(current_setting('app.project_id',true),'') IS NULL OR
  p = nullif(current_setting('app.project_id',true),'')::uuid $$;
REVOKE ALL ON FUNCTION __SCHEMA__.project_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION __SCHEMA__.project_scope(uuid) TO authenticated;
CREATE FUNCTION __SCHEMA__.add_workspace_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$ BEGIN
  INSERT INTO __SCHEMA__.members(workspace_id,user_id,role) VALUES(NEW.id,NEW.owner_id,'owner');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION __SCHEMA__.add_workspace_owner() FROM PUBLIC;
CREATE TRIGGER workspace_owner AFTER INSERT ON __SCHEMA__.workspaces
FOR EACH ROW EXECUTE FUNCTION __SCHEMA__.add_workspace_owner();
ALTER TABLE __SCHEMA__.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE __SCHEMA__.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY owned_workspaces ON __SCHEMA__.workspaces TO authenticated
USING (owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY own_members ON __SCHEMA__.members FOR SELECT TO authenticated
USING (__SCHEMA__.owns_workspace(workspace_id));
CREATE POLICY owned_projects ON __SCHEMA__.projects TO authenticated
USING (__SCHEMA__.workspace_scope(workspace_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id));
GRANT USAGE ON SCHEMA __SCHEMA__ TO authenticated;
GRANT SELECT,DELETE ON __SCHEMA__.workspaces TO authenticated;
GRANT INSERT(id,owner_id,name,description,settings), UPDATE(name,description,settings) ON __SCHEMA__.workspaces TO authenticated;
GRANT SELECT ON __SCHEMA__.members TO authenticated;
GRANT SELECT,DELETE ON __SCHEMA__.projects TO authenticated;
GRANT INSERT(id,workspace_id,name,description,settings), UPDATE(name,description,settings) ON __SCHEMA__.projects TO authenticated;
ALTER TABLE __SCHEMA__.profiles ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid REFERENCES __SCHEMA__.workspaces(id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.profiles ADD UNIQUE(id,workspace_id);
ALTER TABLE __SCHEMA__.assets ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.assets ADD COLUMN project_id uuid DEFAULT nullif(current_setting('app.project_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.assets ADD FOREIGN KEY(profile_id,workspace_id) REFERENCES __SCHEMA__.profiles(id,workspace_id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.assets ADD FOREIGN KEY(project_id,workspace_id) REFERENCES __SCHEMA__.projects(id,workspace_id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.assets ADD UNIQUE(id,workspace_id,project_id);
ALTER TABLE __SCHEMA__.assets ADD CHECK ((workspace_id IS NULL AND project_id IS NULL) OR (workspace_id IS NOT NULL AND project_id IS NOT NULL));
ALTER TABLE __SCHEMA__.revisions ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.revisions ADD COLUMN project_id uuid DEFAULT nullif(current_setting('app.project_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.revisions ADD FOREIGN KEY(asset_id,workspace_id,project_id) REFERENCES __SCHEMA__.assets(id,workspace_id,project_id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.revisions ADD CHECK ((workspace_id IS NULL AND project_id IS NULL) OR (workspace_id IS NOT NULL AND project_id IS NOT NULL));
ALTER TABLE __SCHEMA__.templates ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.templates ADD FOREIGN KEY(profile_id,workspace_id) REFERENCES __SCHEMA__.profiles(id,workspace_id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.media ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid;
ALTER TABLE __SCHEMA__.media ADD FOREIGN KEY(profile_id,workspace_id) REFERENCES __SCHEMA__.profiles(id,workspace_id) ON DELETE CASCADE;
ALTER TABLE __SCHEMA__.storage_cleanup ADD COLUMN workspace_id uuid DEFAULT nullif(current_setting('app.workspace_id',true),'')::uuid REFERENCES __SCHEMA__.workspaces(id) ON DELETE CASCADE;
CREATE POLICY owned_profiles ON __SCHEMA__.profiles TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id));
CREATE POLICY owned_assets ON __SCHEMA__.assets TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id) AND __SCHEMA__.project_scope(project_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id) AND __SCHEMA__.project_scope(project_id));
CREATE POLICY owned_revisions ON __SCHEMA__.revisions TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id) AND __SCHEMA__.project_scope(project_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id) AND __SCHEMA__.project_scope(project_id));
CREATE POLICY owned_templates ON __SCHEMA__.templates TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id));
CREATE POLICY owned_media ON __SCHEMA__.media TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id));
CREATE POLICY owned_cleanup ON __SCHEMA__.storage_cleanup TO authenticated USING (__SCHEMA__.workspace_scope(workspace_id)) WITH CHECK(__SCHEMA__.workspace_scope(workspace_id) AND split_part(path,'/',1)=workspace_id::text);
GRANT SELECT,DELETE ON __SCHEMA__.profiles,__SCHEMA__.assets,__SCHEMA__.templates,__SCHEMA__.media,__SCHEMA__.revisions,__SCHEMA__.storage_cleanup TO authenticated;
GRANT INSERT(id,payload),UPDATE(payload) ON __SCHEMA__.profiles TO authenticated;
GRANT INSERT(id,profile_id,payload),UPDATE(payload) ON __SCHEMA__.assets,__SCHEMA__.templates,__SCHEMA__.media TO authenticated;
GRANT INSERT(id,asset_id,version,payload) ON __SCHEMA__.revisions TO authenticated;
GRANT INSERT(path) ON __SCHEMA__.storage_cleanup TO authenticated;
-- JSON identifiers must agree with relational links even through direct Data API.
ALTER TABLE __SCHEMA__.profiles ADD CHECK((payload->>'id') IS NOT DISTINCT FROM id::text);
ALTER TABLE __SCHEMA__.assets ADD CHECK((payload->>'id') IS NOT DISTINCT FROM id::text AND (payload->>'profileId') IS NOT DISTINCT FROM profile_id::text);
ALTER TABLE __SCHEMA__.templates ADD CHECK((payload->>'id') IS NOT DISTINCT FROM id::text AND (payload->>'profileId') IS NOT DISTINCT FROM profile_id::text);
ALTER TABLE __SCHEMA__.media ADD CHECK((payload->>'id') IS NOT DISTINCT FROM id::text AND (payload->>'profileId') IS NOT DISTINCT FROM profile_id::text);
ALTER TABLE __SCHEMA__.revisions ADD CHECK((payload->>'id') IS NOT DISTINCT FROM id::text AND (payload->>'assetId') IS NOT DISTINCT FROM asset_id::text AND (payload->>'version')::integer IS NOT DISTINCT FROM version AND (payload->'snapshot'->>'id') IS NOT DISTINCT FROM asset_id::text);
CREATE INDEX projects_workspace ON __SCHEMA__.projects(workspace_id);
CREATE INDEX profiles_workspace ON __SCHEMA__.profiles(workspace_id);
CREATE INDEX assets_project ON __SCHEMA__.assets(workspace_id,project_id);
CREATE INDEX templates_workspace ON __SCHEMA__.templates(workspace_id);
CREATE INDEX media_workspace ON __SCHEMA__.media(workspace_id);
CREATE INDEX revisions_workspace ON __SCHEMA__.revisions(workspace_id,project_id);
CREATE INDEX cleanup_workspace ON __SCHEMA__.storage_cleanup(workspace_id);
-- Dedicated bucket name avoids changing the policies of personal-mode files.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('identify-workspaces','identify-workspaces',false,5242880,ARRAY['image/png']);
CREATE POLICY identify_private_files ON storage.objects TO authenticated
USING (bucket_id='identify-workspaces' AND __SCHEMA__.owns_workspace(
 CASE WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid ELSE NULL END))
WITH CHECK (bucket_id='identify-workspaces' AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.]png$' AND __SCHEMA__.owns_workspace(
 CASE WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid ELSE NULL END));
INSERT INTO __SCHEMA__.schema_migrations VALUES(2);

CREATE POLICY runtime_schema_version ON __SCHEMA__.schema_migrations FOR SELECT USING(true);
-- Runtime login must be provisioned by administration, never by the app.
-- GRANT authenticated TO <runtime_login>;
-- GRANT USAGE ON SCHEMA __SCHEMA__ TO <runtime_login>;
-- GRANT SELECT ON __SCHEMA__.schema_migrations TO <runtime_login>;

NOTIFY pgrst, 'reload schema';
