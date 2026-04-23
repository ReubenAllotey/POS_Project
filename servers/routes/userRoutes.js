import express from "express";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createUserApi,
  deleteUserApi,
  getUsersPage,
  updateUserStatusApi,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/users", requireAuth, authorizeRoles("admin", "manager"), getUsersPage);
router.post("/api/users", requireAuth, authorizeRoles("admin", "manager"), createUserApi);
router.patch("/api/users/:id/status", requireAuth, authorizeRoles("admin", "manager"), updateUserStatusApi);
router.delete("/api/users/:id", requireAuth, authorizeRoles("admin", "manager"), deleteUserApi);

export default router;
