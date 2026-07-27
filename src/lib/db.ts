import Dexie, { type Table } from "dexie";

export interface ProductSize {
  size: string;
  sale_price: number;
  cost_price?: number;
}

export interface CachedProduct {
  id: string;
  name: string;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  category_id: string | null;
  stock: number;
  is_active: boolean;
  sizes: ProductSize[];
  sales_count: number;
}

export interface CachedCategory {
  id: string;
  name: string;
  color: string | null;
}

export interface PendingSaleItem {
  product_id: string | null;
  product_name: string;
  variant_size?: string | null;
  qty: number;
  unit_price: number;
  cost_price: number;
  total: number;
}

export interface PendingSale {
  client_uuid: string;
  branch_id: string | null;
  cashier_id: string;
  total: number;
  cash_amount: number;
  card_amount: number;
  given_amount: number;
  change_amount: number;
  payment_method: "cash" | "card" | "mixed";
  items: PendingSaleItem[];
  created_at: string;
  synced: number;
  attempts: number;
  last_error?: string;
}

export interface ParkedTicket {
  id: string;
  label: string;
  items: PendingSaleItem[];
  total: number;
  created_at: string;
}

class GottiDB extends Dexie {
  products!: Table<CachedProduct, string>;
  categories!: Table<CachedCategory, string>;
  pendingSales!: Table<PendingSale, string>;
  parked!: Table<ParkedTicket, string>;

  constructor() {
    super("gotti-stuff-db");
    this.version(1).stores({
      products: "id, name, category_id, is_active",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
    });
    this.version(2).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
    });
    this.version(3).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
      parked: "id, created_at",
    });
  }
}

export const db = new GottiDB();
