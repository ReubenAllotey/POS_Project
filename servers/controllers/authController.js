import bcrypt from "bcrypt";
import { createUser, findUserByEmail, listUsers } from "../models/userModel.js";

function renderAuthView(res, view, title, extra = {}) {
  return res.render(view, {
    title,
    error: "",
    formData: {},
    ...extra,
  });
}

export async function getLoginPage(req, res) {
  if (req.user) {
    return res.redirect("/dashboard");
  }

  return renderAuthView(res, "Auth/login", "Login");
}

export async function getRegisterPage(req, res) {
  if (req.user) {
    return res.redirect("/dashboard");
  }

  return renderAuthView(res, "Auth/register", "Register");
}

export async function registerUser(req, res) {
  const { name, email, password, confirmPassword, role } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return renderAuthView(res, "Auth/register", "Register", {
      error: "Please fill in all required fields.",
      formData: req.body,
    });
  }

  if (password !== confirmPassword) {
    return renderAuthView(res, "Auth/register", "Register", {
      error: "Passwords do not match.",
      formData: req.body,
    });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return renderAuthView(res, "Auth/register", "Register", {
      error: "An account with that email already exists.",
      formData: req.body,
    });
  }

  const userCount = (await listUsers()).length;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    name,
    email,
    passwordHash,
    role: userCount === 0 ? "admin" : role,
  });

  res.cookie("pos_user_id", String(user.id), { httpOnly: true, sameSite: "lax" });
  return res.redirect("/dashboard");
}

export async function loginUser(req, res) {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    return renderAuthView(res, "Auth/login", "Login", {
      error: "Invalid email or password.",
      formData: { email },
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return renderAuthView(res, "Auth/login", "Login", {
      error: "Invalid email or password.",
      formData: { email },
    });
  }

  if (!user.isActive) {
    return renderAuthView(res, "Auth/login", "Login", {
      error: "This account is inactive. Please contact an admin.",
      formData: { email },
    });
  }

  res.cookie("pos_user_id", String(user.id), { httpOnly: true, sameSite: "lax" });
  return res.redirect("/dashboard");
}

export function logoutUser(req, res) {
  res.clearCookie("pos_user_id");
  return res.redirect("/auth/login");
}
