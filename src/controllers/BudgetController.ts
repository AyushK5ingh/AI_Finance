// Budget Controller - Handle budget-related HTTP requests
import { Request, Response } from "express";
import BudgetModel, {
  CreateBudgetData,
  UpdateBudgetData,
  BudgetFilters,
} from "../models/Budget";
import Joi from "joi";

// Validation schemas
const createBudgetSchema = Joi.object({
  categoryId: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(255).required(),
  amount: Joi.number().positive().precision(2).required(),
  periodType: Joi.string()
    .valid("weekly", "monthly", "yearly", "custom")
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  alertThreshold: Joi.number().min(0).max(1).precision(2).optional(),
});

const updateBudgetSchema = Joi.object({
  categoryId: Joi.string().uuid().allow(null).optional(),
  name: Joi.string().min(1).max(255).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  periodType: Joi.string()
    .valid("weekly", "monthly", "yearly", "custom")
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().allow(null).optional(),
  alertThreshold: Joi.number().min(0).max(1).precision(2).optional(),
  isActive: Joi.boolean().optional(),
});

export class BudgetController {
  private budgetModel: BudgetModel;

  constructor() {
    this.budgetModel = new BudgetModel();
  }

  // Create a new budget
  createBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Validate request body
      const { error, value } = createBudgetSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Validate custom period has end date
      if (value.periodType === "custom" && !value.endDate) {
        res.status(400).json({
          success: false,
          message: "End date is required for custom period budgets",
        });
        return;
      }

      // Create budget
      const budgetData: CreateBudgetData = {
        ...value,
        startDate: value.startDate ? new Date(value.startDate) : new Date(),
        endDate: value.endDate ? new Date(value.endDate) : undefined,
      };

      const budget = await this.budgetModel.create(userId, budgetData);

      // Get budget with category info
      const budgetWithCategory = await this.budgetModel.findById(
        userId,
        budget.id
      );

      res.status(201).json({
        success: true,
        data: budgetWithCategory,
        message: "Budget created successfully",
      });
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get budgets with pagination and filters
  getBudgets = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const sortBy = (req.query.sortBy as string) || "created_at";
      const sortOrder =
        (req.query.sortOrder as string)?.toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";

      // Build filters
      const filters: BudgetFilters = {};

      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }

      if (req.query.periodType) {
        filters.periodType = req.query.periodType as string;
      }

      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === "true";
      }

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      // Get budgets
      const result = await this.budgetModel.findByUser(
        userId,
        filters,
        page,
        limit,
        sortBy,
        sortOrder
      );

      res.status(200).json({
        success: true,
        data: {
          budgets: result.budgets,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: result.totalPages,
            hasNextPage: page < result.totalPages,
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error getting budgets:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get a single budget by ID
  getBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const budgetId = req.params.id;

      // Validate budget ID format
      if (
        !budgetId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid budget ID format",
        });
        return;
      }

      const budget = await this.budgetModel.findById(userId, budgetId);

      if (!budget) {
        res.status(404).json({
          success: false,
          message: "Budget not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: budget,
      });
    } catch (error) {
      console.error("Error getting budget:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update a budget
  updateBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const budgetId = req.params.id;

      // Validate budget ID format
      if (
        !budgetId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid budget ID format",
        });
        return;
      }

      // Validate request body
      const { error, value } = updateBudgetSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if budget exists
      const existingBudget = await this.budgetModel.findById(userId, budgetId);
      if (!existingBudget) {
        res.status(404).json({
          success: false,
          message: "Budget not found",
        });
        return;
      }

      // Validate custom period has end date
      if (
        value.periodType === "custom" &&
        !value.endDate &&
        !existingBudget.endDate
      ) {
        res.status(400).json({
          success: false,
          message: "End date is required for custom period budgets",
        });
        return;
      }

      // Update budget
      const updateData: UpdateBudgetData = {
        ...value,
        startDate: value.startDate ? new Date(value.startDate) : undefined,
        endDate: value.endDate ? new Date(value.endDate) : undefined,
      };

      const updatedBudget = await this.budgetModel.update(
        userId,
        budgetId,
        updateData
      );

      if (!updatedBudget) {
        res.status(404).json({
          success: false,
          message: "Budget not found",
        });
        return;
      }

      // Get updated budget with category info
      const budgetWithCategory = await this.budgetModel.findById(
        userId,
        updatedBudget.id
      );

      res.status(200).json({
        success: true,
        data: budgetWithCategory,
        message: "Budget updated successfully",
      });
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Delete a budget
  deleteBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const budgetId = req.params.id;

      // Validate budget ID format
      if (
        !budgetId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid budget ID format",
        });
        return;
      }

      const deleted = await this.budgetModel.delete(userId, budgetId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Budget not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Budget deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get budget spending analysis
  getBudgetSpending = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const budgetId = req.params.id;

      // Validate budget ID format if provided
      if (
        budgetId &&
        !budgetId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid budget ID format",
        });
        return;
      }

      // Parse date filters
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }

      const spendingAnalysis = await this.budgetModel.getBudgetSpending(
        userId,
        budgetId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        data: spendingAnalysis,
      });
    } catch (error) {
      console.error("Error getting budget spending:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get all budget spending analysis
  getAllBudgetSpending = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Parse date filters
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }

      const spendingAnalysis = await this.budgetModel.getBudgetSpending(
        userId,
        undefined,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        data: spendingAnalysis,
      });
    } catch (error) {
      console.error("Error getting budget spending:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get budget summary
  getBudgetSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Parse month filter
      let month: Date | undefined;
      if (req.query.month) {
        month = new Date(req.query.month as string);
      }

      const summary = await this.budgetModel.getBudgetSummary(userId, month);

      res.status(200).json({
        success: true,
        data: {
          summary,
          period: {
            month: month ? month.toISOString() : new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error("Error getting budget summary:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export default BudgetController;
