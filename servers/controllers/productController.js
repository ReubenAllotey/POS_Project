import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../models/productModel.js";

export async function getProductsPage(req, res) {
  const products = await listProducts();

  return res.render("products/products", {
    title: "Products",
    pageTitle: "Products",
    products,
  });
}

export async function listProductsApi(req, res) {
  const products = await listProducts({ search: req.query.search });
  return res.json(products);
}

export async function createProductApi(req, res) {
  try {
    const product = await createProduct(req.body);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateProductApi(req, res) {
  try {
    const product = await updateProduct(req.params.id, req.body);
    return res.json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function deleteProductApi(req, res) {
  try {
    await deleteProduct(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
