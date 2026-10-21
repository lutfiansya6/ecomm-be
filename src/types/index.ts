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

export interface ColorVariant {
  name: string;
  hex: string;
  images: string[];
  /** Harga jual khusus warna ini. Jika kosong, pakai Product.price */
  price?: number;
  /** Stok per ukuran untuk varian ini. Kunci adalah ukuran di daftar Product.sizes, nilai integer >= 0 */
  sizeStock: Record<string, number>;
  /** Stok khusus warna ini (nilai turunan: jumlah semua ukuran di sizeStock) */
  stock: number;
}


export interface Category {
  id: string;
  name: string;
  slug: string;
  order: number;
  active: boolean;
  label_en?: string;
  label_id?: string;
  createdAt: string;
  productCount?: number;
}

export type NavigationItemType = 'all' | 'new' | 'sale' | 'category' | 'url';

export interface NavigationChildCategory {
  id?: string;
  name: string;
  slug: string;
  label_en?: string;
  label_id?: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  slug: string;
  type: NavigationItemType;
  target: string;
  accent: boolean;
  order: number;
  active: boolean;
  system: boolean;
  productIds: string[];
  productCount?: number;
  gender?: 'women' | 'men' | 'unisex';
  childCategoryIds?: string[];
  children?: NavigationChildCategory[];
  label_en?: string;
  label_id?: string;
  createdAt: string;
}

export type ProductGender = 'women' | 'men' | 'unisex';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string; // full description
  shortDescription?: string; // 1-2 sentence summary
  price: number;
  comparePrice?: number;
  categoryId: string;
  category: string;
  gender: ProductGender;
  collection: boolean;
  images: string[];
  sizes: string[];
  colors: string[];
  colorVariants?: ColorVariant[];
  stock: number;
  weight?: number; // in grams, defaults to 500g
  featured: boolean;
  rating: number;
  reviewCount: number;
  tags: string[];
  createdAt: string;
}

export type ReviewStatus = 'published' | 'hidden';

export interface Review {
  id: string;
  productId: string;
  orderId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  status: ReviewStatus;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  size: string;
  color: string;
  /** Harga satuan saat checkout (harga varian warna, atau harga produk jika kosong) */
  price?: number;
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
