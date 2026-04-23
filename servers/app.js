import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { attachCurrentUser } from "./middlewares/authMiddleware.js";
import { initializeDatabase } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

await initializeDatabase();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "../views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.pageTitle = "";
  next();
});
app.use(attachCurrentUser);

app.use(authRoutes);
app.use(reportRoutes);
app.use(productRoutes);
app.use(customerRoutes);
app.use(inventoryRoutes);
app.use(salesRoutes);
app.use(userRoutes);

app.use((req, res) => {
  res.status(404).render("Auth/login", {
    title: "Not Found",
    error: "That page could not be found.",
    formData: {},
  });
});

export default app;
