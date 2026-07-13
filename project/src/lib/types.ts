export type Role = 'super_admin' | 'admin' | 'manager' | 'employee' | 'viewer';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  completion: number;
  tags: string[];
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  checklist: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'task_assigned' | 'task_updated' | 'comment_added' | 'system';
  title: string;
  message: string;
  read: boolean;
  related_task_id: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  detail: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface TaskWithRelations extends Task {
  assignee?: Profile | null;
  creator?: Profile | null;
}
