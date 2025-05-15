import * as UserService from '../services/userService';
import { getUserByCode, getUserByEmail } from '../repositories/userRepository';
import Intern from 'src/models/internInterface';
import dayjs from 'dayjs';
import { getRoles } from './rolesInteractor';
import { createInternRepo } from '../repositories/internsRepository';

export const createInternInteractor = async (intern: Intern) => {
  try {
    const existingUser = await getUserByEmail(intern.email);
    if (existingUser) {
      throw new Error('Estudiante con este email ya existe.');
    }

    const existingUserWithCode = await getUserByCode(Number(intern.code));
    if (existingUserWithCode) {
      throw new Error('Estudiante con este código ya existe.');
    }
    const role = await getRoles(intern.roles?.[0] ?? 'intern');
    const user = {
      username: intern.username,
      name: intern.name,
      lastname: intern.lastname,
      mothername: intern.mothername,
      password: intern.password,
      email: intern.email,
      code: intern.code,
      phone: intern.phone,
      role_id: intern.id,
    };
    const userRes = await UserService.createUser(user);
    const internInfo = {
      user_profile_id: userRes.id,
      total_hours: intern.total_hours,
      pending_hours: intern.pending_hours,
      completed_hours: intern.completed_hours,
      created_at: dayjs(),
      updated_at: dayjs(),
    };
    const internResponse = await createInternRepo(internInfo as Intern);
    return internResponse;
  } catch (error) {
    console.error('Error in createIntern interactor:', error);
    throw new Error((error as Error).message);
  }
};
