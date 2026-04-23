import { listCustomers } from "../models/customerModel.js";
import { listLowStockProducts, listProducts } from "../models/productModel.js";
import { listSales } from "../models/salesModel.js";

function isSameLocalDate(dateLeft, dateRight) {
  return dateLeft.getFullYear() === dateRight.getFullYear() &&
    dateLeft.getMonth() === dateRight.getMonth() &&
    dateLeft.getDate() === dateRight.getDate();
}

function getWeekStart(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function calculateDashboardStats({ sales, products, customers, lowStockProducts }) {
  const now = new Date();
  const todaySales = sales.filter((sale) => isSameLocalDate(new Date(sale.createdAt), now));
  const weekStart = getWeekStart(now);
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisWeekSales = sales.filter((sale) => new Date(sale.createdAt) >= weekStart);
  const thisMonthSales = sales.filter((sale) => {
    const saleDate = new Date(sale.createdAt);
    return saleDate.getMonth() === month && saleDate.getFullYear() === year;
  });

  return {
    todayRevenue: Number(todaySales.reduce((sum, sale) => sum + sale.subtotal, 0).toFixed(2)),
    todayProfit: Number(todaySales.reduce((sum, sale) => sum + sale.profit, 0).toFixed(2)),
    todayTransactions: todaySales.length,
    lowStockItems: lowStockProducts.length,
    totalCustomers: customers.length,
    weekRevenue: Number(thisWeekSales.reduce((sum, sale) => sum + sale.subtotal, 0).toFixed(2)),
    monthRevenue: Number(thisMonthSales.reduce((sum, sale) => sum + sale.subtotal, 0).toFixed(2)),
    totalProducts: products.length,
  };
}

export async function getDashboardPage(req, res) {
  const [sales, products, customers, lowStockProducts] = await Promise.all([
    listSales(),
    listProducts(),
    listCustomers(),
    listLowStockProducts(),
  ]);

  return res.render("Dashboard/dashboard", {
    title: "Dashboard",
    pageTitle: "Dashboard",
    stats: calculateDashboardStats({ sales, products, customers, lowStockProducts }),
    lowStockProducts: lowStockProducts.slice(0, 5),
    recentSales: sales.slice(0, 5),
  });
}

export async function getSalesReportPage(req, res) {
  const sales = await listSales();

  return res.render("reports/salesReport", {
    title: "Sales Report",
    pageTitle: "Sales Report",
    sales,
  });
}

export async function getInventoryReportPage(req, res) {
  const products = await listProducts();

  return res.render("reports/inventoryReport", {
    title: "Inventory Report",
    pageTitle: "Inventory Report",
    products,
  });
}
