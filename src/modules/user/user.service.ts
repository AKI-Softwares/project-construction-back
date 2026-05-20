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
    if (!user) throw new HttpError(404, "Usuário não encontrado.");
    return user;
  }

  async createUser(input: CreateUserInput) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new HttpError(409, "E-mail já cadastrado.");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.repo.create({ ...input, passwordHash });
  }

  async updateUser(id: number, input: UpdateUserInput, requesterId: number, requesterRole: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "Usuário não encontrado.");

    // Usuário só pode editar a si mesmo; ADMIN pode editar qualquer um
    const isSelf = id === requesterId;
    const isAdmin = requesterRole === "ADMIN";
    if (!isSelf && !isAdmin) {
      throw new HttpError(403, "Acesso negado.");
    }

    // Somente ADMIN pode alterar o role de outro usuário
    if (input.roleId && !isAdmin) {
      throw new HttpError(403, "Apenas ADMIN pode alterar o perfil de um usuário.");
    }

    if (input.email && input.email !== user.email) {
      const emailTaken = await this.repo.findByEmail(input.email);
      if (emailTaken) throw new HttpError(409, "E-mail já em uso.");
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
    if (!user) throw new HttpError(404, "Usuário não encontrado.");
    await this.repo.delete(id);
  }
}
