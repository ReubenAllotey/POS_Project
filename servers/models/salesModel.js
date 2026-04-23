import { pool, query } from "../../config/db.js";
import { buildPayment } from "./paymentModel.js";
import { buildSaleItems } from "./salesItemModel.js";

function mapSaleRow(row) {
  return {
    id: Number(row.id),
    receiptNumber: row.receipt_number,
    createdAt: row.created_at,
    cashierId: row.cashier_id ? Number(row.cashier_id) : null,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    grossTotal: Number(row.gross_total ?? row.subtotal),
    discountAmount: Number(row.discount_amount ?? 0),
    subtotal: Number(row.subtotal),
    profit: Number(row.profit),
    items: [],
    payment: {
      method: row.payment_method,
      amountPaid: Number(row.amount_paid),
      change: Number(row.change),
    },
  };
}

async function attachSaleItems(sales) {
  if (sales.length === 0) {
    return sales;
  }

  const saleIds = sales.map((sale) => sale.id);
  const { rows } = await query(
    `
      SELECT sale_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, line_total, cost_total
      FROM sale_items
      WHERE sale_id = ANY($1::bigint[])
      ORDER BY id ASC
    `,
    [saleIds],
  );

  const itemsBySaleId = new Map();
  for (const row of rows) {
    const saleId = Number(row.sale_id);
    const items = itemsBySaleId.get(saleId) || [];
    items.push({
      productId: Number(row.product_id),
      name: row.product_name,
      barcode: row.barcode,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      unitCost: Number(row.unit_cost),
      lineTotal: Number(row.line_total),
      costTotal: Number(row.cost_total),
    });
    itemsBySaleId.set(saleId, items);
  }

  return sales.map((sale) => ({
    ...sale,
    items: itemsBySaleId.get(sale.id) || [],
  }));
}

function normalizeDiscount(discountAmount, grossTotal) {
  const normalizedDiscount = Number(Number(discountAmount || 0).toFixed(2));
  if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0) {
    throw new Error("Discount must be zero or greater.");
  }

  if (normalizedDiscount > grossTotal) {
    throw new Error("Discount cannot be greater than the total.");
  }

  return normalizedDiscount;
}

export async function previewSale({ items, discountAmount = 0 }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one item before checkout.");
  }

  const productIds = items.map((item) => Number(item.productId));
  const { rows: productRows } = await query(
    `
      SELECT *
      FROM products
      WHERE id = ANY($1::bigint[]) AND is_active = TRUE
    `,
    [productIds],
  );

  const products = productRows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    barcode: row.barcode,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
  }));

  const saleItems = buildSaleItems(items, products);
  const grossTotal = Number(
    saleItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
  );
  const normalizedDiscount = normalizeDiscount(discountAmount, grossTotal);
  const subtotal = Number((grossTotal - normalizedDiscount).toFixed(2));

  return {
    items: saleItems,
    grossTotal,
    discountAmount: normalizedDiscount,
    subtotal,
  };
}

export async function listSales() {
  const { rows } = await query("SELECT * FROM sales ORDER BY created_at DESC");
  return attachSaleItems(rows.map(mapSaleRow));
}

export async function getSaleById(id) {
  const { rows } = await query("SELECT * FROM sales WHERE id = $1", [Number(id)]);
  if (!rows[0]) {
    return undefined;
  }

  const [sale] = await attachSaleItems([mapSaleRow(rows[0])]);
  return sale;
}

export async function getSaleByPaystackReference(reference) {
  const { rows } = await query("SELECT * FROM sales WHERE paystack_reference = $1", [reference]);
  if (!rows[0]) {
    return undefined;
  }

  const [sale] = await attachSaleItems([mapSaleRow(rows[0])]);
  return sale;
}

export async function createSale(
  {
    items,
    customerId,
    cashierId,
    paymentMethod,
    amountPaid,
    discountAmount = 0,
    paystackReference = null,
    paystackTransactionId = null,
  },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Add at least one item before checkout.");
    }

    const productIds = items.map((item) => Number(item.productId));
    const { rows: productRows } = await client.query(
      `
        SELECT *
        FROM products
        WHERE id = ANY($1::bigint[])
        FOR UPDATE
      `,
      [productIds],
    );

    const products = productRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      barcode: row.barcode,
      price: Number(row.price),
      cost: Number(row.cost),
      stock: Number(row.stock),
    }));

    const saleItems = buildSaleItems(items, products);
    const grossTotal = Number(
      saleItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
    );
    const normalizedDiscount = normalizeDiscount(discountAmount, grossTotal);
    const subtotal = Number((grossTotal - normalizedDiscount).toFixed(2));
    const profit = Number(
      (
        saleItems.reduce((sum, item) => sum + (item.lineTotal - item.costTotal), 0) -
        normalizedDiscount
      ).toFixed(2),
    );
    const payment = buildPayment({ method: paymentMethod, amountPaid, subtotal });

    const { rows: saleRows } = await client.query(
      `
        WITH next_sale AS (
          SELECT nextval('sales_id_seq') AS sale_id
        )
        INSERT INTO sales (
          id, receipt_number, customer_id, cashier_id, payment_method,
          gross_total, discount_amount, subtotal, amount_paid, change, profit,
          paystack_reference, paystack_transaction_id
        )
        SELECT
          sale_id,
          CONCAT('RCPT-', LPAD(sale_id::text, 5, '0')),
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        FROM next_sale
        RETURNING *
      `,
      [
        customerId ? Number(customerId) : null,
        cashierId ? Number(cashierId) : null,
        payment.method,
        grossTotal,
        normalizedDiscount,
        subtotal,
        payment.amountPaid,
        payment.change,
        profit,
        paystackReference,
        paystackTransactionId ? String(paystackTransactionId) : null,
      ],
    );

    const sale = mapSaleRow(saleRows[0]);

    for (const item of saleItems) {
      await client.query(
        `
          INSERT INTO sale_items (
            sale_id, product_id, product_name, barcode, quantity,
            unit_price, unit_cost, line_total, cost_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          sale.id,
          item.productId,
          item.name,
          item.barcode,
          item.quantity,
          item.unitPrice,
          item.unitCost,
          item.lineTotal,
          item.costTotal,
        ],
      );

      await client.query("UPDATE products SET stock = stock - $2 WHERE id = $1", [
        item.productId,
        item.quantity,
      ]);

      await client.query(
        `
          INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_sale_id, created_by, notes)
          VALUES ($1, 'sale', $2, $3, $4, $5)
        `,
        [
          item.productId,
          -item.quantity,
          sale.id,
          cashierId ? Number(cashierId) : null,
          `Sale ${sale.receiptNumber}`,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      ...sale,
      items: saleItems,
      payment,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
