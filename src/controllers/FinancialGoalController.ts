// Financial Goal Controller - Handle financial goals HTTP requests
import { Request, Response } from "express";
import Joi from "joi";
import FinancialGoalModel, {
  CreateFinancialGoalData,
  UpdateFinancialGoalData,
  FinancialGoalFilters,
} from "../models/FinancialGoal";

// Validation schemas
const createGoalSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  goalType: Joi.string()
    .valid("savings", "debt_payoff", "investment", "emergency_fund", "custom")
    .optional(),
  targetAmount: Joi.number().positive().max(999999999).required(),
  currentAmount: Joi.number().min(0).max(999999999).optional(),
  targetDate: Joi.date().min("now").optional(),
  priority: Joi.number().integer().min(1).max(3).optional(), // 1 = high, 2 = medium, 3 = low
});

const updateGoalSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  goalType: Joi.string()
    .valid("savings", "debt_payoff", "investment", "emergency_fund", "custom")
    .optional(),
  targetAmount: Joi.number().positive().max(999999999).optional(),
  currentAmount: Joi.number().min(0).max(999999999).optional(),
  targetDate: Joi.date().min("now").optional(),
  priority: Joi.number().integer().min(1).max(3).optional(), // 1 = high, 2 = medium, 3 = low
});

const updateProgressSchema = Joi.object({
  amount: Joi.number().required(),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid(
      "createdAt",
      "targetDate",
      "targetAmount",
      "currentAmount",
      "priority",
      "name"
    )
    .default("createdAt"),
  sortOrder: Joi.string().valid("ASC", "DESC").default("DESC"),
  goalType: Joi.string()
    .valid("savings", "debt_payoff", "investment", "emergency_fund", "custom")
    .optional(),
  priority: Joi.number().integer().min(1).max(3).optional(),
  isAchieved: Joi.boolean().optional(),
  targetDateFrom: Joi.date().optional(),
  targetDateTo: Joi.date().optional(),
});

const uuidSchema = Joi.string().uuid().required();

export class FinancialGoalController {
  private goalModel: FinancialGoalModel;

  constructor() {
    this.goalModel = new FinancialGoalModel();
  }

  // Create a new financial goal
  createGoal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = createGoalSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const userId = (req as any).user.userId;
      const goalData: CreateFinancialGoalData = {
        ...value,
        targetDate: new Date(value.targetDate),
      };

      const goal = await this.goalModel.create(userId, goalData);

      res.status(201).json({
        success: true,
        data: goal,
        message: "Financial goal created successfully",
      });
    } catch (error) {
      console.error("Error creating financial goal:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get financial goals with pagination and filters
  getGoals = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = querySchema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const userId = (req as any).user.userId;
      const { page, limit, sortBy, sortOrder, ...filters } = value;

      // Convert date strings to Date objects
      const goalFilters: FinancialGoalFilters = {
        ...filters,
        targetDateFrom: filters.targetDateFrom
          ? new Date(filters.targetDateFrom)
          : undefined,
        targetDateTo: filters.targetDateTo
          ? new Date(filters.targetDateTo)
          : undefined,
      };

      const result = await this.goalModel.findByUser(
        userId,
        goalFilters,
        page,
        limit,
        sortBy,
        sortOrder
      );

      res.status(200).json({
        success: true,
        data: {
          goals: result.goals,
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
      console.error("Error getting financial goals:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get a specific financial goal
  getGoal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = uuidSchema.validate(req.params.id);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Invalid goal ID format",
        });
        return;
      }

      const userId = (req as any).user.userId;
      const goal = await this.goalModel.findById(userId, value);

      if (!goal) {
        res.status(404).json({
          success: false,
          message: "Financial goal not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: goal,
      });
    } catch (error) {
      console.error("Error getting financial goal:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update a financial goal
  updateGoal = async (req: Request, res: Response): Promise<void> => {
    try {
      const idValidation = uuidSchema.validate(req.params.id);
      if (idValidation.error) {
        res.status(400).json({
          success: false,
          message: "Invalid goal ID format",
        });
        return;
      }

      const { error, value } = updateGoalSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const userId = (req as any).user.userId;
      const goalId = idValidation.value;

      const updateData: UpdateFinancialGoalData = {
        ...value,
        targetDate: value.targetDate ? new Date(value.targetDate) : undefined,
      };

      const goal = await this.goalModel.update(userId, goalId, updateData);

      if (!goal) {
        res.status(404).json({
          success: false,
          message: "Financial goal not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: goal,
        message: "Financial goal updated successfully",
      });
    } catch (error) {
      console.error("Error updating financial goal:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Delete a financial goal
  deleteGoal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = uuidSchema.validate(req.params.id);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Invalid goal ID format",
        });
        return;
      }

      const userId = (req as any).user.userId;
      const deleted = await this.goalModel.delete(userId, value);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Financial goal not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Financial goal deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting financial goal:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update goal progress (add money towards goal)
  updateGoalProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const idValidation = uuidSchema.validate(req.params.id);
      if (idValidation.error) {
        res.status(400).json({
          success: false,
          message: "Invalid goal ID format",
        });
        return;
      }

      const { error, value } = updateProgressSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const userId = (req as any).user.userId;
      const goalId = idValidation.value;

      const goal = await this.goalModel.updateProgress(
        userId,
        goalId,
        value.amount
      );

      if (!goal) {
        res.status(404).json({
          success: false,
          message: "Financial goal not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: goal,
        message: "Goal progress updated successfully",
      });
    } catch (error) {
      console.error("Error updating goal progress:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get goal progress analysis
  getGoalProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const goalId = req.params.id;

      // Validate goalId if provided
      if (goalId) {
        const { error } = uuidSchema.validate(goalId);
        if (error) {
          res.status(400).json({
            success: false,
            message: "Invalid goal ID format",
          });
          return;
        }
      }

      const progress = await this.goalModel.getGoalProgress(userId, goalId);

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      console.error("Error getting goal progress:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get all goal progress analysis
  getAllGoalProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const progress = await this.goalModel.getGoalProgress(userId);

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      console.error("Error getting all goal progress:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get goal summary
  getGoalSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const summary = await this.goalModel.getGoalSummary(userId);

      res.status(200).json({
        success: true,
        data: {
          summary,
        },
      });
    } catch (error) {
      console.error("Error getting goal summary:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Mark goal as completed
  markGoalAchieved = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = uuidSchema.validate(req.params.id);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Invalid goal ID format",
        });
        return;
      }

      const userId = (req as any).user.userId;
      const goal = await this.goalModel.markAchieved(userId, value);

      if (!goal) {
        res.status(404).json({
          success: false,
          message: "Financial goal not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: goal,
        message: "Goal marked as achieved",
      });
    } catch (error) {
      console.error("Error marking goal as completed:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export default FinancialGoalController;
