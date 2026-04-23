import { query } from "../../config/db.js";

function mapCustomerRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone,
    email: row.email || "",
    address: row.address || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCustomerPayload(payload) {
  return {
    name: String(payload.name || "").trim(),
    phone: String(payload.phone || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    address: String(payload.address || "").trim(),
  };
}

function validateCustomerPayload(customer) {
  if (!customer.name) {
    throw new Error("Customer name is required.");
  }

  if (!customer.phone) {
    throw new Error("Customer phone is required.");
  }
}

export async function listCustomers({ search = "" } = {}) {
  const keyword = `%${String(search).trim().toLowerCase()}%`;
  const hasSearch = String(search).trim().length > 0;

  const { rows } = await query(
    `
      SELECT *
      FROM customers
      WHERE
        $1::boolean = FALSE OR
        LOWER(name) LIKE $2 OR
        LOWER(phone) LIKE $2 OR
        LOWER(COALESCE(email, '')) LIKE $2
      ORDER BY name ASC
    `,
    [hasSearch, keyword],
  );

  return rows.map(mapCustomerRow);
}

export async function getCustomerById(id) {
  const { rows } = await query("SELECT * FROM customers WHERE id = $1", [Number(id)]);
  return rows[0] ? mapCustomerRow(rows[0]) : undefined;
}

export async function createCustomer(payload) {
  const normalized = normalizeCustomerPayload(payload);
  validateCustomerPayload(normalized);

  const { rows } = await query(
    `
      INSERT INTO customers (name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [normalized.name, normalized.phone, normalized.email || null, normalized.address || null],
  );

  return mapCustomerRow(rows[0]);
}

export async function updateCustomer(id, payload) {
  const normalized = normalizeCustomerPayload(payload);
  validateCustomerPayload(normalized);

  const { rows } = await query(
    `
      UPDATE customers
      SET name = $2,
          phone = $3,
          email = $4,
          address = $5
      WHERE id = $1
      RETURNING *
    `,
    [Number(id), normalized.name, normalized.phone, normalized.email || null, normalized.address || null],
  );

  if (!rows[0]) {
    throw new Error("Customer not found.");
  }

  return mapCustomerRow(rows[0]);
}

export async function deleteCustomer(id) {
  const { rows } = await query("DELETE FROM customers WHERE id = $1 RETURNING *", [Number(id)]);

  if (!rows[0]) {
    throw new Error("Customer not found.");
  }

  return mapCustomerRow(rows[0]);
}
