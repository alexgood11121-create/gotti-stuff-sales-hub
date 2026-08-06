import Dexie, { type Table } from "dexie";

export interface ProductSize {
  size: string;
  sale_price: number;
  cost_price?: number;
  cup_type_id?: string | null;
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
  cup_type_id?: string | null;
}

export interface CachedCupType {
  id: string;
  name: string;
  material: string;
  volume_ml: number;
  sort_order: number;
  is_active: boolean;
}

export interface CachedShiftCup {
  id: string;
  shift_id: string;
  cup_type_id: string;
  issued_qty: number;
  counted_qty: number | null;
  updated_at: string;
}

export interface PendingCupCount {
  id: string;
  shift_id: string;
  cup_type_id: string;
  counted_qty: number;
  created_at: string;
  synced: number;
  attempts: number;
  last_error?: string;
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

export interface CachedAuthUser {
  id: string;
  email: string;
  nickname: string | null;
  role: "admin" | "cashier";
  branch_id: string | null;
  password_salt: string;
  password_hash: string;
  updated_at: string;
}

export interface PendingStockMovement {
  id: string;
  type: "income" | "expense";
  product_id: string | null;
  product_name?: string | null;
  qty: number | null;
  unit_price: number | null;
  amount: number;
  note: string | null;
  branch_id: string | null;
  user_id: string | null;
  created_at: string;
  synced: number;
  attempts: number;
  last_error?: string;
}

export interface CachedShift {
  id: string;
  cashier_id: string;
  branch_id: string | null;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash_expected: number | null;
  closing_cash_actual: number | null;
  cash_diff: number | null;
  synced: number;
  attempts: number;
  last_error?: string;
}

export interface CachedSale {
  id: string;
  client_uuid: string | null;
  created_at: string;
  total: number;
  payment_method: "cash" | "card" | "mixed";
  cash_amount: number;
  card_amount: number;
  cashier_id: string | null;
  cashier_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  pending: number; // 1 = ещё не отправлен на сервер
}

export interface CachedSaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  variant_size: string | null;
  qty: number;
  unit_price: number;
  cost_price: number;
  total: number;
}

class GottiDB extends Dexie {
  products!: Table<CachedProduct, string>;
  categories!: Table<CachedCategory, string>;
  pendingSales!: Table<PendingSale, string>;
  parked!: Table<ParkedTicket, string>;
  authUsers!: Table<CachedAuthUser, string>;
  pendingStockMovements!: Table<PendingStockMovement, string>;
  shifts!: Table<CachedShift, string>;
  sales!: Table<CachedSale, string>;
  saleItems!: Table<CachedSaleItem, string>;
  cupTypes!: Table<CachedCupType, string>;
  shiftCups!: Table<CachedShiftCup, string>;
  pendingCupCounts!: Table<PendingCupCount, string>;

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
    this.version(4).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
      parked: "id, created_at",
      authUsers: "id, email, nickname, role",
    });
    this.version(5).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
      parked: "id, created_at",
      authUsers: "id, email, nickname, role",
      pendingStockMovements: "id, type, synced, created_at, product_id, user_id",
      shifts: "id, cashier_id, synced, started_at, ended_at",
    });
    this.version(6).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
      parked: "id, created_at",
      authUsers: "id, email, nickname, role",
      pendingStockMovements: "id, type, synced, created_at, product_id, user_id",
      shifts: "id, cashier_id, synced, started_at, ended_at",
      sales: "id, created_at, cashier_id, branch_id, pending, client_uuid",
      saleItems: "id, sale_id",
    });
    this.version(7).stores({
      products: "id, name, category_id, is_active, sales_count",
      categories: "id, name",
      pendingSales: "client_uuid, synced, created_at",
      parked: "id, created_at",
      authUsers: "id, email, nickname, role",
      pendingStockMovements: "id, type, synced, created_at, product_id, user_id",
      shifts: "id, cashier_id, synced, started_at, ended_at",
      sales: "id, created_at, cashier_id, branch_id, pending, client_uuid",
      saleItems: "id, sale_id",
      cupTypes: "id, sort_order, name",
      shiftCups: "id, shift_id, cup_type_id",
      pendingCupCounts: "id, synced, shift_id",
    });
  }
}

export const db = new GottiDB();
