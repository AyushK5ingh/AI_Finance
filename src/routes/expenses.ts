// Expense Routes - Define API endpoints for expense management
import { Router } from "express";
import ExpenseController from "../controllers/ExpenseController";
import { authenticateToken, rateLimitByUser } from "../middleware/auth";

const router = Router();
const expenseController = new ExpenseController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Apply rate limiting (100 requests per minute)
router.use(rateLimitByUser(100));

// Category management (must come before :id routes)
router.get("/categories", expenseController.getCategories);
router.post("/categories", expenseController.createCategory);

// Analytics and summaries
router.get("/summary/spending", expenseController.getSpendingSummary);

// Expense CRUD operations
router.post("/", expenseController.createExpense);
router.get("/", expenseController.getExpenses);
router.get("/:id", expenseController.getExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

export default router;
