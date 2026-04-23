import express from "express";
import {
  getLoginPage,
  getRegisterPage,
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/auth/login", getLoginPage);
router.post("/auth/login", loginUser);
router.get("/auth/register", getRegisterPage);
router.post("/auth/register", registerUser);
router.post("/auth/logout", logoutUser);

export default router;
