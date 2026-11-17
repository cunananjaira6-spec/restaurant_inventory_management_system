
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcrypt";
import { User, sequelize } from "../models/userModel.js";
import { Category, InventoryItem, ensureDefaultCategories } from "../models/Inventory.js";
await sequelize.sync({ alter: true });

export const loginPage = (req, res) => res.render("login", { title: "Login" });
export const registerPage = (req, res) => res.render("register", { title: "Register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });
export const dashboardPage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const [user, items, categories] = await Promise.all([
      User.findByPk(req.session.userId),
      InventoryItem.findAll({ include: Category, order: [["updatedAt", "DESC"]] }),
      ensureDefaultCategories()
    ]);

    const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
    const lowStockItems = items.filter(item => item.quantity <= item.reorderLevel);
    const stockValue = items.reduce((total, item) => total + item.quantity * Number(item.unitPrice), 0);
    const totalItems = items.length;
    const categoryColors = ["category-purple", "category-green", "category-orange", "category-blue", "category-pink", "category-yellow"];
    const categoryBreakdown = categories
      .map((category, index) => {
        const categoryItems = items.filter(item => item.categoryId === category.id);
        return {
          name: category.name,
          itemCount: categoryItems.length,
          units: categoryItems.reduce((total, item) => total + item.quantity, 0),
          percentage: totalItems ? Math.round(categoryItems.length / totalItems * 100) : 0,
          colorClass: categoryColors[index % categoryColors.length]
        };
      })
      .filter(category => category.itemCount > 0);

    const now = new Date();
    const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
    const recentItems = items.slice(0, 5).map(item => {
      const status = item.quantity <= item.reorderLevel ? "Low stock" : "In stock";
      return {
        name: item.name,
        initial: item.name.trim().charAt(0).toUpperCase(),
        categoryName: item.Category?.name || "Uncategorized",
        quantity: item.quantity,
        unit: item.unit,
        status,
        statusClass: item.quantity <= item.reorderLevel ? "status-low" : "status-good",
        updatedAt: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(item.updatedAt)
      };
    });

    res.render("dashboard", {
      title: "Overview",
      userName: firstName,
      userInitial: firstName.charAt(0).toUpperCase(),
      greeting: now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening",
      today: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now),
      totalItems,
      totalUnits: totalUnits.toLocaleString("en-US"),
      stockValue: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(stockValue),
      lowStockCount: lowStockItems.length,
      recentItems,
      categories: categoryBreakdown,
      categoryCount: categories.length
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    res.status(500).send("Unable to load the dashboard right now.");
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.send("User not found");
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send("Incorrect password");
  req.session.userId = user.id;
  res.redirect("/dashboard");
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });
  req.session.userId = user.id;
  res.redirect("/dashboard");
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};
