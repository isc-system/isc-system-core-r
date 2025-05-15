import Rol from '../models/rol';
import RolePermissions from '../models/rolePermissionInterface';
import rolePermissionsRequest from '../models/rolePermissionRequestInterface';
import RolePermissionsResponse from '../models/rolePermissionResponseInterface';
import db from './pg-connection';

const rolesTable = 'roles';
const rolePermissionsTableMainMenu = 'role_permissions';
const actionsTable = 'role_permissions';
const permissionsTable = 'permissions';


interface ExtendedRolePermissions extends RolePermissions {
  permission_path?: string;
  menu_order?: number;
}


export const getRoles = async () => {
  try {
    const roles = await db
      .select(
        `${rolesTable}.*`,
        `${permissionsTable}.name as permission_name`,
        `${permissionsTable}.path as permission_path`,
        `${rolePermissionsTableMainMenu}.menu_order`
      )
      .from(rolesTable)
      .leftJoin(rolePermissionsTableMainMenu, `${rolesTable}.id`, `${rolePermissionsTableMainMenu}.role_id`)
      .leftJoin(permissionsTable, `${rolePermissionsTableMainMenu}.permission_id`, `${permissionsTable}.id`)
      .where(`${permissionsTable}.type`, 'page')
      .orderBy('created_at', 'asc');

    const actionRoles = await db
      .select(
        `${rolesTable}.*`,
        `${permissionsTable}.name as permission_name`
      )
      .from(rolesTable)
      .leftJoin(actionsTable, `${rolesTable}.id`, `${actionsTable}.role_id`)
      .leftJoin(permissionsTable, `${actionsTable}.permission_id`, `${permissionsTable}.id`)
      .where(`${permissionsTable}.type`, 'action')
      .orderBy('created_at', 'asc');

    const response: RolePermissionsResponse = {};

    roles.forEach((rol: ExtendedRolePermissions) => {
      if (!response[rol.name]) {
        response[rol.name] = {
          id: rol.id,
          disabled: rol.disabled,
          permissions: { page: [], actions: [] },
        };
      }
      if (rol.permission_name && rol.permission_path && rol.menu_order !== undefined) {
        response[rol.name].permissions.page.push({
          name: rol.permission_name,
          path: rol.permission_path,
          menu_order: rol.menu_order,
        });
      }
    });

    actionRoles.forEach((rol: RolePermissions) => {
      if (!response[rol.name]) {
        response[rol.name] = {
          id: rol.id,
          disabled: rol.disabled,
          permissions: { page: [], actions: [] },
        };
      }
      if (rol.permission_name) {
        response[rol.name].permissions.actions.push(rol.permission_name);
      }
    });

    return response;
  } catch (error) {
    console.error('Error fetching Role Permissions:', error);
    throw error;
  }
};

export const createRol = async (rolData: Rol) => {
  try {
    const [{ maxId }] = await db(rolesTable).max('id as maxId');
    const newId = (maxId || 0) + 1;

    const newRol = await db(rolesTable)
      .insert({ ...rolData, id: newId })
      .returning('*');
    return newRol;
  } catch (error) {
    console.error(error);
    throw error;
  }
};


export const editRol = async (rolData: Rol, id: number) => {

  try {
    const editedRol = await db(rolesTable).where('id', id).update(rolData).returning('*');
    return editedRol;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const disableRol = async (id: number) => {
  try {
    const editedRol = await db(rolesTable).where('id', id).update('disabled', true).returning('*');
    return editedRol;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const validatePermissionInput = async (ides: rolePermissionsRequest) => {
  const role = await db(rolesTable)
    .select('id', 'name', 'disabled')
    .where('id', ides.role_id)
    .first();
  if (!role) {
    throw new Error(`Role with id ${ides.role_id} not found`);
  }
  if (role.disabled) {
    throw new Error(`Role with id ${ides.role_id} is disabled`);
  }
  const permission = await db(permissionsTable)
    .select('type', 'name as permission_name', 'disabled')
    .where('id', ides.permission_id)
    .first();
  if (!permission) {
    throw new Error(`Permission with id ${ides.permission_id} not found`);
  }
  if (permission.disabled) {
    throw new Error(`Permission with id ${ides.permission_id} is disabled`);
  }
  if (permission.type === 'page' && ides.menu_order === undefined) {
    throw new Error('menu_order is required for page permissions');
  }
  return { type: permission.type, role, permission };
};


export const addPermission = async (ides: rolePermissionsRequest): Promise<RolePermissions> => {
  try {
    const { type, role, permission } = await validatePermissionInput(ides);
    const targetTable = type === 'page' ? rolePermissionsTableMainMenu : actionsTable;

    const insertData: rolePermissionsRequest = {
      role_id: ides.role_id,
      permission_id: ides.permission_id,
      ...(type === 'page' && { menu_order: ides.menu_order }),
    };

    await db.transaction(async (trx) => {
      await trx(targetTable)
      .where('role_id', ides.role_id)
      .where('permission_id', ides.permission_id)
      .delete();
      await trx(targetTable).insert(insertData);
    });

    return {
      id: role.id,
      name: role.name,
      disabled: role.disabled,
      permission_name: permission.permission_name,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const removePermission = async (ides: rolePermissionsRequest): Promise<RolePermissions | null> => {
  try {
    const { type, role, permission } = await validatePermissionInput(ides);
    const targetTable = type === 'page' ? rolePermissionsTableMainMenu : actionsTable;

    const deletedCount = await db(targetTable)
      .where('role_id', ides.role_id)
      .where('permission_id', ides.permission_id)
      .delete();

    if (deletedCount === 0) {
      return null;
    }

    return {
      id: role.id,
      name: role.name,
      disabled: role.disabled,
      permission_name: permission.permission_name,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getRolesProfessor = async () => {
  try {
    const rolesProfessor = await db(rolesTable).where('category', 'professor').returning('*');
    return rolesProfessor;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getRolesStudent = async () => {
  try {
    const rolesStudent = await db(rolesTable).where('category', 'student').returning('*');
    return rolesStudent;
  } catch (error) {
    console.error(error);
    throw error;
  }
};