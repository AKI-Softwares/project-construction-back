import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Prisma } from '../../../generated/prisma/client.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { sendPasswordResetEmail } from '../../shared/email/email.service.js';
import type { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterCompanyInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from './auth.schema.js';

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
      mustChangePassword: user.mustChangePassword,
    };
  }

  async registerCompany(input: RegisterCompanyInput) {
    const existingSlug = await this.repo.findCompanyBySlug(input.company.slug);
    if (existingSlug) throw new HttpError(409, 'Company slug already taken.');

    const existingEmail = await this.repo.findUserByEmail(input.admin.email);
    if (existingEmail) throw new HttpError(409, 'Email already registered.');

    const passwordHash = await bcrypt.hash(input.admin.password, 12);
    try {
      return await this.repo.createCompanyWithAdmin({
        company: input.company,
        admin: { name: input.admin.name, email: input.admin.email, passwordHash },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new HttpError(409, 'Company slug or email already taken.');
      }
      throw err;
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.repo.upsertPasswordResetToken(user.id, tokenHash, expiresAt);
    await sendPasswordResetEmail(input.email, user.name, rawToken);
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const tokenRecord = await this.repo.findValidResetToken(tokenHash);
    if (!tokenRecord) throw new HttpError(400, 'Invalid or expired token.');

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.repo.resetUserPassword(tokenRecord.userId, passwordHash);
  }

  async changePassword(userId: number, input: ChangePasswordInput) {
    const user = await this.repo.findUserByIdWithPassword(userId);
    if (!user) throw new HttpError(404, 'User not found.');

    const match = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!match) throw new HttpError(401, 'Current password is incorrect.');

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.repo.updatePassword(userId, passwordHash);
  }
}
