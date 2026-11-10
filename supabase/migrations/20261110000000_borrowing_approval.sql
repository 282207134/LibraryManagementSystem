-- Apply before deploying the matching frontend. Existing loans and covers are preserved.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Existing AFTER-loan triggers call this helper. Qualify its tables so it also
-- works inside RPCs with an empty search_path, and count lost copies as occupied.
CREATE OR REPLACE FUNCTION public.update_book_available_quantity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_book_id uuid;
BEGIN
  v_book_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.book_id ELSE NEW.book_id END;
  PERFORM 1 FROM public.books WHERE id = v_book_id FOR UPDATE;
  UPDATE public.books SET available_quantity = quantity -
    (SELECT count(*) FROM public.borrowing_records WHERE book_id = v_book_id AND status IN ('borrowed','overdue','lost'))
    WHERE id = v_book_id;
  RETURN coalesce(NEW,OLD);
END; $$;

CREATE TABLE IF NOT EXISTS public.borrowing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  pickup_code text NOT NULL UNIQUE CHECK (pickup_code ~ '^[0-9]{8}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
  requested_days integer NOT NULL DEFAULT 30 CHECK (requested_days BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  review_note text CHECK (length(review_note) <= 500),
  borrowing_id uuid UNIQUE REFERENCES public.borrowing_records(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS borrowing_requests_one_pending
  ON public.borrowing_requests(user_id, book_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS borrowing_requests_user_created ON public.borrowing_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS borrowing_requests_pending_expiry ON public.borrowing_requests(expires_at) WHERE status = 'pending';
ALTER TABLE public.borrowing_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own requests or administer" ON public.borrowing_requests;
CREATE POLICY "Read own requests or administer" ON public.borrowing_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
REVOKE ALL ON public.borrowing_requests FROM anon, authenticated;
GRANT SELECT ON public.borrowing_requests TO authenticated;

-- Only the checked RPCs may change loans. A direct REST write must not bypass approval.
REVOKE INSERT, UPDATE, DELETE ON public.borrowing_records FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_borrow_book(p_book_id uuid, p_days integer DEFAULT 30)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer;
  v_available integer;
  v_code text;
  v_request public.borrowing_requests;
BEGIN
  IF v_user IS NULL THEN RETURN json_build_object('success',false,'error','请先登录'); END IF;
  IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 60 THEN
    RETURN json_build_object('success',false,'error','借期须为 1 至 60 天');
  END IF;
  -- Serialize all requests/approvals for one reader, including different books.
  SELECT coalesce(max_borrow_limit,5) INTO v_limit FROM public.users WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','用户资料不存在，请重新登录'); END IF;
  UPDATE public.borrowing_requests SET status = 'expired'
    WHERE user_id = v_user AND status = 'pending' AND expires_at <= now();
  IF EXISTS (SELECT 1 FROM public.borrowing_requests WHERE user_id = v_user AND book_id = p_book_id AND status = 'pending')
     OR EXISTS (SELECT 1 FROM public.borrowing_records WHERE user_id = v_user AND book_id = p_book_id AND status IN ('borrowed','overdue')) THEN
    RETURN json_build_object('success',false,'error','您已申请或借阅此书，请查看我的借阅');
  END IF;
  IF (SELECT count(*) FROM public.borrowing_records WHERE user_id = v_user AND status IN ('borrowed','overdue'))
     + (SELECT count(*) FROM public.borrowing_requests WHERE user_id = v_user AND status = 'pending') >= v_limit THEN
    RETURN json_build_object('success',false,'error','已达到借阅及待确认申请上限');
  END IF;
  SELECT available_quantity INTO v_available FROM public.books WHERE id = p_book_id;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','图书不存在'); END IF;
  IF coalesce(v_available,0) <= 0 THEN RETURN json_build_object('success',false,'error','该图书暂无可借库存'); END IF;
  FOR attempt IN 1..20 LOOP
    v_code := (10000000 + floor(random() * 90000000))::bigint::text;
    INSERT INTO public.borrowing_requests(user_id,book_id,pickup_code,requested_days)
      VALUES(v_user,p_book_id,v_code,p_days)
      ON CONFLICT (pickup_code) DO NOTHING RETURNING * INTO v_request;
    EXIT WHEN FOUND;
  END LOOP;
  IF v_request.id IS NULL THEN RAISE EXCEPTION '暂时无法生成取书码，请重试'; END IF;
  RETURN json_build_object('success',true,'status','pending','request_id',v_request.id,
    'pickup_code',v_request.pickup_code,'expires_at',v_request.expires_at);
END; $$;

-- Old clients also create an application, never an already approved loan.
DROP FUNCTION IF EXISTS public.borrow_book(uuid, uuid);
CREATE OR REPLACE FUNCTION public.borrow_book(p_book_id uuid, p_user_id uuid, p_days integer DEFAULT 30)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('success',false,'error','不能代其他用户申请借阅');
  END IF;
  RETURN public.request_borrow_book(p_book_id,p_days);
END; $$;

CREATE OR REPLACE FUNCTION public.approve_borrow_request(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.borrowing_requests;
  v_limit integer;
  v_book public.books;
  v_borrowing uuid;
  v_due timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN json_build_object('success',false,'error','仅管理员可以确认借出');
  END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9]{8}$' THEN RETURN json_build_object('success',false,'error','请输入 8 位数字码'); END IF;
  SELECT * INTO v_request FROM public.borrowing_requests WHERE pickup_code = p_code;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','未找到对应申请'); END IF;
  -- Lock order: reader -> book -> request/loan. Re-read after locks to handle retries.
  SELECT coalesce(max_borrow_limit,5) INTO v_limit FROM public.users WHERE id = v_request.user_id FOR UPDATE;
  SELECT * INTO v_book FROM public.books WHERE id = v_request.book_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','图书不存在'); END IF;
  SELECT * INTO v_request FROM public.borrowing_requests WHERE pickup_code = p_code FOR UPDATE;
  IF v_request.status <> 'pending' THEN RETURN json_build_object('success',false,'error','该申请已处理，请刷新记录'); END IF;
  IF v_request.expires_at <= now() THEN
    UPDATE public.borrowing_requests SET status = 'expired' WHERE id = v_request.id;
    RETURN json_build_object('success',false,'error','申请已过期，请用户重新申请');
  END IF;
  IF EXISTS (SELECT 1 FROM public.borrowing_records WHERE user_id = v_request.user_id AND book_id = v_request.book_id AND status IN ('borrowed','overdue')) THEN
    RETURN json_build_object('success',false,'error','用户已借阅此书');
  END IF;
  IF (SELECT count(*) FROM public.borrowing_records WHERE user_id = v_request.user_id AND status IN ('borrowed','overdue')) >= v_limit THEN
    RETURN json_build_object('success',false,'error','用户已达到借阅上限');
  END IF;
  IF coalesce(v_book.available_quantity,0) <= 0 OR coalesce(v_book.quantity,0) <=
      (SELECT count(*) FROM public.borrowing_records WHERE book_id = v_book.id AND status IN ('borrowed','overdue','lost')) THEN
    RETURN json_build_object('success',false,'error','库存不足，无法确认借出');
  END IF;
  v_due := now() + make_interval(days => v_request.requested_days);
  INSERT INTO public.borrowing_records(book_id,user_id,borrowed_at,due_date,status)
    VALUES(v_request.book_id,v_request.user_id,now(),v_due,'borrowed') RETURNING id INTO v_borrowing;
  UPDATE public.borrowing_requests SET status = 'approved',reviewed_at = now(),reviewed_by = auth.uid(),borrowing_id = v_borrowing
    WHERE id = v_request.id;
  -- Derive, rather than increment/decrement: compatible with existing inventory triggers.
  UPDATE public.books SET available_quantity = quantity -
    (SELECT count(*) FROM public.borrowing_records WHERE book_id = v_book.id AND status IN ('borrowed','overdue','lost'))
    WHERE id = v_book.id;
  RETURN json_build_object('success',true,'borrowing_id',v_borrowing,'due_date',v_due);
END; $$;

CREATE OR REPLACE FUNCTION public.close_borrow_request(p_request_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.borrowing_requests;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('success',false,'error','请先登录'); END IF;
  IF p_action IS NULL OR p_action NOT IN ('cancelled','rejected') THEN RETURN json_build_object('success',false,'error','无效操作'); END IF;
  SELECT * INTO v_request FROM public.borrowing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','申请不存在'); END IF;
  IF (p_action = 'cancelled' AND v_request.user_id IS DISTINCT FROM auth.uid())
      OR (p_action = 'rejected' AND NOT public.is_admin()) THEN
    RETURN json_build_object('success',false,'error','无权执行此操作');
  END IF;
  IF v_request.status <> 'pending' THEN RETURN json_build_object('success',false,'error','申请已处理，请刷新记录'); END IF;
  IF v_request.expires_at <= now() THEN
    UPDATE public.borrowing_requests SET status = 'expired' WHERE id = v_request.id;
    RETURN json_build_object('success',false,'error','申请已过期');
  END IF;
  IF p_action = 'rejected' AND (nullif(trim(p_note),'') IS NULL OR length(p_note) > 500) THEN
    RETURN json_build_object('success',false,'error','请填写拒绝原因（最多 500 字）');
  END IF;
  UPDATE public.borrowing_requests SET status = p_action,reviewed_at = now(),reviewed_by = auth.uid(),
    review_note = CASE WHEN p_action = 'rejected' THEN trim(p_note) ELSE NULL END WHERE id = v_request.id;
  RETURN json_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.return_book(p_borrowing_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_record public.borrowing_records;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN json_build_object('success',false,'error','请到馆归还，由管理员确认收书');
  END IF;
  SELECT * INTO v_record FROM public.borrowing_records WHERE id = p_borrowing_id;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','借阅记录不存在'); END IF;
  PERFORM 1 FROM public.users WHERE id = v_record.user_id FOR UPDATE;
  PERFORM 1 FROM public.books WHERE id = v_record.book_id FOR UPDATE;
  SELECT * INTO v_record FROM public.borrowing_records WHERE id = p_borrowing_id FOR UPDATE;
  IF v_record.status NOT IN ('borrowed','overdue') THEN RETURN json_build_object('success',false,'error','该记录已归还或不可归还'); END IF;
  UPDATE public.borrowing_records SET status = 'returned',returned_at = now() WHERE id = p_borrowing_id;
  UPDATE public.books SET available_quantity = quantity -
    (SELECT count(*) FROM public.borrowing_records WHERE book_id = v_record.book_id AND status IN ('borrowed','overdue','lost'))
    WHERE id = v_record.book_id;
  RETURN json_build_object('success',true);
END; $$;

-- Otherwise a reader could promote their own profile and approve their own request.
CREATE OR REPLACE FUNCTION public.protect_reader_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.id IS DISTINCT FROM auth.uid() OR NEW.role IS DISTINCT FROM 'user'
         OR NEW.max_borrow_limit IS DISTINCT FROM 5 THEN RAISE EXCEPTION '无权设置用户权限'; END IF;
    ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.max_borrow_limit IS DISTINCT FROM OLD.max_borrow_limit OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.member_since IS DISTINCT FROM OLD.member_since OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION '只能修改姓名、电话和地址';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_reader_privileges ON public.users;
CREATE TRIGGER protect_reader_privileges BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_reader_privileges();

-- Preserve history and reject inventory reductions below outstanding/lost copies.
CREATE OR REPLACE FUNCTION public.guard_book_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_occupied integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.borrowing_records WHERE book_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.borrowing_requests WHERE book_id = OLD.id) THEN
      RAISE EXCEPTION '图书已有借阅或申请记录，请保留图书以保存历史';
    END IF;
    RETURN OLD;
  END IF;
  SELECT count(*) INTO v_occupied FROM public.borrowing_records WHERE book_id = NEW.id AND status IN ('borrowed','overdue','lost');
  IF NEW.quantity IS NULL OR NEW.quantity < v_occupied OR NEW.quantity < 0 THEN
    RAISE EXCEPTION '库存数量不能小于已借出及遗失数量（%）',v_occupied;
  END IF;
  NEW.available_quantity := NEW.quantity - v_occupied;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS zz_guard_book_inventory ON public.books;
CREATE TRIGGER zz_guard_book_inventory BEFORE INSERT OR UPDATE OR DELETE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.guard_book_inventory();

-- Keep existing read access; replace permissive write policies with admin-only access.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'books' AND cmd IN ('ALL','INSERT','UPDATE','DELETE') LOOP
    EXECUTE format('DROP POLICY %I ON public.books', p.policyname);
  END LOOP;
END; $$;
DROP POLICY IF EXISTS "Library authenticated book read" ON public.books;
CREATE POLICY "Library authenticated book read" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Library admin book insert" ON public.books FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Library admin book update" ON public.books FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Library admin book delete" ON public.books FOR DELETE TO authenticated USING (public.is_admin());
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_book_borrow_counts()
RETURNS TABLE(book_id uuid, borrow_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT book_id,count(*) FROM public.borrowing_records GROUP BY book_id; $$;

REVOKE ALL ON FUNCTION public.request_borrow_book(uuid,integer), public.borrow_book(uuid,uuid,integer),
  public.approve_borrow_request(text), public.close_borrow_request(uuid,text,text), public.return_book(uuid),
  public.get_book_borrow_counts(), public.protect_reader_privileges(), public.guard_book_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_borrow_book(uuid,integer), public.borrow_book(uuid,uuid,integer),
  public.approve_borrow_request(text), public.close_borrow_request(uuid,text,text), public.return_book(uuid),
  public.get_book_borrow_counts() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
