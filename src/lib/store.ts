// ============================================================
// LUXE — Data store with JSON file persistence
// ============================================================
import type { User, Product, ColorVariant, Order, Cart, UserAddress, Review, Category, NavigationItem } from '@/types';
import fs from 'fs';
import path from 'path';

// Import seed data
import usersData from '@/data/users.json';
import productsData from '@/data/products.json';
import ordersData from '@/data/orders.json';
import addressesData from '@/data/addresses.json';
import reviewsData from '@/data/reviews.json';
import categoriesData from '@/data/categories.json';
import navigationData from '@/data/navigation.json';

import { guessColorHex, findColorVariant } from './utils';

export interface StockLine {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export type StockDeductionResult = { ok: true } | { ok: false; error: string };

// Helper to resolve the correct JSON file path
function getDataFilePath(filename: string): string {
  const directPath = path.join(process.cwd(), 'src', 'data', filename);
  if (fs.existsSync(directPath)) return directPath;
  const bePath = path.join(process.cwd(), 'be', 'src', 'data', filename);
  if (fs.existsSync(bePath)) return bePath;
  return directPath;
}

// Helper to load data from file with fallback
function loadDataFromFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = getDataFilePath(filename);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T;
      }
    }
  } catch (err) {
    console.error(`Failed to load ${filename} from disk, using fallback:`, err);
  }
  return fallback;
}

