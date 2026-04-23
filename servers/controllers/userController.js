import bcrypt from "bcrypt";
import {
  createUser,
  deleteUser,
  findUserByEmail,
  listUsers,
  updateUserStatus,
} from "../models/userModel.js";

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function getUsersPage(req, res) {
  const users = await listUsers();

  return res.render("users/users", {
    title: "Users",
    pageTitle: "Users",
    users: users.map(serializeUser),
  });
}

export async function createUserApi(req, res) {
  try {
    const { name, email, role, password } = req.body;

    if (!name || !email || !role || !password) {
      throw new Error("Name, email, role, and password are required.");
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error("A user with that email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email,
      role,
      passwordHash,
    });

    return res.status(201).json(serializeUser(user));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateUserStatusApi(req, res) {
  try {
    if (Number(req.params.id) === req.user?.id) {
      throw new Error("You cannot change your own status here.");
    }

    const user = await updateUserStatus(req.params.id, req.body.isActive);
    return res.json(serializeUser(user));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function deleteUserApi(req, res) {
  try {
    if (Number(req.params.id) === req.user?.id) {
      throw new Error("You cannot delete your own account.");
    }

    await deleteUser(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
