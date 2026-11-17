import { Category, InventoryItem, ensureDefaultCategories } from "../models/Inventory.js";
import { User } from "../models/userModel.js";

const allowedUnits = new Set(["units", "kg", "g", "L", "mL", "packs", "cases"]);

class InputError extends Error {}

const getProductView = item => {
  const lowStock = item.quantity <= item.reorderLevel;
  return {
    id: item.id,
    name: item.name,
    initial: item.name.trim().charAt(0).toUpperCase(),
    sku: `MIS-${String(item.id).padStart(4, "0")}`,
    categoryName: item.Category?.name || "Uncategorized",
    categoryId: item.categoryId,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(item.unitPrice)),
    rawUnitPrice: Number(item.unitPrice).toFixed(2),
    reorderLevel: item.reorderLevel,
    status: lowStock ? "Low stock" : "In stock",
    statusClass: lowStock ? "status-low" : "status-good"
  };
};

const getPageData = async (req, res) => {
  const categories = await ensureDefaultCategories();
  const allItems = await InventoryItem.findAll({ include: Category, order: [["updatedAt", "DESC"]] });
  const categoryId = Number.parseInt(req.query.category, 10);
  const searchValue = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const search = searchValue.toLocaleLowerCase();
  const status = req.query.status === "low" || req.query.status === "in-stock" ? req.query.status : "";
  const shownItems = allItems.filter(item => {
    if (search && !item.name.toLocaleLowerCase().includes(search)) return false;
    if (Number.isInteger(categoryId) && categoryId > 0 && item.categoryId !== categoryId) return false;
    if (status === "low" && item.quantity > item.reorderLevel) return false;
    if (status === "in-stock" && item.quantity <= item.reorderLevel) return false;
    return true;
  });
  const activeFilters = Boolean(search || (Number.isInteger(categoryId) && categoryId > 0) || status);
  const lowStockCount = allItems.filter(item => item.quantity <= item.reorderLevel).length;
  const selectedCategory = Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
  const filters = {
    q: searchValue,
    low: status === "low",
    inStock: status === "in-stock",
    active: activeFilters
  };
  const emptyTitle = activeFilters ? "No matching products" : "No products yet";
  const emptyMessage = activeFilters
    ? "Try a different search or remove one of your filters."
    : "Add your first product to start keeping track of your stock.";
  const now = new Date();
  const user = await User.findByPk(req.session.userId);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  res.render("inventory", {
    title: "Inventory",
    items: shownItems.map(getProductView),
    allCategories: categories.map(category => ({
      id: category.id,
      name: category.name,
      selected: category.id === selectedCategory
    })),
    totalItems: allItems.length,
    totalUnits: allItems.reduce((total, item) => total + item.quantity, 0).toLocaleString("en-US"),
    lowStockCount,
    shownCount: shownItems.length,
    filters,
    emptyTitle,
    emptyMessage,
    userInitial: firstName.charAt(0).toUpperCase(),
    today: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now)
  });
};

export const getInventoryPage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    await getPageData(req, res);
  } catch (error) {
    console.error("Failed to load inventory:", error);
    res.status(500).send("Unable to load inventory right now.");
  }
};

const validateItemInput = async (body) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const quantityValue = body.quantity;
  const unitPriceValue = body.unitPrice;
  const reorderLevelValue = body.reorderLevel;
  const hasNumberValue = value => (typeof value === "number" || typeof value === "string") &&
    !(typeof value === "string" && value.trim() === "");
  const quantity = Number(quantityValue);
  const unitPrice = Number(unitPriceValue);
  const reorderLevel = Number(reorderLevelValue);
  const categoryId = Number(body.categoryId);
  const unit = body.unit === undefined ? "units" : body.unit;

  if (!name || name.length > 120) throw new InputError("Enter a product name up to 120 characters.");
  if (!hasNumberValue(quantityValue) || !Number.isInteger(quantity) || quantity < 0) throw new InputError("Quantity must be a whole number of zero or more.");
  if (!hasNumberValue(unitPriceValue) || !Number.isFinite(unitPrice) || unitPrice < 0) throw new InputError("Unit cost must be a valid amount of zero or more.");
  if (!hasNumberValue(reorderLevelValue) || !Number.isInteger(reorderLevel) || reorderLevel < 0) throw new InputError("Reorder point must be a whole number of zero or more.");
  if (!Number.isInteger(categoryId) || categoryId < 1 || !await Category.findByPk(categoryId)) throw new InputError("Choose a valid category.");
  if (typeof unit !== "string" || !allowedUnits.has(unit)) throw new InputError("Choose a valid unit.");

  return { name, quantity, unitPrice, reorderLevel, categoryId, unit };
};

export const addInventoryItem = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const values = await validateItemInput(req.body);
    await InventoryItem.create(values);
    req.flash("success_msg", "Product added to your inventory.");
    res.redirect("/inventory");
  } catch (error) {
    if (error instanceof InputError) {
      req.flash("error_msg", error.message);
    } else {
      console.error("Failed to add inventory item:", error);
      req.flash("error_msg", "Unable to add this product. Please try again.");
    }
    res.redirect("/inventory");
  }
};

export const updateInventoryItem = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) throw new InputError("This product could not be found.");
    const item = await InventoryItem.findByPk(id);
    if (!item) throw new InputError("This product could not be found.");
    await item.update(await validateItemInput(req.body));
    req.flash("success_msg", "Product updated.");
    res.redirect("/inventory");
  } catch (error) {
    if (error instanceof InputError) {
      req.flash("error_msg", error.message);
    } else {
      console.error("Failed to update inventory item:", error);
      req.flash("error_msg", "Unable to update this product. Please try again.");
    }
    res.redirect("/inventory");
  }
};

export const deleteInventoryItem = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) throw new InputError("This product could not be found.");
    const deleted = await InventoryItem.destroy({ where: { id } });
    if (!deleted) {
      throw new InputError("This product could not be found.");
    } else {
      req.flash("success_msg", "Product removed from your inventory.");
    }
  } catch (error) {
    if (error instanceof InputError) {
      req.flash("error_msg", error.message);
    } else {
      console.error("Failed to delete inventory item:", error);
      req.flash("error_msg", "Unable to delete this product. Please try again.");
    }
  }
  res.redirect("/inventory");
};
