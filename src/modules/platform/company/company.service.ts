import bcrypt from 'bcrypt';
import { HttpError } from '../../../shared/errors/http-error.js';
import { UserRepository } from '../../user/user.repository.js';
import type { CompanyRepository } from './company.repository.js';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  UpdateCompanyStatusInput,
  ListCompaniesQuery,
  CreateCompanyUserInput,
} from './company.schema.js';

const SALT_ROUNDS = 12;

export class CompanyService {
  constructor(private repo: CompanyRepository) {}

  async list(query: ListCompaniesQuery) {
    return this.repo.findAll(query.status);
  }

  async getOne(id: number) {
    const company = await this.repo.findById(id);
    if (!company) throw new HttpError(404, 'Company not found.');
    return company;
  }

  async create(input: CreateCompanyInput) {
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) throw new HttpError(409, 'Company slug already taken.');

    const company = await this.repo.create(input);

    const { prisma } = await import('../../../shared/infra/database/prisma.js');

    const [templateRoles, templateServices, templateApartmentTypes] = await Promise.all([
      prisma.role.findMany({
        where: { companyId: null, isCompanyAdmin: false },
        select: {
          name: true,
          description: true,
          permissions: { select: { id: true } },
        },
      }),
      prisma.service.findMany({
        where: { companyId: null },
        select: { name: true, description: true, category: true },
      }),
      prisma.apartmentType.findMany({
        where: { companyId: null },
        select: { name: true, description: true },
      }),
    ]);

    await this.repo.seedCompanyOnActivation(
      company.id,
      templateRoles.map((r) => ({
        name: r.name,
        description: r.description,
        permissionIds: r.permissions.map((p) => p.id),
      })),
      templateServices,
      templateApartmentTypes,
    );

    return company;
  }

  async update(id: number, input: UpdateCompanyInput) {
    const company = await this.repo.findById(id);
    if (!company) throw new HttpError(404, 'Company not found.');
    if (input.slug && input.slug !== company.slug) {
      const existing = await this.repo.findBySlug(input.slug);
      if (existing) throw new HttpError(409, 'Company slug already taken.');
    }
    return this.repo.update(id, input);
  }

  async updateStatus(id: number, input: UpdateCompanyStatusInput) {
    const company = await this.repo.findById(id);
    if (!company) throw new HttpError(404, 'Company not found.');

    if (input.status === 'ACTIVE' && company.status === 'PENDING') {
      const { prisma } = await import('../../../shared/infra/database/prisma.js');

      const templateRoles = await prisma.role.findMany({
        where: { companyId: null, isCompanyAdmin: false },
        select: {
          name: true,
          description: true,
          permissions: { select: { id: true } },
        },
      });

      const templateServices = await prisma.service.findMany({
        where: { companyId: null },
        select: { name: true, description: true, category: true },
      });

      const templateApartmentTypes = await prisma.apartmentType.findMany({
        where: { companyId: null },
        select: { name: true, description: true },
      });

      await this.repo.seedCompanyOnActivation(
        id,
        templateRoles.map((r) => ({
          name: r.name,
          description: r.description,
          permissionIds: r.permissions.map((p) => p.id),
        })),
        templateServices,
        templateApartmentTypes,
      );
    }

    return this.repo.updateStatus(id, input.status);
  }

  async createUser(companyId: number, input: CreateCompanyUserInput) {
    const company = await this.repo.findById(companyId);
    if (!company) throw new HttpError(404, 'Company not found.');

    const userRepo = new UserRepository();
    const existing = await userRepo.findByEmail(input.email);
    if (existing) throw new HttpError(409, 'Email already registered.');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return userRepo.createWithCompany({ ...input, passwordHash, companyId });
  }
}
