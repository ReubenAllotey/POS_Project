export function buildSaleItems(items, products) {
  return items.map((item) => {
    const product = products.find((candidate) => candidate.id === Number(item.productId));
    if (!product) {
      throw new Error(`Product ${item.productId} was not found.`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity supplied for ${product.name}.`);
    }

    if (product.stock < quantity) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }

    const unitPrice = Number(product.price);
    const unitCost = Number(product.cost ?? 0);

    return {
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      quantity,
      unitPrice,
      unitCost,
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
      costTotal: Number((unitCost * quantity).toFixed(2)),
    };
  });
}
