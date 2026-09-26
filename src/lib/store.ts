// ============================================================
// LUXE — In-memory data store (simulates a database)
// Uses imported JSON as seed, mutations are in-memory only
// ============================================================
import type { User, Product, Order, Cart, UserAddress } from '@/types';

// Import seed data
import usersData from '@/data/users.json';
import productsData from '@/data/products.json';
import ordersData from '@/data/orders.json';
import addressesData from '@/data/addresses.json';

// Mutable in-memory stores (reset on server restart)
let users: User[] = usersData as User[];
let products: Product[] = productsData as Product[];
let orders: Order[] = ordersData as Order[];
let addresses: UserAddress[] = addressesData as UserAddress[];
let carts: Cart[] = [];

// ─── Users ────────────────────────────────────────────────
export const db = {
  users: {
    findAll: () => users,
    findById: (id: string) => users.find((u) => u.id === id) || null,
    findByEmail: (email: string) => users.find((u) => u.email === email) || null,
    create: (user: User) => {
      users.push(user);
      return user;
    },
    update: (id: string, data: Partial<User>) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...data };
      return users[idx];
    },
  },

  // ─── Products ──────────────────────────────────────────
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

  // ─── Orders ────────────────────────────────────────────
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

  // ─── Carts ─────────────────────────────────────────────
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

  // ─── Addresses ──────────────────────────────────────────
  addresses: {
    findAll: () => addresses,
    findById: (id: string) => addresses.find((a) => a.id === id) || null,
    findByUser: (userId: string) => addresses.filter((a) => a.userId === userId),
    findDefaultByUser: (userId: string) => {
      const userAddrs = addresses.filter((a) => a.userId === userId);
      return userAddrs.find((a) => a.isDefault) || userAddrs[0] || null;
    },
    create: (address: UserAddress) => {
      const userAddrs = addresses.filter((a) => a.userId === address.userId);
      // If it's the user's first address or marked default, set as default
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
      return newAddress;
    },
    update: (id: string, data: Partial<UserAddress>) => {
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
      return addresses[idx];
    },
    delete: (id: string) => {
      const idx = addresses.findIndex((a) => a.id === id);
      if (idx === -1) return false;
      const [deleted] = addresses.splice(idx, 1);

      // If deleted was default, make another one default
      if (deleted.isDefault) {
        const remaining = addresses.filter((a) => a.userId === deleted.userId);
        if (remaining.length > 0) {
          remaining[0].isDefault = true;
        }
      }
      return true;
    },
    setDefault: (userId: string, id: string) => {
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
      return found ? addresses.find((a) => a.id === id) || null : null;
    },
  },
};

// ─── ID generator ──────────────────────────────────────────
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
