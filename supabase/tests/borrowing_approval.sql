-- Run only after the approval migration. All test rows and changes roll back.
BEGIN;
CREATE TEMP TABLE _library_original_books AS SELECT * FROM public.books;
CREATE TEMP TABLE _library_original_loans AS SELECT * FROM public.borrowing_records;
CREATE TEMP TABLE _library_original_users AS SELECT * FROM public.users;
CREATE TEMP TABLE _library_test_ids(reader_id uuid,other_id uuid,admin_id uuid,book_id uuid,code text,loan_id uuid);
DO $$ DECLARE r uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (r,r::text||'@example.invalid','{"name":"Approval test reader"}'),
    (o,o::text||'@example.invalid','{"name":"Approval test other"}'),
    (a,a::text||'@example.invalid','{"name":"Approval test administrator"}');
  UPDATE public.users SET role='admin' WHERE id=a;
  INSERT INTO public.books(id,title,author,quantity,available_quantity,cover_image_url)
    VALUES(b,'Transaction-only approval test','Regression test',1,1,'original-test-cover.png');
  INSERT INTO _library_test_ids VALUES(r,o,a,b,NULL,NULL);
END; $$;
GRANT SELECT,UPDATE ON _library_test_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ DECLARE ids record; result json; code text; loan uuid; BEGIN
  SELECT * INTO ids FROM _library_test_ids;
  PERFORM set_config('request.jwt.claim.sub',ids.reader_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  result:=public.borrow_book(ids.book_id,ids.other_id,30);
  IF (result->>'success')::boolean THEN RAISE EXCEPTION 'Impersonation was allowed'; END IF;
  result:=public.request_borrow_book(ids.book_id,30);
  IF result->>'status' <> 'pending' OR NOT (result->>'success')::boolean THEN RAISE EXCEPTION 'Request failed: %',result; END IF;
  code:=result->>'pickup_code';
  IF code !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF (SELECT available_quantity FROM public.books WHERE id=ids.book_id) <> 1 THEN RAISE EXCEPTION 'Pending request consumed stock'; END IF;
  IF EXISTS(SELECT 1 FROM public.borrowing_records WHERE book_id=ids.book_id) THEN RAISE EXCEPTION 'Request created a loan'; END IF;
  IF (public.approve_borrow_request(code)->>'success')::boolean THEN RAISE EXCEPTION 'Reader could approve'; END IF;
  IF (public.request_borrow_book(ids.book_id,30)->>'success')::boolean THEN RAISE EXCEPTION 'Duplicate request allowed'; END IF;
  BEGIN
    INSERT INTO public.borrowing_records(book_id,user_id,due_date) VALUES(ids.book_id,ids.reader_id,now());
    RAISE EXCEPTION 'Direct loan insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.users SET role='admin' WHERE id=ids.reader_id;
  EXCEPTION WHEN raise_exception THEN NULL; END;
  IF (SELECT role FROM public.users WHERE id=ids.reader_id) <> 'user' THEN RAISE EXCEPTION 'Reader promoted themselves'; END IF;
  PERFORM set_config('request.jwt.claim.sub',ids.other_id::text,true);
  IF EXISTS(SELECT 1 FROM public.borrowing_requests WHERE pickup_code=code) THEN RAISE EXCEPTION 'Private request was disclosed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',ids.admin_id::text,true);
  result:=public.approve_borrow_request(code);
  IF NOT (result->>'success')::boolean THEN RAISE EXCEPTION 'Approval failed: %',result; END IF;
  loan:=(result->>'borrowing_id')::uuid;
  IF (SELECT available_quantity FROM public.books WHERE id=ids.book_id) <> 0 THEN RAISE EXCEPTION 'Checkout stock incorrect'; END IF;
  IF (SELECT due_date-borrowed_at FROM public.borrowing_records WHERE id=loan) <> interval '30 days' THEN RAISE EXCEPTION 'Loan clock incorrect'; END IF;
  IF (public.approve_borrow_request(code)->>'success')::boolean THEN RAISE EXCEPTION 'Double checkout allowed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',ids.reader_id::text,true);
  IF (public.return_book(loan)->>'success')::boolean THEN RAISE EXCEPTION 'Reader could self check-in'; END IF;
  PERFORM set_config('request.jwt.claim.sub',ids.admin_id::text,true);
  result:=public.return_book(loan);
  IF NOT (result->>'success')::boolean THEN RAISE EXCEPTION 'Return failed: %',result; END IF;
  IF (public.return_book(loan)->>'success')::boolean THEN RAISE EXCEPTION 'Double return allowed'; END IF;
  IF (SELECT available_quantity FROM public.books WHERE id=ids.book_id) <> 1 THEN RAISE EXCEPTION 'Return stock incorrect'; END IF;
  UPDATE _library_test_ids SET loan_id=loan;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
  IF EXISTS(SELECT * FROM _library_original_books EXCEPT SELECT * FROM public.books)
    OR EXISTS(SELECT * FROM _library_original_loans EXCEPT SELECT * FROM public.borrowing_records)
    OR EXISTS(SELECT * FROM _library_original_users EXCEPT SELECT * FROM public.users) THEN
    RAISE EXCEPTION 'Existing data was changed';
  END IF;
END; $$;
SELECT 'PASS: request, approval, return, duplicate prevention, privacy and permissions; original books/covers/loans/users unchanged' AS result;
ROLLBACK;
