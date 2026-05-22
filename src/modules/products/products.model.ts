export interface Product {
  id: string;
  name: string;
  version: string;
  slug: string;
  description: string;
  features: string[];
  price: number;
  image_url?: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}
export interface UpdateProductDto {
  name?: string;
  version?: string;
  slug?: string;
  description?: string;
  features?: string[];
  price?: number;
  image_url?: string;
  is_visible?: boolean;
}

export interface CreateProductDto {
  name: string;
  version?: string;
  slug: string;
  description?: string;
  features?: string[];
  price: number;
  image_url?: string;
  is_visible?: boolean;
}
