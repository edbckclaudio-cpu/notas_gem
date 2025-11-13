import fs from "fs";
import path from "path";
import type { Invoice, Product, Supplier, User } from "./types";

type DBShape = {
  users: User[];
  invoices: Invoice[];
  products: Product[];
  suppliers: Supplier[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed: DBShape = { users: [], invoices: [], products: [], suppliers: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

export function readDB(): DBShape {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

export function writeDB(db: DBShape) {
  ensureDB();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function upsertUser(email: string): User {
  const db = readDB();
  let user = db.users.find((u) => u.email === email);
  if (!user) {
    user = { id: crypto.randomUUID(), email };
    db.users.push(user);
    writeDB(db);
  }
  return user;
}