/*
# RBAC Security Hardening

## Why this migration exists
The original schema (20260713064333_create_pm_schema.sql) enables RLS on every
table but nearly every policy is `USING (true)` — i.e. any authenticated user
can read/write/delete any row in `tasks`, `comments`, `attachments`, and
`activity_logs`, and can only update their *own* `profiles` row (which
silently breaks the admin "change user role" UI in TeamPage/SettingsPage).

Role-based restrictions currently exist ONLY in the React layer
(`src/lib/rbac.ts`). That is trivially bypassed by anyone calling the
Supabase REST/JS API directly with a valid session token — RLS is the actual
security boundary, and today it enforces almost nothing.

This migration makes server-side RLS match (and, in a few deliberately-noted
spots, tighten) the permission model already implied by `rbac.ts`, so that:
  - Nothing that currently works in the UI stops working.
  - Everything that the UI currently *prevents* via client-side checks is
    also prevented at the database level.

## Role hierarchy (mirrors src/lib/rbac.ts HIERARCHY)
  super_admin (5) > admin (4) > manager (3) > employee (2) > viewer (1)

## Permission mapping used (mirrors src/lib/rbac.ts `can()`)
  create_task / edit_task / delete_task / assign_task / move_task -> manager+
  manage_users                                                    -> admin+
  view_board / view_analytics / comment / upload                  -> any authenticated role
  import_data / export_data                                       -> manager+ (client-only concern, not RLS-relevant)

## Key structural fix: privilege escalation on `profiles.role`
Rather than trying to express "admins can update other users' roles, but
never their own, and never up to/above their own rank" purely in an RLS
`WITH CHECK` clause (which can't easily compare OLD vs NEW role together with
the *actor's* role in one expression), this migration uses a BEFORE UPDATE
trigger (`guard_profile_role_change`) for that specific business rule. RLS
still gates *whether* the row is reachable at all; the trigger gates the
role-change semantics precisely. This matches what the UI already assumes:
SettingsPage disables the role <select> for the admin's own row
(`disabled={p.id === profile.id}`), so blocking self role-changes at the DB
layer changes no observed behavior — it just stops it from being spoofable.
*/

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to safely read own role
-- without triggering RLS recursion on `profiles`)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_role() FROM public;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.role_rank(r text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE r
    WHEN 'super_admin' THEN 5
    WHEN 'admin' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'employee' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.role_rank(text) FROM public;
GRANT EXECUTE ON FUNCTION public.role_rank(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_min_role(min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.role_rank(public.current_role()) >= public.role_rank(min_role);
$$;

REVOKE ALL ON FUNCTION public.has_min_role(text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_min_role(text) TO authenticated;

-- ============================================================
-- PROFILES
-- ============================================================

-- SELECT stays open to all authenticated users: required for assignment
-- dropdowns (TaskModal, BoardPage), avatars, team page. No change.
-- (profiles_select_all already exists and is correct — left as-is.)

-- INSERT: tightened. Previously any authenticated user could insert their
-- own profile row with ANY role value (e.g. role: 'super_admin'), because
-- the check only verified auth.uid() = id. The signup flow
-- (src/lib/auth.tsx signUp()) always passes role: 'employee', but nothing
-- stopped a direct API call from setting something else. Now the DB also
-- enforces that self-inserts must be 'employee' — matches the only value
-- the app ever actually sends.
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'employee');

-- UPDATE: now allows admin+ to update ANY profile (fixes the broken
-- TeamPage/SettingsPage role-management UI), in addition to self-updates
-- for non-role fields (full_name, avatar_url). The role-change *rules*
-- themselves are enforced by the trigger below, not here.
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.has_min_role('admin'))
  WITH CHECK (auth.uid() = id OR public.has_min_role('admin'));

-- Trigger: precise privilege-escalation guard for role changes.
-- Rules (only evaluated when NEW.role IS DISTINCT FROM OLD.role):
--   1. Actor must be admin+ to change ANY role (mirrors manage_users).
--   2. Actor can never change their OWN role, even if they're an admin —
--      matches existing UI behavior (self row's role <select> is disabled).
--   3. Non-super_admin actors cannot assign a role >= their own rank
--      (an admin can't create another admin or a super_admin).
--   4. Non-super_admin actors cannot modify the role of a user whose
--      CURRENT role is >= their own rank (an admin can't demote another
--      admin or a super_admin).
CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text := public.current_role();
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF public.role_rank(actor_role) < public.role_rank('admin') THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;

    IF auth.uid() = NEW.id THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;

    IF actor_role <> 'super_admin' AND public.role_rank(NEW.role) >= public.role_rank(actor_role) THEN
      RAISE EXCEPTION 'Cannot assign a role equal to or higher than your own';
    END IF;

    IF actor_role <> 'super_admin' AND public.role_rank(OLD.role) >= public.role_rank(actor_role) THEN
      RAISE EXCEPTION 'Cannot modify the role of a user with equal or higher privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

-- ============================================================
-- TASKS
-- ============================================================

-- SELECT unchanged: view_board is granted to every role, board is
-- workspace-shared by design.

-- INSERT: tightened from "any authenticated" to manager+, matching
-- create_task. created_by already defaults to auth.uid() at the column
-- level, so this check is satisfied whether or not the client passes it
-- explicitly (BoardPage passes it; SearchPage's bulk import does not).
DROP POLICY IF EXISTS "tasks_insert_auth" ON tasks;
CREATE POLICY "tasks_insert_manager_plus" ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.has_min_role('manager') AND created_by = auth.uid());

-- UPDATE: tightened from "any authenticated" to manager+, matching
-- edit_task / move_task (KanbanBoard drag-and-drop already gates on
-- move_task client-side; this closes the direct-API bypass).
DROP POLICY IF EXISTS "tasks_update_auth" ON tasks;
CREATE POLICY "tasks_update_manager_plus" ON tasks FOR UPDATE
  TO authenticated
  USING (public.has_min_role('manager'))
  WITH CHECK (public.has_min_role('manager'));

-- DELETE: tightened from "any authenticated" to manager+, matching
-- delete_task.
DROP POLICY IF EXISTS "tasks_delete_auth" ON tasks;
CREATE POLICY "tasks_delete_manager_plus" ON tasks FOR DELETE
  TO authenticated
  USING (public.has_min_role('manager'));

-- ============================================================
-- COMMENTS
-- ============================================================

-- SELECT unchanged (shared workspace).
-- INSERT unchanged in effect (comment permission = every role), but now
-- also enforces user_id can't be spoofed as someone else.
DROP POLICY IF EXISTS "comments_insert_auth" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE own: unchanged, already correctly scoped.

-- ============================================================
-- ATTACHMENTS
-- ============================================================

-- SELECT unchanged (shared workspace).
-- INSERT unchanged in effect (upload permission = every role), but now
-- also enforces user_id can't be spoofed as someone else.
DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
CREATE POLICY "attachments_insert_own" ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE own: unchanged, already correctly scoped.

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- SELECT/UPDATE/DELETE own: unchanged, already correctly scoped.
-- INSERT: tightened. Previously ANY authenticated user could insert a
-- notification for ANY OTHER user (WITH CHECK true) — a notification-spam/
-- phishing vector. The only legitimate cross-user insert today is
-- assignTask() in src/lib/hooks.ts, which is only reachable from the UI
-- when the actor passes canAssign (assign_task -> manager+). This policy
-- makes that the actual, enforced rule instead of a client-side assumption.
DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_self_or_manager" ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_min_role('manager'));

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================

-- SELECT unchanged (shared workspace, needed for the Activity tab).
-- INSERT: tightened to prevent log forgery — user_id must be the actor's
-- own id. The column already defaults to auth.uid(), and every call site
-- in hooks.ts/TaskModal.tsx omits user_id and relies on that default, so
-- this changes no observed behavior.
DROP POLICY IF EXISTS "activity_logs_insert_auth" ON activity_logs;
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
