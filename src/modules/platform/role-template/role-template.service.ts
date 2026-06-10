import { HttpError } from '../../../shared/errors/http-error.js';
import type { RoleTemplateRepository } from './role-template.repository.js';
import type { CreateRoleTemplateInput, UpdateRoleTemplateInput } from './role-template.schema.js';

export class RoleTemplateService {
  constructor(private repo: RoleTemplateRepository) {}
  list()                                   { return this.repo.findAll(); }
  create(d: CreateRoleTemplateInput)       { return this.repo.create(d); }
  async get(id: number) {
    const t = await this.repo.findById(id);
    if (!t) throw new HttpError(404, 'Role template not found.');
    return t;
  }
  async update(id: number, d: UpdateRoleTemplateInput) { await this.get(id); return this.repo.update(id, d); }
  async delete(id: number)                              { await this.get(id); return this.repo.delete(id); }
}
