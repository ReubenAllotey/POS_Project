import { promises as fs } from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_CONFIG = {
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || "posProject",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "",
};

const schemaFile = path.resolve(__dirname, "../database/schema.sql");
const legacySeedFile = path.resolve(__dirname, "../data/store.json");

export const pool = new Pool(DEFAULT_DB_CONFIG);

export async function query(text, params = []) {
  return pool.query(text, params);
}

async function runSchema() {
  const schemaSql = await fs.readFile(schemaFile, "utf8");
  await pool.query(schemaSql);
}

async function setSequence(tableName) {
  await pool.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
        false
      )
    `,
    [tableName],
  );
}

async function seedUsers(client, users) {
  for (const user of users) {
    await client.query(
      `
        INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.role || "cashier",
        typeof user.isActive === "boolean" ? user.isActive : true,
        user.createdAt || new Date().toISOString(),
        user.updatedAt || user.createdAt || new Date().toISOString(),
      ],
    );
  }
}

async function seedCustomers(client, customers) {
  for (const customer of customers) {
    await client.query(
      `
        INSERT INTO customers (id, name, phone, email, address, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        customer.id,
        customer.name,
        customer.phone,
        customer.email || null,
        customer.address || null,
        customer.createdAt || new Date().toISOString(),
        customer.updatedAt || customer.createdAt || new Date().toISOString(),
      ],
    );
  }
}

async function seedProducts(client, products) {
  for (const product of products) {
    await client.query(
      `
        INSERT INTO products (id, name, category, price, cost, stock, barcode, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        product.id,
        product.name,
        product.category || "General",
        Number(product.price || 0),
        Number(product.cost || 0),
        Number(product.stock || 0),
        product.barcode,
        typeof product.isActive === "boolean" ? product.isActive : true,
        product.createdAt || new Date().toISOString(),
        product.updatedAt || product.createdAt || new Date().toISOString(),
      ],
    );
  }
}

async function seedSales(client, sales) {
  for (const sale of sales.slice().reverse()) {
    await client.query(
      `
        INSERT INTO sales (
          id, receipt_number, customer_id, cashier_id, payment_method,
          subtotal, amount_paid, change, profit, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        sale.id,
        sale.receiptNumber,
        sale.customerId || null,
        sale.cashierId || null,
        sale.payment?.method || "cash",
        Number(sale.subtotal || 0),
        Number(sale.payment?.amountPaid || sale.subtotal || 0),
        Number(sale.payment?.change || 0),
        Number(sale.profit || 0),
        sale.createdAt || new Date().toISOString(),
      ],
    );

    for (const item of sale.items || []) {
      await client.query(
        `
          INSERT INTO sale_items (
            sale_id, product_id, product_name, barcode, quantity,
            unit_price, unit_cost, line_total, cost_total, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          sale.id,
          item.productId,
          item.name,
          item.barcode || null,
          Number(item.quantity || 0),
          Number(item.unitPrice || 0),
          Number(item.unitCost || 0),
          Number(item.lineTotal || 0),
          Number(item.costTotal || 0),
          sale.createdAt || new Date().toISOString(),
        ],
      );
    }
  }
}

async function seedLegacyDataIfNeeded() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (rows[0].count > 0) {
    return;
  }

  try {
    const legacyContents = await fs.readFile(legacySeedFile, "utf8");
    const legacyStore = JSON.parse(legacyContents);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await seedUsers(client, legacyStore.users || []);
      await seedCustomers(client, legacyStore.customers || []);
      await seedProducts(client, legacyStore.products || []);
      await seedSales(client, legacyStore.sales || []);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await setSequence("users");
    await setSequence("customers");
    await setSequence("products");
    await setSequence("sales");
    await setSequence("sale_items");
    await setSequence("inventory_movements");
    await setSequence("pending_payments");
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

let initializationPromise;

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await runSchema();
      await seedLegacyDataIfNeeded();
    })();
  }

  return initializationPromise;
}
