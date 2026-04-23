export function buildPayment({ method = "cash", amountPaid, subtotal }) {
  const paid = Number(amountPaid);
  const total = Number(subtotal);

  if (!Number.isFinite(paid) || paid < total) {
    throw new Error("Amount paid must be at least the order total.");
  }

  return {
    method: String(method || "cash").trim().toLowerCase(),
    amountPaid: Number(paid.toFixed(2)),
    change: Number((paid - total).toFixed(2)),
  };
}
