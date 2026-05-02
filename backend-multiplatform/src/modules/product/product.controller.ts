import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ProductService } from "./product.service";

const ProductIdParamsSchema = z.object({
  id: z.string().uuid()
});

const CreateProductBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  isActive: z.boolean().optional()
});

const UpdateProductBodySchema = CreateProductBodySchema.partial();

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.productService.listProducts();
    reply.send(data);
  };

  get = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = ProductIdParamsSchema.parse(request.params);
    const data = await this.productService.getProduct(params.id);
    reply.send(data);
  };

  create = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = CreateProductBodySchema.parse(request.body);
    const data = await this.productService.createProduct(payload);
    reply.status(201).send(data);
  };

  update = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = ProductIdParamsSchema.parse(request.params);
    const payload = UpdateProductBodySchema.parse(request.body);
    const data = await this.productService.updateProduct(params.id, payload);
    reply.send(data);
  };

  remove = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = ProductIdParamsSchema.parse(request.params);
    await this.productService.deleteProduct(params.id);
    reply.status(204).send();
  };
}
