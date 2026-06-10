import bcrypt from 'bcrypt';
import { HttpError } from '../../shared/errors/http-error.js';
import type { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterCompanyInput } from './auth.schema.js';

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async getMe(userId: number) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new HttpError(404, 'User not found.');
    return user;
  }

  async login(input: LoginInput) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) throw new HttpError(401, 'Invalid credentials.');

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) throw new HttpError(401, 'Invalid credentials.');

    if (user.company && user.company.status !== 'ACTIVE') {
      throw new HttpError(403, 'Company account is inactive or pending approval.');
    }

    const permissions = user.role?.permissions.map((p) => p.action) ?? [];

    return {
      sub: String(user.id),
      companyId: user.companyId ?? null,
      isPlatformAdmin: user.isPlatformAdmin,
      isCompanyAdmin: user.role?.isCompanyAdmin ?? false,
      roleId: user.roleId ?? null,
      permissions,
    };
  }

  async registerCompany(input: RegisterCompanyInput) {
    const existingSlug = await this.repo.findCompanyBySlug(input.company.slug);
    if (existingSlug) throw new HttpError(409, 'Company slug already taken.');

    const existingEmail = await this.repo.findUserByEmail(input.admin.email);
    if (existingEmail) throw new HttpError(409, 'Email already registered.');

    const passwordHash = await bcrypt.hash(input.admin.password, 12);
    return this.repo.createCompanyWithAdmin({
      company: input.company,
      admin: { name: input.admin.name, email: input.admin.email, passwordHash },
    });
  }
}
