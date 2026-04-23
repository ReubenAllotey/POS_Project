import { listProducts, restockProduct } from "./productModel.js";

export async function getInventoryList() {
  return listProducts();
}

export async function addInventoryStock(productId, quantity) {
  return restockProduct(productId, quantity);
}
