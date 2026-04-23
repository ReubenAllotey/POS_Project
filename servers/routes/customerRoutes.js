import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createCustomerApi,
  deleteCustomerApi,
  getCustomersPage,
  listCustomersApi,
  updateCustomerApi,
} from "../controllers/customerController.js";

const router = express.Router();

router.get("/customers", requireAuth, getCustomersPage);
router.get("/api/customers", requireAuth, listCustomersApi);
router.post("/api/customers", requireAuth, createCustomerApi);
router.put("/api/customers/:id", requireAuth, updateCustomerApi);
router.delete("/api/customers/:id", requireAuth, deleteCustomerApi);

export default router;
