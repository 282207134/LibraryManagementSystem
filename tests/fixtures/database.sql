CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
CREATE TABLE public.users(
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email varchar(255) NOT NULL UNIQUE,full_name varchar(255) NOT NULL,role varchar(50) DEFAULT 'user' CHECK(role IN ('user','admin')),
 phone varchar(20),address text,member_since timestamptz DEFAULT now(),max_borrow_limit integer DEFAULT 5,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.books(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(255) NOT NULL,author varchar(255) NOT NULL,
 isbn varchar(20),publisher text,publication_year integer,category text,description text,
 quantity integer DEFAULT 1,available_quantity integer DEFAULT 1,cover_image_url text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.borrowing_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 borrowed_at timestamptz DEFAULT now(),due_date timestamptz NOT NULL,returned_at timestamptz,
 status varchar(50) DEFAULT 'borrowed' CHECK(status IN ('borrowed','returned','overdue','lost')),
 notes text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='admin') $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING(auth.uid()=id);
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING(public.is_admin());
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING(auth.uid()=id);
CREATE POLICY "Users can insert own data" ON public.users FOR INSERT WITH CHECK(auth.uid()=id);
CREATE POLICY "Users can view own borrowing records" ON public.borrowing_records FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY "Admins can view all borrowing records" ON public.borrowing_records FOR SELECT USING(public.is_admin());
CREATE POLICY "Users can create own borrowing records" ON public.borrowing_records FOR INSERT WITH CHECK(auth.uid()=user_id);
CREATE POLICY "Users can update own borrowing records" ON public.borrowing_records FOR UPDATE USING(auth.uid()=user_id);
CREATE POLICY "Authenticated users can manage books" ON public.books FOR ALL USING(auth.role()='authenticated');
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
