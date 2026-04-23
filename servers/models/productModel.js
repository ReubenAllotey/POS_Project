import { query } from "../../config/db.js";

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapProductRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    barcode: row.barcode,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProductPayload(payload) {
  return {
    name: String(payload.name || "").trim(),
    category: String(payload.category || "General").trim() || "General",
    barcode: String(payload.barcode || "").trim(),
    price: normalizeNumber(payload.price),
    cost: normalizeNumber(payload.cost),
    stock: Math.max(0, Math.trunc(normalizeNumber(payload.stock))),
  };
}

function validateProductPayload(product) {
  if (!product.name) {
    throw new Error("Product name is required.");
  }

  if (!product.barcode) {
    throw new Error("Barcode is required.");
  }

  if (product.price < 0 || product.cost < 0) {
    throw new Error("Price values must be zero or greater.");
  }
}

export async function listProducts({ search = "" } = {}) {
  const keyword = `%${String(search).trim().toLowerCase()}%`;
  const hasSearch = String(search).trim().length > 0;

  const { rows } = await query(
    `
      SELECT *
      FROM products
      WHERE is_active = TRUE
        AND (
          $1::boolean = FALSE OR
          LOWER(name) LIKE $2 OR
          LOWER(barcode) LIKE $2 OR
          LOWER(category) LIKE $2
        )
      ORDER BY name ASC
    `,
    [hasSearch, keyword],
  );

  return rows.map(mapProductRow);
}

export async function getProductById(id) {
  const { rows } = await query("SELECT * FROM products WHERE id = $1", [Number(id)]);
  return rows[0] ? mapProductRow(rows[0]) : undefined;
}

export async function getProductByBarcode(barcode) {
  const { rows } = await query("SELECT * FROM products WHERE barcode = $1", [
    String(barcode).trim(),
  ]);
  return rows[0] ? mapProductRow(rows[0]) : undefined;
}

export async function createProduct(payload) {
  const normalized = normalizeProductPayload(payload);
  validateProductPayload(normalized);

  const { rows } = await query(
    `
      INSERT INTO products (name, category, barcode, price, cost, stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      normalized.name,
      normalized.category,
      normalized.barcode,
      normalized.price,
      normalized.cost,
      normalized.stock,
    ],
  );

  return mapProductRow(rows[0]);
}

export async function updateProduct(id, payload) {
  const normalized = normalizeProductPayload(payload);
  validateProductPayload(normalized);

  const { rows } = await query(
    `
      UPDATE products
      SET name = $2,
          category = $3,
          barcode = $4,
          price = $5,
          cost = $6,
          stock = $7
      WHERE id = $1
      RETURNING *
    `,
    [
      Number(id),
      normalized.name,
      normalized.category,
      normalized.barcode,
      normalized.price,
      normalized.cost,
      normalized.stock,
    ],
  );

  if (!rows[0]) {
    throw new Error("Product not found.");
  }

  return mapProductRow(rows[0]);
}

export async function deleteProduct(id) {
  const { rows } = await query(
    `
      UPDATE products
      SET is_active = FALSE
      WHERE id = $1
      RETURNING *
    `,
    [Number(id)],
  );

  if (!rows[0]) {
    throw new Error("Product not found.");
  }

  return mapProductRow(rows[0]);
}

export async function restockProduct(id, quantity) {
  const amount = Math.max(0, Math.trunc(normalizeNumber(quantity)));
  if (amount <= 0) {
    throw new Error("Restock quantity must be greater than zero.");
  }

  const { rows } = await query(
    `
      UPDATE products
      SET stock = stock + $2
      WHERE id = $1
      RETURNING *
    `,
    [Number(id), amount],
  );

  if (!rows[0]) {
    throw new Error("Product not found.");
  }

  await query(
    `
      INSERT INTO inventory_movements (product_id, movement_type, quantity, notes)
      VALUES ($1, 'restock', $2, 'Manual restock from inventory page')
    `,
    [Number(id), amount],
  );

  return mapProductRow(rows[0]);
}

export async function listLowStockProducts(threshold = 10) {
  const { rows } = await query(
    `
      SELECT *
      FROM products
      WHERE is_active = TRUE AND stock < $1
      ORDER BY stock ASC, name ASC
    `,
    [threshold],
  );

  return rows.map(mapProductRow);
}
