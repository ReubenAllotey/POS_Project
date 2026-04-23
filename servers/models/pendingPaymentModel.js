import { query } from "../../config/db.js";

function mapPendingPaymentRow(row) {
  return {
    id: Number(row.id),
    reference: row.reference,
    paymentMethod: row.payment_method,
    checkoutAmount: Number(row.checkout_amount),
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    payload: row.payload,
    status: row.status,
    paystackAccessCode: row.paystack_access_code,
    paystackTransactionId: row.paystack_transaction_id,
    saleId: row.sale_id ? Number(row.sale_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPendingPayment({
  reference,
  paymentMethod,
  checkoutAmount,
  customerEmail,
  customerPhone,
  payload,
}) {
  const { rows } = await query(
    `
      INSERT INTO pending_payments (
        reference, payment_method, checkout_amount, customer_email, customer_phone, payload
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      reference,
      paymentMethod,
      checkoutAmount,
      customerEmail || null,
      customerPhone || null,
      JSON.stringify(payload),
    ],
  );

  return mapPendingPaymentRow(rows[0]);
}

export async function updatePendingPaymentInitialization(reference, accessCode) {
  const { rows } = await query(
    `
      UPDATE pending_payments
      SET paystack_access_code = $2
      WHERE reference = $1
      RETURNING *
    `,
    [reference, accessCode],
  );

  return rows[0] ? mapPendingPaymentRow(rows[0]) : undefined;
}

export async function updatePendingPaymentState(reference, updates = {}) {
  const assignments = [];
  const values = [reference];
  let index = 2;

  if (Object.prototype.hasOwnProperty.call(updates, "status")) {
    assignments.push(`status = $${index++}`);
    values.push(updates.status);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "paystackAccessCode")) {
    assignments.push(`paystack_access_code = $${index++}`);
    values.push(updates.paystackAccessCode);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "paystackTransactionId")) {
    assignments.push(`paystack_transaction_id = $${index++}`);
    values.push(updates.paystackTransactionId);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "payload")) {
    assignments.push(`payload = $${index++}`);
    values.push(JSON.stringify(updates.payload));
  }

  if (assignments.length === 0) {
    return getPendingPaymentByReference(reference);
  }

  const { rows } = await query(
    `
      UPDATE pending_payments
      SET ${assignments.join(", ")}
      WHERE reference = $1
      RETURNING *
    `,
    values,
  );

  return rows[0] ? mapPendingPaymentRow(rows[0]) : undefined;
}

export async function getPendingPaymentByReference(reference) {
  const { rows } = await query("SELECT * FROM pending_payments WHERE reference = $1", [reference]);
  return rows[0] ? mapPendingPaymentRow(rows[0]) : undefined;
}

export async function markPendingPaymentCompleted(reference, { saleId, transactionId }) {
  const { rows } = await query(
    `
      UPDATE pending_payments
      SET status = 'completed',
          sale_id = $2,
          paystack_transaction_id = $3
      WHERE reference = $1
      RETURNING *
    `,
    [reference, saleId, transactionId ? String(transactionId) : null],
  );

  return rows[0] ? mapPendingPaymentRow(rows[0]) : undefined;
}

export async function markPendingPaymentFailed(reference) {
  const { rows } = await query(
    `
      UPDATE pending_payments
      SET status = 'failed'
      WHERE reference = $1
      RETURNING *
    `,
    [reference],
  );

  return rows[0] ? mapPendingPaymentRow(rows[0]) : undefined;
}
