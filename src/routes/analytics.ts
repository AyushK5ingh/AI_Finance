// Analytics Routes - Define API endpoints for comprehensive financial analytics
import { Router } from "express";
import AnalyticsController from "../controllers/AnalyticsController";
import { authenticateToken, rateLimitByUser } from "../middleware/auth";

const router = Router();
const analyticsController = new AnalyticsController();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(rateLimitByUser(200)); // Higher limit for analytics (200 requests per minute per user)

// Dashboard & Overview Analytics
router.get("/dashboard", analyticsController.getDashboard);
router.get("/financial-health", analyticsController.getFinancialHealth);

// Spending Analytics
router.get("/spending/insights", analyticsController.getSpendingInsights);
router.get("/spending/trends", analyticsController.getSpendingTrends);
router.get("/spending/categories", analyticsController.getCategoryBreakdown);

// Budget Analytics
router.get("/budgets/comparison", analyticsController.getBudgetComparison);

// Goal Analytics
router.get("/goals/analytics", analyticsController.getGoalAnalytics);

// Transaction Analytics
router.get(
  "/transactions/analytics",
  analyticsController.getTransactionAnalytics
);

// Time-based Analytics
router.get(
  "/monthly-summary/:year/:month",
  analyticsController.getMonthlySummary
);
router.post("/period-comparison", analyticsController.getPeriodComparison);

export default router;
