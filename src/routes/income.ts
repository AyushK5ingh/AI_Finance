// Income Routes - Define API endpoints for income management
import { Router } from "express";
import IncomeController from "../controllers/IncomeController";
import { authenticateToken, rateLimitByUser } from "../middleware/auth";

const router = Router();
const incomeController = new IncomeController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Apply rate limiting (100 requests per minute)
router.use(rateLimitByUser(100));

// Income sources management (must come before :id routes)
router.get("/sources", incomeController.getSources);
router.post("/sources", incomeController.createSource);
router.put("/sources/:id", incomeController.updateSource);
router.delete("/sources/:id", incomeController.deleteSource);

// Analytics and summaries
router.get("/summary", incomeController.getIncomeSummary);

// Income CRUD operations
router.post("/", incomeController.createIncome);
router.get("/", incomeController.getIncomes);
router.get("/:id", incomeController.getIncome);
router.put("/:id", incomeController.updateIncome);
router.delete("/:id", incomeController.deleteIncome);

export default router;
