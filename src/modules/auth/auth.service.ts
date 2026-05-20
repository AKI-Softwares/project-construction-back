import bcrypt from "bcrypt";
import { HttpError } from "../../shared/errors/http-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async login(input: LoginInput) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new HttpError(401, "Credenciais inválidas.");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new HttpError(401, "Credenciais inválidas.");
    }

    return {
      sub: String(user.id),
      role: user.role.name,
    };
  }
}
