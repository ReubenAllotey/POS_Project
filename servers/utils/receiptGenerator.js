export function buildReceiptViewModel({ sale, customer, cashier }) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    createdAt: new Date(sale.createdAt).toLocaleString(),
    customerName: customer?.name || "Walk-in Customer",
    cashierName: cashier?.name || "System User",
    paymentMethod: sale.payment.method.toUpperCase(),
    grossTotal: sale.grossTotal ?? sale.subtotal,
    discountAmount: sale.discountAmount ?? 0,
    subtotal: sale.subtotal,
    amountPaid: sale.payment.amountPaid,
    change: sale.payment.change,
    items: sale.items,
  };
}
