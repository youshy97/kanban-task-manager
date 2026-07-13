import type { Role } from './types';

const HIERARCHY: Record<Role, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  employee: 2,
  viewer: 1,
};

export function can(role: Role | undefined, action: string): boolean {
  if (!role) return false;
  switch (action) {
    case 'create_task':
    case 'edit_task':
    case 'delete_task':
    case 'assign_task':
    case 'move_task':
      return HIERARCHY[role] >= HIERARCHY.manager;
    case 'manage_users':
      return HIERARCHY[role] >= HIERARCHY.admin;
    case 'view_board':
    case 'view_analytics':
    case 'comment':
    case 'upload':
      return true;
    case 'import_data':
    case 'export_data':
      return HIERARCHY[role] >= HIERARCHY.manager;
    default:
      return false;
  }
}

export function canManageUsers(role: Role | undefined) {
  return can(role, 'manage_users');
}

export function canEditTasks(role: Role | undefined) {
  return can(role, 'edit_task');
}
