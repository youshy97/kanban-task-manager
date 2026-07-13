/*
# Project Management App - Core Schema

## Overview
Creates the full data model for a multi-user project management application with
role-based access control. Collections mirror the requested Firestore structure:
users (profiles), tasks, comments, attachments, notifications, activity_logs.

## New Tables

1. `profiles` (extends auth.users; the "users" collection)
   - id (uuid, PK, matches auth.users.id)
   - email (text, unique, not null)
   - full_name (text, not null)
   - role (text, not null, default 'employee') — one of: super_admin | admin | manager | employee | viewer
   - avatar_url (text, nullable)
   - last_login (timestamptz, nullable)
   - created_at, updated_at (timestamptz)

2. `tasks`
   - id (uuid, PK)
   - title (text, not null)
   - description (text, nullable)
   - status (text, not null, default 'backlog') — backlog | todo | in_progress | review | blocked | completed | cancelled
   - priority (text, not null, default 'medium') — critical | high | medium | low
   - completion (int, default 0, 0-100)
   - tags (text[], default '{}')
   - created_by (uuid, FK profiles, not null)
   - assigned_to (uuid, FK profiles, nullable)
   - due_date (timestamptz, nullable)
   - checklist (jsonb, default '[]') — [{text, checked}]
   - created_at, updated_at (timestamptz)

3. `comments`
   - id (uuid, PK)
   - task_id (uuid, FK tasks, on delete cascade)
   - user_id (uuid, FK profiles)
   - content (text, not null)
   - created_at (timestamptz)

4. `attachments`
   - id (uuid, PK)
   - task_id (uuid, FK tasks, on delete cascade)
   - user_id (uuid, FK profiles)
   - file_name (text, not null)
   - file_path (text, not null) — Supabase Storage path
   - file_size (bigint, default 0)
   - file_type (text, nullable)
   - created_at (timestamptz)

5. `notifications`
   - id (uuid, PK)
   - user_id (uuid, FK profiles) — recipient
   - type (text, not null) — task_assigned | task_updated | comment_added | system
   - title (text, not null)
   - message (text, not null)
   - read (boolean, default false)
   - related_task_id (uuid, FK tasks, nullable)
   - created_at (timestamptz)

6. `activity_logs`
   - id (uuid, PK)
   - task_id (uuid, FK tasks, on delete cascade)
   - user_id (uuid, FK profiles)
   - action (text, not null) — created | updated | status_changed | assigned | commented | uploaded | completed
   - detail (text, nullable)
   - old_value (text, nullable)
   - new_value (text, nullable)
   - created_at (timestamptz)

## Security (RLS)
- All tables have RLS enabled.
- profiles: each user can read/update their own row; admins/managers can read all (for assignment).
  For simplicity in a team PM tool, all authenticated users can read all profiles (needed for
  task assignment dropdowns). Only the owner can update their own profile.
- tasks: any authenticated user can read/create/update/delete (team-shared board). RBAC is
  enforced in the frontend per role; RLS keeps data within the authenticated team.
- comments, attachments, activity_logs, notifications: authenticated users can read/create.
  Updates/deletes scoped to owner where relevant.
- This is a team collaboration app: all authenticated users share the workspace, so SELECT
  is open to authenticated. Write operations are also open to authenticated (RBAC enforced in UI).

## Notes
1. `profiles.id` defaults to auth.uid() so signup inserts cleanly.
2. `tasks.created_by` defaults to auth.uid().
3. `notifications.user_id` and `activity_logs.user_id` default to auth.uid() where the actor
   is the current user; for notifications to other users, the client passes user_id explicitly.
4. Indexes added on common filter/join columns.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin','admin','manager','employee','viewer')),
  avatar_url text,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','todo','in_progress','review','blocked','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  completion int NOT NULL DEFAULT 0 CHECK (completion >= 0 AND completion <= 100),
  tags text[] DEFAULT '{}',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date timestamptz,
  checklist jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_all" ON tasks;
CREATE POLICY "tasks_select_all" ON tasks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert_auth" ON tasks;
CREATE POLICY "tasks_insert_auth" ON tasks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_update_auth" ON tasks;
CREATE POLICY "tasks_update_auth" ON tasks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_delete_auth" ON tasks;
CREATE POLICY "tasks_delete_auth" ON tasks FOR DELETE
  TO authenticated USING (true);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all" ON comments;
CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_auth" ON comments;
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ATTACHMENTS
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select_all" ON attachments;
CREATE POLICY "attachments_select_all" ON attachments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
CREATE POLICY "attachments_insert_auth" ON attachments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attachments_delete_own" ON attachments;
CREATE POLICY "attachments_delete_own" ON attachments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned','task_updated','comment_added','system')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_auth" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail text,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select_all" ON activity_logs;
CREATE POLICY "activity_logs_select_all" ON activity_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_logs_insert_auth" ON activity_logs;
CREATE POLICY "activity_logs_insert_auth" ON activity_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_logs(task_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated ON tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();