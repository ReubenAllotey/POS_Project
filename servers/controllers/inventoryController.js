import { addInventoryStock, getInventoryList } from "../models/inventoryModel.js";

export async function getInventoryPage(req, res) {
  const inventory = await getInventoryList();

  return res.render("inventory/inventory", {
    title: "Inventory",
    pageTitle: "Inventory",
    inventory,
  });
}

export async function restockProductApi(req, res) {
  try {
    const { productId, quantity } = req.body;
    const product = await addInventoryStock(productId, quantity);
    return res.json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
