import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createSaleApi,
  getMomoAuthorizePage,
  getMomoPage,
  getPosPage,
  getReceiptPage,
  handlePaystackCallback,
  initializePaystackPaymentApi,
  startMomoChargeApi,
  submitMomoAuthStepApi,
  checkMomoChargeStatusApi,
} from "../controllers/salesController.js";

const router = express.Router();

router.get("/pos", requireAuth, getPosPage);
router.get("/pos/momo", requireAuth, getMomoPage);
router.get("/pos/momo/authorize", requireAuth, getMomoAuthorizePage);
router.post("/api/sales", requireAuth, createSaleApi);
router.post("/api/payments/paystack/initialize", requireAuth, initializePaystackPaymentApi);
router.post("/api/payments/paystack/momo/start", requireAuth, startMomoChargeApi);
router.post("/api/payments/paystack/momo/submit", requireAuth, submitMomoAuthStepApi);
router.get("/api/payments/paystack/momo/check/:reference", requireAuth, checkMomoChargeStatusApi);
router.get("/payments/paystack/callback", handlePaystackCallback);
router.get("/receipts/:id", requireAuth, getReceiptPage);

export default router;
