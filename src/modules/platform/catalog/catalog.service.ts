import { HttpError } from '../../../shared/errors/http-error.js';
import type { CatalogRepository } from './catalog.repository.js';
import type {
  CreateServiceInput, UpdateServiceInput,
  CreateApartmentTypeInput, UpdateApartmentTypeInput,
} from './catalog.schema.js';

export class CatalogService {
  constructor(private repo: CatalogRepository) {}

  listServices()                               { return this.repo.findAllServices(); }
  listApartmentTypes()                         { return this.repo.findAllApartmentTypes(); }
  createService(d: CreateServiceInput)         { return this.repo.createService(d); }
  createApartmentType(d: CreateApartmentTypeInput) { return this.repo.createApartmentType(d); }

  async getService(id: number) {
    const s = await this.repo.findServiceById(id);
    if (!s) throw new HttpError(404, 'Service template not found.');
    return s;
  }

  async updateService(id: number, d: UpdateServiceInput) {
    await this.getService(id);
    return this.repo.updateService(id, d);
  }

  async deleteService(id: number) {
    await this.getService(id);
    return this.repo.deleteService(id);
  }

  async getApartmentType(id: number) {
    const a = await this.repo.findApartmentTypeById(id);
    if (!a) throw new HttpError(404, 'ApartmentType template not found.');
    return a;
  }

  async updateApartmentType(id: number, d: UpdateApartmentTypeInput) {
    await this.getApartmentType(id);
    return this.repo.updateApartmentType(id, d);
  }

  async deleteApartmentType(id: number) {
    await this.getApartmentType(id);
    return this.repo.deleteApartmentType(id);
  }
}
