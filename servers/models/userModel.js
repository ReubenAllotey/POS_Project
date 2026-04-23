import { query } from "../../config/db.js";

function mapUserRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers() {
  const { rows } = await query("SELECT * FROM users ORDER BY name ASC");
  return rows.map(mapUserRow);
}

export async function findUserByEmail(email) {
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [
    String(email).trim().toLowerCase(),
  ]);
  return rows[0] ? mapUserRow(rows[0]) : undefined;
}

export async function findUserById(id) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [Number(id)]);
  return rows[0] ? mapUserRow(rows[0]) : undefined;
}

export async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `,
    [String(name).trim(), String(email).trim().toLowerCase(), passwordHash, role || "cashier"],
  );

  return mapUserRow(rows[0]);
}

export async function updateUserStatus(id, isActive) {
  const { rows } = await query(
    `
      UPDATE users
      SET is_active = $2
      WHERE id = $1
      RETURNING *
    `,
    [Number(id), Boolean(isActive)],
  );

  if (!rows[0]) {
    throw new Error("User not found.");
  }

  return mapUserRow(rows[0]);
}

export async function deleteUser(id) {
  const { rows } = await query("DELETE FROM users WHERE id = $1 RETURNING *", [Number(id)]);

  if (!rows[0]) {
    throw new Error("User not found.");
  }

  return mapUserRow(rows[0]);
}
