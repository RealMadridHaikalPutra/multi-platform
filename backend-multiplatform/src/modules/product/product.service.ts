import { DomainError } from "../../shared/errors/domain-error";
import {
  ProductRepository,
  type CreateProductInput,
  type ProductRecord,
  type UpdateProductInput
} from "./product.repository";

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async listProducts(): Promise<ProductRecord[]> {
    return this.repository.findAll();
  }

  async getProduct(id: string): Promise<ProductRecord> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    return product;
  }

  async createProduct(input: CreateProductInput): Promise<ProductRecord> {
    const existing = await this.repository.findBySku(input.sku);
    if (existing) {
      throw new DomainError("SKU already exists", 409, "SKU_ALREADY_EXISTS", { sku: input.sku });
    }

    return this.repository.create(input);
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductRecord> {
    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
  }
}
