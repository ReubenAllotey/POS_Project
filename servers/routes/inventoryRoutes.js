import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  getInventoryPage,
  restockProductApi,
} from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/inventory", requireAuth, getInventoryPage);
router.post("/api/inventory/restock", requireAuth, restockProductApi);

export default router;
