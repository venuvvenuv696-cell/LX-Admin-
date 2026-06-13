export type OrderStatus = 'pending' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
export type CustomOrderStatus = 'pending' | 'reviewing' | 'quoted' | 'in_production' | 'delivered' | 'cancelled';
export type ProductStatus = 'available' | 'sold_out';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url?: string;
  category: '3D Printing Parts' | 'VMC Machining Parts' | '3D Machine' | 'VMC Machine' | 'Filament Shop';
  status: ProductStatus;
  description?: string;
  created_at: string;
  delivery_charge?: number;
}

export interface Order {
  id: string;
  customer_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  product_id?: string; // Link to product
  product_variant: string;
  quantity: number;
  total_price: number;
  status: OrderStatus;
  created_at: string;
}

export interface CustomOrder {
  id: string;
  order_id?: string;
  full_name: string;
  email_reference: string;
  secure_line: string;
  project_name?: string;
  details?: string;
  file_url?: string;
  status: CustomOrderStatus;
  created_at: string;
}

export interface AppSettings {
  appName: string;
  systemStatus: 'live' | 'maintenance';
  theme: 'light' | 'dark';
  logoUrl?: string;
}
