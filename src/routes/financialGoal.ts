// Financial Goal Routes - Define API endpoints for financial goals management
import { Router } from "express";
import FinancialGoalController from "../controllers/FinancialGoalController";
import { authenticateToken, rateLimitByUser } from "../middleware/auth";

const router = Router();
const goalController = new FinancialGoalController();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(rateLimitByUser(100)); // 100 requests per minute per user

// Financial Goal CRUD routes
router.post("/", goalController.createGoal);
router.get("/", goalController.getGoals);
router.get("/summary", goalController.getGoalSummary);
router.get("/progress", goalController.getAllGoalProgress);
router.get("/:id", goalController.getGoal);
router.put("/:id", goalController.updateGoal);
router.delete("/:id", goalController.deleteGoal);
router.put("/:id/progress", goalController.updateGoalProgress);
router.get("/:id/progress", goalController.getGoalProgress);
router.put("/:id/complete", goalController.markGoalAchieved);

export default router;
