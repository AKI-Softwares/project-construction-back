import bcrypt from "bcrypt";
import { HttpError } from "../../shared/errors/http-error.js";
import type { UserRepository } from "./user.repository.js";
import type { CreateUserInput, UpdateUserInput } from "./user.schema.js";

const SALT_ROUNDS = 10;

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async listUsers() {
    return this.repo.findAll();
  }

  async getUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");
    return user;
  }

  async createUser(input: CreateUserInput) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new HttpError(409, "Email already registered.");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.repo.create({ ...input, passwordHash });
  }

  async updateUser(
    id: number,
    input: UpdateUserInput,
    requesterId: number,
    requesterPerms: string[],
  ) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");

    const isSelf = id === requesterId;
    const canUpdateAny = requesterPerms.includes("users:update");

    if (!isSelf && !canUpdateAny) {
      throw new HttpError(403, "Access denied.");
    }

    // Only callers with users:update may change roleId
    if (input.roleId !== undefined && !canUpdateAny) {
      throw new HttpError(403, "Only users with 'users:update' may change role.");
    }

    if (input.email && input.email !== user.email) {
      const emailTaken = await this.repo.findByEmail(input.email);
      if (emailTaken) throw new HttpError(409, "Email already in use.");
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, SALT_ROUNDS)
      : undefined;

    const updateData: UpdateUserInput & { passwordHash?: string } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.roleId !== undefined) updateData.roleId = input.roleId;
    if (passwordHash !== undefined) updateData.passwordHash = passwordHash;

    return this.repo.update(id, updateData);
  }

  async deleteUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");
    await this.repo.delete(id);
  }
}
