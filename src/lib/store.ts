// ============================================================
// LUXE — Data store with JSON file persistence
// ============================================================
import type { User, Product, Order, Cart, UserAddress, Review } from '@/types';
import fs from 'fs';
import path from 'path';

// Import seed data
import usersData from '@/data/users.json';
import productsData from '@/data/products.json';
import ordersData from '@/data/orders.json';
import addressesData from '@/data/addresses.json';
import reviewsData from '@/data/reviews.json';

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

// Stores initialized from disk (falling back to imported JSON)
let users: User[] = loadDataFromFile<User[]>('users.json', usersData as User[]);
let products: Product[] = productsData as Product[];
let orders: Order[] = ordersData as Order[];
let addresses: UserAddress[] = loadDataFromFile<UserAddress[]>('addresses.json', addressesData as UserAddress[]);
let reviews: Review[] = reviewsData as Review[];
let carts: Cart[] = [];

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

  // ——— Products ———————————————————————————————————————————————
  products: {
    findAll: (filters?: { category?: string; featured?: boolean; search?: string }) => {
      let result = [...products];
      if (filters?.category) result = result.filter((p) => p.category === filters.category);
      if (filters?.featured !== undefined) result = result.filter((p) => p.featured === filters.featured);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))
        );
      }
      return result;
    },
    findById: (id: string) => products.find((p) => p.id === id) || null,
    findBySlug: (slug: string) => products.find((p) => p.slug === slug) || null,
    create: (product: Product) => {
      products.push(product);
      return product;
    },
    update: (id: string, data: Partial<Product>) => {
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      products[idx] = { ...products[idx], ...data };
      return products[idx];
    },
    delete: (id: string) => {
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      products.splice(idx, 1);
      return true;
    },
  },

  // ——— Orders ————————————————————————————————————————————————
  orders: {
    findAll: () => orders,
    findById: (id: string) => orders.find((o) => o.id === id) || null,
    findByUser: (userId: string) => orders.filter((o) => o.userId === userId),
    create: (order: Order) => {
      orders.push(order);
      return order;
    },
    update: (id: string, data: Partial<Order>) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      orders[idx] = { ...orders[idx], ...data };
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
};

// ——— ID generator ———————————————————————————————————————————
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
