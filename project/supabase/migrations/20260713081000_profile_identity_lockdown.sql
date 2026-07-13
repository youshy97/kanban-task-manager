/*
# Profile Identity Lockdown

## Why this migration exists
20260713080000_rbac_security_hardening.sql closed the role-escalation path
on `profiles` but left two adjacent fields under-constrained:

  1. `email` — self INSERT/UPDATE only checked `auth.uid() = id`, not that
     the email actually matches the caller's authenticated identity
     (auth.jwt() ->> 'email'). A user could write an arbitrary email string
     into their own profile row, which is then displayed elsewhere in the
     app (assignment notices, notification text, TeamPage) as if it were
     their real address.
  2. `id` — nothing explicitly prevented `NEW.id <> OLD.id` on UPDATE,
     which would let a row's primary key change and drag its foreign-key
     references (tasks.assigned_to, comments.user_id, etc.) along with it.

It also narrows the admin-on-other-row UPDATE grant added in the previous
migration: an admin should only ever be changing `role` on someone else's
row (that's the only field TeamPage/SettingsPage ever send), so the trigger
now rejects any other field changing when the actor isn't updating their
own row — closing a payload-smuggling path even though the current UI never
attempts it.

This REPLACES the body of guard_profile_role_change() from the previous
migration (same function name, so the existing trigger binding is reused
automatically — no need to touch the trigger itself).
*/

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text := public.current_role();
  acting_on_self boolean := (auth.uid() = OLD.id);
BEGIN
  -- Primary key is immutable under all circumstances.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id cannot be changed';
  END IF;

  IF acting_on_self THEN
    -- Self-updates: email is immutable through this table. A verified
    -- email change belongs in Supabase Auth's own email-change flow
    -- (auth.users), which should be the source of truth and synced down
    -- via a separate trigger if/when that flow is wired up — not
    -- writable directly here.
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Email cannot be changed here';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
  ELSE
    -- Acting on someone else's row at all requires admin+.
    IF public.role_rank(actor_role) < public.role_rank('admin') THEN
      RAISE EXCEPTION 'Only admins can modify other users'' profiles';
    END IF;

    -- Even as admin, only `role` may change on someone else's row —
    -- matches the only payload TeamPage/SettingsPage ever send.
    IF NEW.email IS DISTINCT FROM OLD.email
       OR NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
      RAISE EXCEPTION 'Admins may only change a user''s role, not their profile details';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF actor_role <> 'super_admin' AND public.role_rank(NEW.role) >= public.role_rank(actor_role) THEN
        RAISE EXCEPTION 'Cannot assign a role equal to or higher than your own';
      END IF;
      IF actor_role <> 'super_admin' AND public.role_rank(OLD.role) >= public.role_rank(actor_role) THEN
        RAISE EXCEPTION 'Cannot modify the role of a user with equal or higher privileges';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- INSERT: self-registration must also match the caller's real JWT email,
-- not an arbitrary string. Uses auth.jwt() directly (rather than the
-- auth.email() convenience wrapper) for broad compatibility across
-- Supabase project versions.
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role = 'employee'
    AND email = (auth.jwt() ->> 'email')
  );

-- Belt-and-suspenders: explicitly deny the helper functions to the
-- unauthenticated `anon` role (harmless today since current_role() returns
-- NULL for anon and role_rank(NULL) = 0, but explicit is better than
-- implicit for a least-privilege audit trail).
REVOKE ALL ON FUNCTION public.current_role() FROM anon;
REVOKE ALL ON FUNCTION public.role_rank(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_min_role(text) FROM anon;

/*
## Verification note (cannot be checked from this migration file alone)
current_role() / has_min_role() are SECURITY DEFINER and rely on being
OWNED by a role that itself bypasses RLS on `profiles` (the default when
these functions are created via the Supabase CLI/SQL editor, which runs as
the `postgres`/migration-owner role). If your deployment pipeline ever
creates these functions under a different, RLS-restricted role, they will
fail with "infinite recursion detected in policy for relation profiles"
instead of working. Confirm `SELECT proowner::regrole FROM pg_proc WHERE
proname = 'current_role';` resolves to your migration-running role before
relying on this in production.
*/
