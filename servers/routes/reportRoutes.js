import express from "express";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  getDashboardPage,
  getInventoryReportPage,
  getSalesReportPage,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/auth/login");
  }

  return res.redirect("/dashboard");
});
router.get("/dashboard", requireAuth, getDashboardPage);
router.get(
  "/reports/sales",
  requireAuth,
  authorizeRoles("admin", "manager"),
  getSalesReportPage,
);
router.get(
  "/reports/inventory",
  requireAuth,
  authorizeRoles("admin", "manager"),
  getInventoryReportPage,
);

export default router;
