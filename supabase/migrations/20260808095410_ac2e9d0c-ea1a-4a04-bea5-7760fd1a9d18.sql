
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- source registry
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  domain text NOT NULL,
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 6),
  source_type text NOT NULL DEFAULT 'government',
  country text,
  destination text,
  visa_types text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en',
  crawl_status text NOT NULL DEFAULT 'pending',
  last_crawled_at timestamptz,
  last_error text,
  content_hash text,
  freshness_days integer,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_dest_idx ON public.sources (destination, tier);
CREATE INDEX sources_status_idx ON public.sources (crawl_status);
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sources" ON public.sources FOR SELECT USING (true);
CREATE POLICY "admins write sources" ON public.sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sources_touch BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.crawls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  http_status integer,
  bytes integer,
  error text,
  robots_allowed boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX crawls_source_idx ON public.crawls (source_id, started_at DESC);
GRANT SELECT ON public.crawls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.crawls TO authenticated;
GRANT ALL ON public.crawls TO service_role;
ALTER TABLE public.crawls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read crawls" ON public.crawls FOR SELECT USING (true);
CREATE POLICY "admins write crawls" ON public.crawls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  content text NOT NULL,
  content_hash text NOT NULL,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  lang text NOT NULL DEFAULT 'en',
  UNIQUE (source_id, content_hash)
);
CREATE INDEX documents_source_idx ON public.documents (source_id);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "admins write documents" ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  position integer NOT NULL,
  content text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0,
  embedding_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, position)
);
CREATE INDEX chunks_source_idx ON public.document_chunks (source_id);
CREATE INDEX chunks_fts_idx ON public.document_chunks USING gin (to_tsvector('english', content));
GRANT SELECT ON public.document_chunks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read chunks" ON public.document_chunks FOR SELECT USING (true);
CREATE POLICY "admins write chunks" ON public.document_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- cases
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled case',
  nationality text,
  residence_country text,
  destination text,
  visa_type text,
  travel_date date,
  application_date date,
  employment_status text,
  financial_summary text,
  sponsor_info text,
  travel_history text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cases_user_idx ON public.cases (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cases" ON public.cases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cases_touch BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  answer jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_messages_case_idx ON public.case_messages (case_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_messages TO authenticated;
GRANT ALL ON public.case_messages TO service_role;
ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own case messages" ON public.case_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  doc_kind text,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_documents_case_idx ON public.case_documents (case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own case documents" ON public.case_documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  readiness_score integer,
  summary text,
  mode text NOT NULL DEFAULT 'live',
  status text NOT NULL DEFAULT 'complete',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audits_case_idx ON public.audits (case_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audits" ON public.audits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  detected_from_document text,
  requirement_from_source text,
  source_url text,
  needs_human_verification boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_findings_audit_idx ON public.audit_findings (audit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own findings" ON public.audit_findings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  why text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','have','na')),
  source_url text,
  source_title text,
  source_tier smallint,
  last_verified_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checklist_case_idx ON public.checklist_items (case_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist" ON public.checklist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_time_idx ON public.usage_events (created_at DESC);
GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own usage" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "read own usage" ON public.usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- seed source registry
INSERT INTO public.sources (title, url, domain, tier, source_type, country, destination, visa_types, notes) VALUES
('EU Visa Policy — Schengen short-stay visa','https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en','home-affairs.ec.europa.eu',3,'regulation',NULL,'Schengen','{tourism,business,family,transit}','EU Commission visa policy hub'),
('Visa Code (Regulation EC No 810/2009)','https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32009R0810','eur-lex.europa.eu',3,'regulation',NULL,'Schengen','{tourism,business,family,transit}','Consolidated EU Visa Code'),
('France-Visas — Official visa website of France','https://france-visas.gouv.fr/en/web/france-visas/','france-visas.gouv.fr',1,'government',NULL,'France','{tourism,student,work,family,transit}','Official French visa portal'),
('Germany Federal Foreign Office — Visa regulations','https://www.auswaertiges-amt.de/en/visa-service','auswaertiges-amt.de',1,'government',NULL,'Germany','{tourism,student,work,family}','German Federal Foreign Office'),
('Netherlands IND — Short stay Schengen visa','https://ind.nl/en/short-stay','ind.nl',1,'government',NULL,'Netherlands','{tourism,business,family}','Dutch immigration authority'),
('Italy — Visa for Italy portal','https://vistoperitalia.esteri.it/home/en','esteri.it',1,'government',NULL,'Italy','{tourism,student,work,family}','Italian MFA visa portal'),
('Spain — Ministry of Foreign Affairs visa information','https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Visados.aspx','exteriores.gob.es',1,'government',NULL,'Spain','{tourism,student,work,family}','Spanish MFA'),
('VFS Global — India to Schengen application centres','https://visa.vfsglobal.com/ind/en/','vfsglobal.com',2,'application_center','India','Schengen','{tourism,student,work,family}','Official outsourced application partner'),
('BLS International — Spain visa India','https://www.blsspainvisa.com/','blsspainvisa.com',2,'application_center','India','Spain','{tourism,student,family}','Official outsourced application partner'),
('Government of India — Passport Seva','https://www.passportindia.gov.in/','passportindia.gov.in',1,'government','India',NULL,'{}','Indian passport authority'),
('r/SchengenVisa — applicant experiences','https://www.reddit.com/r/SchengenVisa/','reddit.com',5,'community',NULL,'Schengen','{tourism,student,work,family}','Anecdotal applicant reports, accessed via official Reddit API only'),
('r/immigration — applicant experiences','https://www.reddit.com/r/immigration/','reddit.com',5,'community',NULL,NULL,'{}','Anecdotal applicant reports, accessed via official Reddit API only');
