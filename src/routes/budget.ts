// Budget Routes - Define API endpoints for budget management
import { Router } from "express";
import BudgetController from "../controllers/BudgetController";
import { authenticateToken, rateLimitByUser } from "../middleware/auth";

const router = Router();
const budgetController = new BudgetController();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(rateLimitByUser(100)); // 100 requests per minute per user

// Budget CRUD routes
router.post("/", budgetController.createBudget);
router.get("/", budgetController.getBudgets);
router.get("/summary", budgetController.getBudgetSummary);
router.get("/spending", budgetController.getAllBudgetSpending);
router.get("/:id", budgetController.getBudget);
router.put("/:id", budgetController.updateBudget);
router.delete("/:id", budgetController.deleteBudget);
router.get("/:id/spending", budgetController.getBudgetSpending);

export default router;
