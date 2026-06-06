import bcrypt from "bcrypt";
import { HttpError } from "../../shared/errors/http-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async getMe(userId: number) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new HttpError(404, "User not found.");
    return user;
  }

  async login(input: LoginInput) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new HttpError(401, "Invalid credentials.");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new HttpError(401, "Invalid credentials.");
    }

    const permissions = user.role.permissions.map((p) => p.action);

    return {
      sub: String(user.id),
      roleId: user.roleId,
      permissions,
    };
  }
}
