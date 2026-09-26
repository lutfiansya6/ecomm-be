// ============================================================
// LUXE E-Commerce — TypeScript Type Definitions
// ============================================================

export interface User {
  id: string;
  email: string;
  password: string; // hashed (dummy bcrypt-like)
  name: string;
  role: 'admin' | 'customer';
  avatar?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  category: 'dress' | 'blazer' | 'bag' | 'shoes' | 'coat' | 'accessories';
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  weight?: number; // in grams, defaults to 500g
  featured: boolean;
  rating: number;
  reviewCount: number;
  tags: string[];
  createdAt: string;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  size: string;
  color: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}

export interface Address {
  fullName: string;
  phone: string;
  street: string;
  /** Kabupaten/Kota name (text, from wilayah API) */
  city: string;
  /** Province name (text, from wilayah API) */
  province: string;
  postalCode: string;
  country: string;
  /** Kecamatan name (text, from wilayah API) — optional for backward compat */
  district?: string;
  /** Kelurahan/Desa name (text, from wilayah API) — optional for backward compat */
  village?: string;
  label?: string;
}

export interface UserAddress extends Address {
  id: string;
  userId: string;
  label: string; // e.g., "Rumah", "Kantor", "Apartemen"
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  address: Address;
  courier?: string; // e.g. "JNE"
  courierService?: string; // e.g. "REG"
  courierEtd?: string; // e.g. "2-3 hari"
  paymentMethod: 'credit_card' | 'gopay' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingDestination {
  id: number;
  label: string;
  subdistrict_name?: string;
  district_name?: string;
  city_name?: string;
  province_name?: string;
  zip_code?: string;
}

export interface ShippingCostOption {
  name: string;
  code: string;
  service: string;
  description?: string;
  cost: number;
  etd: string;
}

export interface PaymentRequest {
  orderId: string;
  method: 'credit_card' | 'gopay' | 'cod';
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardName?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
  method: string;
  amount: number;
}

export interface AuthToken {
  userId: string;
  email: string;
  role: 'admin' | 'customer';
  name: string;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
