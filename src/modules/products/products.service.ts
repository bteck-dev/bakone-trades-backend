import { supabase } from "../../config/supabase";
import { CreateProductDto, Product, UpdateProductDto } from "./products.model";

export class ProductsService {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,version,slug,description,features,price,image_url,is_visible")
      .eq("is_visible", true);
    if (error) throw new Error(error.message);
    return data as Product[];
  }
  async getAllAdmin(): Promise<Product[]> {
    const { data, error } = await supabase.from("products").select("*").order("created_at");
    if (error) throw new Error(error.message);
    return data as Product[];
  }
  async getBySlug(slug: string): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,version,slug,description,features,price,image_url")
      .eq("slug", slug).eq("is_visible", true).single();
    if (error || !data) throw new Error("Product not found");
    return data as Product;
  }
  async getById(id: string): Promise<Product> {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error || !data) throw new Error("Product not found");
    return data as Product;
  }
  async create(dto: CreateProductDto): Promise<Product> {
    const product = {
      ...dto,
      features: dto.features || [],
      is_visible: dto.is_visible ?? true,
    };
    const { data, error } = await supabase.from("products").insert(product).select().single();
    if (error) throw new Error(error.message);
    return data as Product;
  }
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const { data, error } = await supabase
      .from("products").update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as Product;
  }
  async remove(id: string): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Product;
  }
}
export const productsService = new ProductsService();
