// Expense Controller - Handle expense-related HTTP requests
import { Request, Response } from "express";
import ExpenseModel, {
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilters,
} from "../models/Expense";
import Joi from "joi";

// Validation schemas
const createExpenseSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  amount: Joi.number().positive().precision(2).required(),
  description: Joi.string().max(1000).optional(),
  location: Joi.string().max(255).optional(),
  merchant: Joi.string().max(255).optional(),
  paymentMethod: Joi.string()
    .valid("cash", "card", "upi", "wallet", "bank_transfer", "other")
    .optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  expenseDate: Joi.date().iso().optional(),
});

const updateExpenseSchema = Joi.object({
  categoryId: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(255).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  description: Joi.string().max(1000).allow("").optional(),
  location: Joi.string().max(255).allow("").optional(),
  merchant: Joi.string().max(255).allow("").optional(),
  paymentMethod: Joi.string()
    .valid("cash", "card", "upi", "wallet", "bank_transfer", "other")
    .optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  expenseDate: Joi.date().iso().optional(),
});

const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: Joi.string().max(50).optional(),
  budgetLimit: Joi.number().positive().precision(2).optional(),
});

export class ExpenseController {
  private expenseModel: ExpenseModel;

  constructor() {
    this.expenseModel = new ExpenseModel();
  }

  // Create a new expense
  createExpense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Validate request body
      const { error, value } = createExpenseSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if category exists and user has access to it
      const category = await this.expenseModel.getCategoryById(
        userId,
        value.categoryId
      );
      if (!category) {
        res.status(404).json({
          success: false,
          message: "Category not found or access denied",
        });
        return;
      }

      // Create expense
      const expenseData: CreateExpenseData = {
        ...value,
        expenseDate: value.expenseDate
          ? new Date(value.expenseDate)
          : new Date(),
      };

      const expense = await this.expenseModel.create(userId, expenseData);

      // Get expense with category info
      const expenseWithCategory = await this.expenseModel.findById(
        userId,
        expense.id
      );

      res.status(201).json({
        success: true,
        data: expenseWithCategory,
        message: "Expense created successfully",
      });
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get expenses with pagination and filters
  getExpenses = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items per page
      const sortBy = (req.query.sortBy as string) || "expense_date";
      const sortOrder =
        (req.query.sortOrder as string)?.toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";

      // Build filters
      const filters: ExpenseFilters = {};

      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string;
      }

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      if (req.query.minAmount) {
        filters.minAmount = parseFloat(req.query.minAmount as string);
      }

      if (req.query.maxAmount) {
        filters.maxAmount = parseFloat(req.query.maxAmount as string);
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.paymentMethod) {
        filters.paymentMethod = req.query.paymentMethod as string;
      }

      if (req.query.merchant) {
        filters.merchant = req.query.merchant as string;
      }

      if (req.query.tags) {
        const tagsString = req.query.tags as string;
        filters.tags = tagsString.split(",").map((tag) => tag.trim());
      }

      // Get expenses
      const result = await this.expenseModel.findByUser(
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
          expenses: result.expenses,
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
      console.error("Error getting expenses:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get a single expense by ID
  getExpense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const expenseId = req.params.id;

      // Validate expense ID format
      if (
        !expenseId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid expense ID format",
        });
        return;
      }

      const expense = await this.expenseModel.findById(userId, expenseId);

      if (!expense) {
        res.status(404).json({
          success: false,
          message: "Expense not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: expense,
      });
    } catch (error) {
      console.error("Error getting expense:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update an expense
  updateExpense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const expenseId = req.params.id;

      // Validate expense ID format
      if (
        !expenseId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid expense ID format",
        });
        return;
      }

      // Validate request body
      const { error, value } = updateExpenseSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if expense exists
      const existingExpense = await this.expenseModel.findById(
        userId,
        expenseId
      );
      if (!existingExpense) {
        res.status(404).json({
          success: false,
          message: "Expense not found",
        });
        return;
      }

      // If categoryId is being updated, check if the new category exists
      if (value.categoryId) {
        const category = await this.expenseModel.getCategoryById(
          userId,
          value.categoryId
        );
        if (!category) {
          res.status(404).json({
            success: false,
            message: "Category not found or access denied",
          });
          return;
        }
      }

      // Update expense
      const updateData: UpdateExpenseData = {
        ...value,
        expenseDate: value.expenseDate
          ? new Date(value.expenseDate)
          : undefined,
      };

      const updatedExpense = await this.expenseModel.update(
        userId,
        expenseId,
        updateData
      );

      if (!updatedExpense) {
        res.status(404).json({
          success: false,
          message: "Expense not found",
        });
        return;
      }

      // Get updated expense with category info
      const expenseWithCategory = await this.expenseModel.findById(
        userId,
        updatedExpense.id
      );

      res.status(200).json({
        success: true,
        data: expenseWithCategory,
        message: "Expense updated successfully",
      });
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Delete an expense
  deleteExpense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const expenseId = req.params.id;

      // Validate expense ID format
      if (
        !expenseId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid expense ID format",
        });
        return;
      }

      const deleted = await this.expenseModel.delete(userId, expenseId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Expense not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Expense deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get expense categories
  getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const categories = await this.expenseModel.getCategories(userId);

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Create a custom category
  createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Validate request body
      const { error, value } = createCategorySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const category = await this.expenseModel.createCategory(userId, value);

      res.status(201).json({
        success: true,
        data: category,
        message: "Category created successfully",
      });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get spending summary by category
  getSpendingSummary = async (req: Request, res: Response): Promise<void> => {
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

      // Default to current month if no dates provided
      if (!startDate && !endDate) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const summary = await this.expenseModel.getSpendingSummary(
        userId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        data: {
          summary,
          period: {
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error("Error getting spending summary:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export default ExpenseController;
