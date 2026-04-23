import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createProductApi,
  deleteProductApi,
  getProductsPage,
  listProductsApi,
  updateProductApi,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/products", requireAuth, getProductsPage);
router.get("/api/products", requireAuth, listProductsApi);
router.post("/api/products", requireAuth, createProductApi);
router.put("/api/products/:id", requireAuth, updateProductApi);
router.delete("/api/products/:id", requireAuth, deleteProductApi);

export default router;
