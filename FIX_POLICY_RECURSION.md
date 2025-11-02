# Fix: Infinite Recursion in Supabase RLS Policies

## Problem

When trying to access the users table with an admin user, you're encountering this error:

```
infinite recursion detected in policy for relation "users"
```

### Root Cause

The RLS (Row Level Security) policy for the `users` table has a **circular dependency**:

```sql
-- ❌ PROBLEMATIC POLICY
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users  -- This queries users while reading users!
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

When trying to read from `users`, the policy checks if you're an admin by reading from `users`, which triggers the policy again, creating infinite recursion.

The same issue exists in:
- `borrowing_records` policies
- Any other table that checks user role from the `users` table

## Solution

Use a **SECURITY DEFINER function** to bypass RLS when checking admin status:

```sql
-- ✅ SOLUTION: Security definer function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ FIXED POLICY
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (is_admin());  -- Uses the security definer function
```

The `SECURITY DEFINER` function runs with the privileges of the function creator (bypassing RLS), so it can safely query the `users` table without triggering the policy recursion.

## How to Apply the Fix

### Step 1: Run the SQL Migration

Go to your Supabase Dashboard and run the `fix_policy_recursion.sql` script:

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `fix_policy_recursion.sql`
4. Click **Run**

### Step 2: Verify the Fix

After running the script, verify that the admin user can now access the users table:

```sql
-- Test query (run in SQL Editor)
SELECT * FROM users WHERE email = 'liu282207134@yahoo.co.jp';
```

### Step 3: Test in the Application

1. Sign in with your admin account: `liu282207134@yahoo.co.jp`
2. You should now see the admin interface
3. The errors in the console should be gone

## What the Migration Does

1. **Creates `is_admin()` function**: A security definer function that safely checks if a user is admin
2. **Fixes users table policies**: Updates all admin policies to use `is_admin()`
3. **Fixes borrowing_records policies**: Updates admin policies for borrowing records
4. **Adds admin policies**: Ensures admins can manage all tables (favorites, reviews, books)
5. **Adds auto-registration trigger**: Automatically creates user profile when a new user signs up

## Additional Benefits

The migration also adds:

- **Automatic user profile creation**: When a user signs up through Supabase Auth, a profile is automatically created in the `users` table
- **Complete admin access**: Admins can now manage all aspects of the system
- **No more manual user creation**: The trigger handles it automatically

## Testing the Admin Interface

After applying the fix, as an admin you should be able to:

1. ✅ View all users
2. ✅ Manage all books
3. ✅ View all borrowing records
4. ✅ Access admin dashboard
5. ✅ No more "infinite recursion" errors

## Why This Happened

The original migration (`USER_TABLES_MIGRATION.sql`) created policies that directly queried the `users` table within the table's own policies. This is a common mistake in Supabase RLS policies.

The correct approach is:
- Use `SECURITY DEFINER` functions for role checks
- These functions bypass RLS when running
- Policies then call these functions safely

## Related Files

- `fix_policy_recursion.sql` - The migration to fix the issue
- `USER_TABLES_MIGRATION.sql` - Original migration (for reference)
- `src/contexts/AuthContext.tsx` - Frontend auth context (no changes needed)
