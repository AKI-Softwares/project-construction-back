import { HttpError } from "../../shared/errors/http-error.js";
import type { MyCompanyRepository } from "./company.repository.js";
import type { UpdateMyCompanyInput } from "./company.schema.js";

export class MyCompanyService {
  constructor(private repo: MyCompanyRepository) {}

  async getMyCompany(companyId: number) {
    const company = await this.repo.findById(companyId);
    if (!company) throw new HttpError(404, "Company not found.");
    return company;
  }

  async updateMyCompany(companyId: number, input: UpdateMyCompanyInput) {
    const company = await this.repo.findById(companyId);
    if (!company) throw new HttpError(404, "Company not found.");
    if (!input.name) return company;
    return this.repo.updateName(companyId, input.name);
  }
}