// Helper to persist data to file
function saveDataToFile<T>(filename: string, data: T) {
  try {
    const filePath = getDataFilePath(filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Failed to save ${filename} to disk:`, err);
  }
}

function ensureProductColorVariants(items: Product[]): Product[] {
  return items.map((p) => {
    const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['One Size'];
    let variants = p.colorVariants;

    if (!variants || variants.length === 0) {
      const colors = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : ['Default'];
      const images = Array.isArray(p.images) ? p.images : [];
      const nColors = colors.length || 1;
      const baseColor = Math.floor((p.stock || 0) / nColors);
      const remColor = (p.stock || 0) % nColors;

      variants = colors.map((c, i) => {
        const colorStock = baseColor + (i === 0 ? remColor : 0);
        const nSizes = sizes.length || 1;
        const baseSize = Math.floor(colorStock / nSizes);
        const remSize = colorStock % nSizes;
        const sizeStock: Record<string, number> = {};
        sizes.forEach((sz, sIdx) => {
          sizeStock[sz] = baseSize + (sIdx === 0 ? remSize : 0);
        });
        return {
          name: c,
          hex: guessColorHex(c),
          images: [...images],
          sizeStock,
          stock: colorStock,
        };
      });
    } else {
      variants = variants.map((v) => {
        let sizeStock = v.sizeStock;
        if (!sizeStock || typeof sizeStock !== 'object' || Object.keys(sizeStock).length === 0) {
          const vStock = typeof v.stock === 'number' && v.stock >= 0 ? v.stock : 0;
          const nSizes = sizes.length || 1;
          const baseSize = Math.floor(vStock / nSizes);
          const remSize = vStock % nSizes;
          sizeStock = {};
          sizes.forEach((sz, sIdx) => {
            sizeStock[sz] = baseSize + (sIdx === 0 ? remSize : 0);
          });
        } else {
          const newSizeStock: Record<string, number> = {};
          for (const sz of sizes) {
            newSizeStock[sz] = typeof sizeStock[sz] === 'number' && sizeStock[sz] >= 0 ? sizeStock[sz] : 0;
          }
          sizeStock = newSizeStock;
        }
        const derivedVariantStock = Object.values(sizeStock).reduce((sum, n) => sum + n, 0);
        return {
          ...v,
          sizeStock,
          stock: derivedVariantStock,
        };
      });
    }

    const derivedProductStock = variants.reduce((sum, v) => sum + v.stock, 0);
    return {
      ...p,
      categoryId: p.categoryId || (p.category ? `cat_${p.category}` : ''),
      sizes,
      colorVariants: variants,
      stock: derivedProductStock,
    };
  });
}


// Stores initialized from disk (falling back to imported JSON)
let users: User[] = loadDataFromFile<User[]>('users.json', usersData as User[]);
let categories: Category[] = loadDataFromFile<Category[]>('categories.json', categoriesData as Category[]);
let navigation: NavigationItem[] = loadDataFromFile<NavigationItem[]>('navigation.json', navigationData as NavigationItem[]);
let products: Product[] = ensureProductColorVariants(
  loadDataFromFile<Product[]>('products.json', productsData as Product[])
);
let orders: Order[] = loadDataFromFile<Order[]>('orders.json', ordersData as Order[]);
let addresses: UserAddress[] = loadDataFromFile<UserAddress[]>('addresses.json', addressesData as UserAddress[]);
const reviews: Review[] = reviewsData as Review[];
const carts: Cart[] = [];

// ——— Users ——————————————————————————————————————————————————
export const db = {
  users: {
    findAll: () => {
      try {
        const filePath = getDataFilePath('users.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            users = parsed;
          }
        }
      } catch {
        // Fall back to in-memory users
      }
      return users;
    },
    findById: (id: string) => db.users.findAll().find((u) => u.id === id) || null,
    findByEmail: (email: string) =>
      db.users.findAll().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null,
    create: (user: User) => {
      db.users.findAll();
      users.push(user);
      saveDataToFile('users.json', users);
      return user;
    },
    update: (id: string, data: Partial<User>) => {
      db.users.findAll();
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...data };
      saveDataToFile('users.json', users);
      return users[idx];
    },
  },

  // ——— Categories —————————————————————————————————————————————
  categories: {
    findAll: (filters?: { activeOnly?: boolean }) => {
      try {
        const filePath = getDataFilePath('categories.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            categories = parsed;
          }
        }
      } catch {
        // Fall back to in-memory categories
      }
      let result = [...categories];
      if (filters?.activeOnly) {
        result = result.filter((c) => c.active);
      }
      result.sort((a, b) => a.order - b.order);
      return result;
    },
    findById: (id: string) => db.categories.findAll().find((c) => c.id === id) || null,
    findBySlug: (slug: string) =>
      db.categories.findAll().find((c) => c.slug.toLowerCase() === slug.toLowerCase()) || null,
    findByName: (name: string) =>
      db.categories.findAll().find((c) => c.name.toLowerCase() === name.toLowerCase()) || null,
    create: (category: Category) => {
      db.categories.findAll();
      categories.push(category);
      saveDataToFile('categories.json', categories);
      return category;
    },
    update: (id: string, data: Partial<Category>) => {
      db.categories.findAll();
      const idx = categories.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      categories[idx] = { ...categories[idx], ...data };
      saveDataToFile('categories.json', categories);
      return categories[idx];
    },
    delete: (id: string) => {
      db.categories.findAll();
      const idx = categories.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      categories.splice(idx, 1);
      saveDataToFile('categories.json', categories);
      return true;
    },
    reorder: (ids: string[]) => {
      db.categories.findAll();
      const idOrderMap = new Map<string, number>();
      ids.forEach((id, index) => {
        idOrderMap.set(id, index + 1);
      });
      categories.forEach((cat) => {
        if (idOrderMap.has(cat.id)) {
          cat.order = idOrderMap.get(cat.id)!;
        }
      });
      categories.sort((a, b) => a.order - b.order);
      saveDataToFile('categories.json', categories);
      return categories;
    },
    countProducts: (categoryIdOrSlug: string) => {
      const allProducts = db.products.findAll();
      const cat = db.categories.findById(categoryIdOrSlug) || db.categories.findBySlug(categoryIdOrSlug);
      const catId = cat ? cat.id : categoryIdOrSlug;
      const catSlug = cat ? cat.slug : categoryIdOrSlug;
      return allProducts.filter((p) => p.categoryId === catId || p.category === catSlug).length;
    },
    moveProducts: (fromCategoryId: string, toCategoryId: string) => {
      const fromCat = db.categories.findById(fromCategoryId);
      const toCat = db.categories.findById(toCategoryId);
      if (!toCat) return 0;

      db.products.findAll();
      const fromSlug = fromCat ? fromCat.slug : '';
      let updatedCount = 0;
      products.forEach((p) => {
        if (p.categoryId === fromCategoryId || (fromSlug && p.category === fromSlug)) {
          p.categoryId = toCat.id;
          p.category = toCat.slug;
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        saveDataToFile('products.json', products);
      }
      return updatedCount;
    },
  },

  // ——— Products ———————————————————————————————————————————————
  products: {
    findAll: (filters?: { category?: string; featured?: boolean; search?: string; sale?: boolean }) => {
      try {
        const filePath = getDataFilePath('products.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            products = ensureProductColorVariants(parsed);
          }
        }
      } catch {
        // Fall back to in-memory products
      }
      let result = [...products];
      if (filters?.category) {
        const cat = db.categories.findBySlug(filters.category) || db.categories.findById(filters.category);
        const catId = cat ? cat.id : filters.category;
        const catSlug = cat ? cat.slug : filters.category;
        result = result.filter((p) => p.categoryId === catId || p.category === catSlug);
      }
      if (filters?.featured !== undefined) result = result.filter((p) => p.featured === filters.featured);
      if (filters?.sale !== undefined) {
        if (filters.sale) {
          result = result.filter((p) => Boolean(p.comparePrice && p.comparePrice > p.price));
        } else {
          result = result.filter((p) => !p.comparePrice || p.comparePrice <= p.price);
        }
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))
        );
      }
      return result;
    },
    findById: (id: string) => db.products.findAll().find((p) => p.id === id) || null,
    findBySlug: (slug: string) => db.products.findAll().find((p) => p.slug === slug) || null,
    create: (product: Product) => {
      db.products.findAll();
      const variants = (product.colorVariants || []).map((v) => {
        const sizeStock = v.sizeStock || {};
        const stock = Object.values(sizeStock).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
        return { ...v, sizeStock, stock };
      });
      const derivedStock = variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : product.stock;
      const finalProduct: Product = {
        ...product,
        colorVariants: variants,
        stock: derivedStock,
      };
      products.push(finalProduct);
      saveDataToFile('products.json', products);
      return finalProduct;
    },
    update: (id: string, data: Partial<Product>) => {
      db.products.findAll();
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const merged = { ...products[idx], ...data };
      if (merged.colorVariants && merged.colorVariants.length > 0) {
        merged.colorVariants = merged.colorVariants.map((v) => {
          const sizeStock = v.sizeStock || {};
          const stock = Object.values(sizeStock).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
          return { ...v, sizeStock, stock };
        });
        merged.stock = merged.colorVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      products[idx] = merged;
      saveDataToFile('products.json', products);
      return products[idx];
    },
    delete: (id: string) => {
      db.products.findAll();
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      products.splice(idx, 1);
      saveDataToFile('products.json', products);
      return true;
    },
    /**
     * Deducts stock for checkout atomically (all-or-nothing).
     * Deducts stock per chosen color variant and size.
     * Rejects if any variant or size has insufficient stock, with exact message mentioning product, color, and size.
     */
    deductStock: (lines: StockLine[]): StockDeductionResult => {
      db.products.findAll();

      // Aggregate quantities per product index + variant index + size
      const needed = new Map<string, { productIdx: number; variantIdx: number; size: string; quantity: number }>();

      for (const line of lines) {
        const productIdx = products.findIndex((p) => p.id === line.productId);
        if (productIdx === -1) return { ok: false, error: 'Produk tidak ditemukan' };
        const product = products[productIdx];
        const variants = product.colorVariants ?? [];
        if (!variants.length) {
          return { ok: false, error: `Produk "${product.name}" tidak memiliki varian warna` };
        }
        const variant = findColorVariant(variants, line.color);
        if (!variant) {
          return { ok: false, error: `Warna "${line.color || '-'}" tidak tersedia untuk produk "${product.name}"` };
        }
        const variantIdx = variants.indexOf(variant);
        const size = line.size?.trim();
        if (!size || variant.sizeStock?.[size] === undefined) {
          return {
            ok: false,
            error: `Ukuran "${line.size || '-'}" tidak tersedia untuk produk "${product.name}" warna "${variant.name}"`,
          };
        }
        const key = `${productIdx}:${variantIdx}:${size}`;
        const entry = needed.get(key) ?? { productIdx, variantIdx, size, quantity: 0 };
        entry.quantity += line.quantity;
        needed.set(key, entry);
      }

      // 1. Validate availability atomically
      for (const { productIdx, variantIdx, size, quantity } of needed.values()) {
        const product = products[productIdx];
        const variant = product.colorVariants![variantIdx];
        const available = variant.sizeStock?.[size] ?? 0;
        if (available < quantity) {
          return {
            ok: false,
            error: `Stok produk "${product.name}" warna "${variant.name}" ukuran "${size}" tidak mencukupi (tersedia: ${available}, diminta: ${quantity})`,
          };
        }
      }

      // 2. Apply deduction atomically
      const productUpdates = new Map<number, { product: Product; variants: ColorVariant[] }>();
      for (const { productIdx, variantIdx, size, quantity } of needed.values()) {
        if (!productUpdates.has(productIdx)) {
          const originalProduct = products[productIdx];
          const clonedVariants = (originalProduct.colorVariants || []).map((v) => ({
            ...v,
            sizeStock: { ...(v.sizeStock || {}) },
          }));
          productUpdates.set(productIdx, { product: originalProduct, variants: clonedVariants });
        }
        const { variants } = productUpdates.get(productIdx)!;
        const variant = variants[variantIdx];
        variant.sizeStock[size] = (variant.sizeStock[size] || 0) - quantity;
        variant.stock = Object.values(variant.sizeStock).reduce((sum: number, n: number) => sum + n, 0);
      }

      for (const [productIdx, { product, variants }] of productUpdates.entries()) {
        const totalProductStock = variants.reduce((sum, v) => sum + v.stock, 0);
        products[productIdx] = {
          ...product,
          colorVariants: variants,
          stock: totalProductStock,
        };
      }

      saveDataToFile('products.json', products);
      return { ok: true };
    },
    /**
     * Restores stock for items (e.g. when order is cancelled) to their respective color and size combination.
     */
    restoreStock: (lines: StockLine[]): { ok: true } => {
      db.products.findAll();
      const productUpdates = new Map<number, { product: Product; variants: ColorVariant[] }>();

      for (const line of lines) {
        const productIdx = products.findIndex((p) => p.id === line.productId);
        if (productIdx === -1) continue;
        const product = products[productIdx];
        const variants = product.colorVariants ?? [];
        if (!variants.length) continue;

        if (!productUpdates.has(productIdx)) {
          const clonedVariants = variants.map((v) => ({
            ...v,
            sizeStock: { ...(v.sizeStock || {}) },
          }));
          productUpdates.set(productIdx, { product, variants: clonedVariants });
        }

        const { variants: clonedVariants } = productUpdates.get(productIdx)!;
        let variant = findColorVariant(clonedVariants, line.color);
        if (!variant) variant = clonedVariants[0];
        if (!variant) continue;
        const vIdx = clonedVariants.indexOf(variant);

        const size = line.size?.trim();
        if (size && variant.sizeStock[size] !== undefined) {
          variant.sizeStock[size] = (variant.sizeStock[size] || 0) + line.quantity;
        } else if (variant.sizeStock['One Size'] !== undefined) {
          variant.sizeStock['One Size'] = (variant.sizeStock['One Size'] || 0) + line.quantity;
        } else {
          const firstSize = Object.keys(variant.sizeStock)[0];
          if (firstSize) {
            variant.sizeStock[firstSize] = (variant.sizeStock[firstSize] || 0) + line.quantity;
          }
        }
        variant.stock = Object.values(variant.sizeStock).reduce((sum: number, n: number) => sum + n, 0);
        clonedVariants[vIdx] = variant;
      }

      for (const [productIdx, { product, variants }] of productUpdates.entries()) {
        const totalProductStock = variants.reduce((sum, v) => sum + v.stock, 0);
        products[productIdx] = {
          ...product,
          colorVariants: variants,
          stock: totalProductStock,
        };
      }

      saveDataToFile('products.json', products);
      return { ok: true };
    },
  },

  // ——— Orders ————————————————————————————————————————————————
  orders: {
    findAll: () => {
      try {
        const filePath = getDataFilePath('orders.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            orders = parsed;
          }
        }
      } catch {
        // Fall back to in-memory orders
      }
      return orders;
    },
    findById: (id: string) => db.orders.findAll().find((o) => o.id === id) || null,
    findByUser: (userId: string) => db.orders.findAll().filter((o) => o.userId === userId),
    create: (order: Order) => {
      db.orders.findAll();
      orders.push(order);
      saveDataToFile('orders.json', orders);
      return order;
    },
    update: (id: string, data: Partial<Order>) => {
      db.orders.findAll();
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      const prev = orders[idx];

      // If order is transitioning to cancelled, restore stock to the colors & sizes
      if (data.orderStatus === 'cancelled' && prev.orderStatus !== 'cancelled') {
        db.products.restoreStock(
          prev.items.map((item) => ({
            productId: item.productId,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
          }))
        );
      }

      orders[idx] = { ...prev, ...data };
      saveDataToFile('orders.json', orders);
      return orders[idx];
    },
  },

  // ——— Carts —————————————————————————————————————————————————
  carts: {
    findByUser: (userId: string) => carts.find((c) => c.userId === userId) || null,
    upsert: (cart: Cart) => {
      const idx = carts.findIndex((c) => c.userId === cart.userId);
      if (idx === -1) {
        carts.push(cart);
      } else {
        carts[idx] = cart;
      }
      return cart;
    },
    clear: (userId: string) => {
      const idx = carts.findIndex((c) => c.userId === userId);
      if (idx !== -1) carts.splice(idx, 1);
    },
  },

  // ——— Addresses —————————————————————————————————————————————
  addresses: {
    findAll: () => {
      try {
        const filePath = getDataFilePath('addresses.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            addresses = parsed;
          }
        }
      } catch {
        // Fall back to in-memory addresses
      }
      return addresses;
    },
    findById: (id: string) => db.addresses.findAll().find((a) => a.id === id) || null,
    findByUser: (userId: string) => db.addresses.findAll().filter((a) => a.userId === userId),
    findDefaultByUser: (userId: string) => {
      const userAddrs = db.addresses.findAll().filter((a) => a.userId === userId);
      return userAddrs.find((a) => a.isDefault) || userAddrs[0] || null;
    },
    create: (address: UserAddress) => {
      db.addresses.findAll();
      const userAddrs = addresses.filter((a) => a.userId === address.userId);
      const shouldBeDefault = address.isDefault || userAddrs.length === 0;
      if (shouldBeDefault) {
        addresses.forEach((a) => {
          if (a.userId === address.userId) a.isDefault = false;
        });
      }
      const newAddress: UserAddress = {
        ...address,
        isDefault: shouldBeDefault,
      };
      addresses.push(newAddress);
      saveDataToFile('addresses.json', addresses);
      return newAddress;
    },
    update: (id: string, data: Partial<UserAddress>) => {
      db.addresses.findAll();
      const idx = addresses.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      const target = addresses[idx];

      if (data.isDefault) {
        addresses.forEach((a) => {
          if (a.userId === target.userId) a.isDefault = false;
        });
      }

      addresses[idx] = {
        ...target,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      saveDataToFile('addresses.json', addresses);
      return addresses[idx];
    },
    delete: (id: string) => {
      db.addresses.findAll();
      const idx = addresses.findIndex((a) => a.id === id);
      if (idx === -1) return false;
      const [deleted] = addresses.splice(idx, 1);

      if (deleted.isDefault) {
        const remaining = addresses.filter((a) => a.userId === deleted.userId);
        if (remaining.length > 0) {
          remaining[0].isDefault = true;
        }
      }
      saveDataToFile('addresses.json', addresses);
      return true;
    },
    setDefault: (userId: string, id: string) => {
      db.addresses.findAll();
      let found = false;
      addresses.forEach((a) => {
        if (a.userId === userId) {
          if (a.id === id) {
            a.isDefault = true;
            found = true;
          } else {
            a.isDefault = false;
          }
        }
      });
      if (found) {
        saveDataToFile('addresses.json', addresses);
      }
      return found ? addresses.find((a) => a.id === id) || null : null;
    },
  },

  // ——— Reviews ———————————————————————————————————————————————
  reviews: {
    findAll: () => reviews,
    findById: (id: string) => reviews.find((r) => r.id === id) || null,
    findPublishedByProduct: (productId: string) =>
      reviews.filter((r) => r.productId === productId && r.status === 'published'),
    exists: (userId: string, orderId: string, productId: string) =>
      reviews.some(
        (r) => r.userId === userId && r.orderId === orderId && r.productId === productId
      ),
    create: (review: Review) => {
      reviews.push(review);
      return review;
    },
    update: (id: string, data: Partial<Review>) => {
      const idx = reviews.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      reviews[idx] = { ...reviews[idx], ...data };
      return reviews[idx];
    },
    delete: (id: string) => {
      const idx = reviews.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      reviews.splice(idx, 1);
      return true;
    },
  },

  // ——— Navigation —————————————————————————————————————————————
  navigation: {
    findAll: (filters?: { activeOnly?: boolean }) => {
      try {
        const filePath = getDataFilePath('navigation.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            navigation = parsed;
          }
        }
      } catch {
        // Fall back to in-memory navigation
      }
      let result = [...navigation];
      if (filters?.activeOnly) {
        result = result.filter((item) => item.active);
      }
      result.sort((a, b) => a.order - b.order);
      return result;
    },
    findById: (id: string) => db.navigation.findAll().find((item) => item.id === id) || null,
    findByLabel: (label: string) =>
      db.navigation.findAll().find((item) => item.label.toLowerCase() === label.toLowerCase()) || null,
    create: (item: NavigationItem) => {
      db.navigation.findAll();
      navigation.push(item);
      saveDataToFile('navigation.json', navigation);
      return item;
    },
    update: (id: string, data: Partial<NavigationItem>) => {
      db.navigation.findAll();
      const idx = navigation.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      navigation[idx] = { ...navigation[idx], ...data };
      saveDataToFile('navigation.json', navigation);
      return navigation[idx];
    },
    delete: (id: string) => {
      db.navigation.findAll();
      const idx = navigation.findIndex((item) => item.id === id);
      if (idx === -1) return false;
      navigation.splice(idx, 1);
      saveDataToFile('navigation.json', navigation);
      return true;
    },
    reorder: (ids: string[]) => {
      db.navigation.findAll();
      const idOrderMap = new Map<string, number>();
      ids.forEach((id, index) => {
        idOrderMap.set(id, index + 1);
      });
      navigation.forEach((item) => {
        if (idOrderMap.has(item.id)) {
          item.order = idOrderMap.get(item.id)!;
        }
      });
      navigation.sort((a, b) => a.order - b.order);
      saveDataToFile('navigation.json', navigation);
      return navigation;
    },
  },
};

// ——— ID generator ———————————————————————————————————————————
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
