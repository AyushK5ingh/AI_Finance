// Income Controller - Handle income-related HTTP requests
import { Request, Response } from "express";
import IncomeModel, {
  CreateIncomeData,
  UpdateIncomeData,
  CreateIncomeSourceData,
  UpdateIncomeSourceData,
  IncomeFilters,
} from "../models/Income";
import Joi from "joi";

// Validation schemas
const createIncomeSchema = Joi.object({
  sourceId: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(255).required(),
  amount: Joi.number().positive().precision(2).required(),
  description: Joi.string().max(1000).optional(),
  isRecurring: Joi.boolean().optional(),
  incomeDate: Joi.date().iso().optional(),
});

const updateIncomeSchema = Joi.object({
  sourceId: Joi.string().uuid().allow(null).optional(),
  name: Joi.string().min(1).max(255).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  description: Joi.string().max(1000).allow("").optional(),
  isRecurring: Joi.boolean().optional(),
  incomeDate: Joi.date().iso().optional(),
});

const createIncomeSourceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  sourceType: Joi.string()
    .valid("salary", "freelance", "business", "investment", "rental", "other")
    .required(),
  isRecurring: Joi.boolean().optional(),
  recurringDay: Joi.number().integer().min(1).max(31).optional(),
});

const updateIncomeSourceSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  sourceType: Joi.string()
    .valid("salary", "freelance", "business", "investment", "rental", "other")
    .optional(),
  isRecurring: Joi.boolean().optional(),
  recurringDay: Joi.number().integer().min(1).max(31).allow(null).optional(),
});

export class IncomeController {
  private incomeModel: IncomeModel;

  constructor() {
    this.incomeModel = new IncomeModel();
  }

  // Create a new income entry
  createIncome = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Validate request body
      const { error, value } = createIncomeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if source exists and user has access to it (if sourceId provided)
      if (value.sourceId) {
        const source = await this.incomeModel.getSourceById(
          userId,
          value.sourceId
        );
        if (!source) {
          res.status(404).json({
            success: false,
            message: "Income source not found or access denied",
          });
          return;
        }
      }

      // Create income
      const incomeData: CreateIncomeData = {
        ...value,
        incomeDate: value.incomeDate ? new Date(value.incomeDate) : new Date(),
      };

      const income = await this.incomeModel.create(userId, incomeData);

      // Get income with source info
      const incomeWithSource = await this.incomeModel.findById(
        userId,
        income.id
      );

      res.status(201).json({
        success: true,
        data: incomeWithSource,
        message: "Income entry created successfully",
      });
    } catch (error) {
      console.error("Error creating income:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get income entries with pagination and filters
  getIncomes = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const sortBy = (req.query.sortBy as string) || "income_date";
      const sortOrder =
        (req.query.sortOrder as string)?.toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";

      // Build filters
      const filters: IncomeFilters = {};

      if (req.query.sourceId) {
        filters.sourceId = req.query.sourceId as string;
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

      if (req.query.sourceType) {
        filters.sourceType = req.query.sourceType as string;
      }

      if (req.query.isRecurring !== undefined) {
        filters.isRecurring = req.query.isRecurring === "true";
      }

      // Get income entries
      const result = await this.incomeModel.findByUser(
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
          income: result.income,
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
      console.error("Error getting income:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get a single income entry by ID
  getIncome = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const incomeId = req.params.id;

      // Validate income ID format
      if (
        !incomeId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid income ID format",
        });
        return;
      }

      const income = await this.incomeModel.findById(userId, incomeId);

      if (!income) {
        res.status(404).json({
          success: false,
          message: "Income entry not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: income,
      });
    } catch (error) {
      console.error("Error getting income:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update an income entry
  updateIncome = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const incomeId = req.params.id;

      // Validate income ID format
      if (
        !incomeId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid income ID format",
        });
        return;
      }

      // Validate request body
      const { error, value } = updateIncomeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if income exists
      const existingIncome = await this.incomeModel.findById(userId, incomeId);
      if (!existingIncome) {
        res.status(404).json({
          success: false,
          message: "Income entry not found",
        });
        return;
      }

      // If sourceId is being updated, check if the new source exists
      if (value.sourceId) {
        const source = await this.incomeModel.getSourceById(
          userId,
          value.sourceId
        );
        if (!source) {
          res.status(404).json({
            success: false,
            message: "Income source not found or access denied",
          });
          return;
        }
      }

      // Update income
      const updateData: UpdateIncomeData = {
        ...value,
        incomeDate: value.incomeDate ? new Date(value.incomeDate) : undefined,
      };

      const updatedIncome = await this.incomeModel.update(
        userId,
        incomeId,
        updateData
      );

      if (!updatedIncome) {
        res.status(404).json({
          success: false,
          message: "Income entry not found",
        });
        return;
      }

      // Get updated income with source info
      const incomeWithSource = await this.incomeModel.findById(
        userId,
        updatedIncome.id
      );

      res.status(200).json({
        success: true,
        data: incomeWithSource,
        message: "Income entry updated successfully",
      });
    } catch (error) {
      console.error("Error updating income:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Delete an income entry
  deleteIncome = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const incomeId = req.params.id;

      // Validate income ID format
      if (
        !incomeId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid income ID format",
        });
        return;
      }

      const deleted = await this.incomeModel.delete(userId, incomeId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Income entry not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Income entry deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting income:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get income sources
  getSources = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const sources = await this.incomeModel.getSources(userId);

      res.status(200).json({
        success: true,
        data: sources,
      });
    } catch (error) {
      console.error("Error getting income sources:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Create a new income source
  createSource = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;

      // Validate request body
      const { error, value } = createIncomeSourceSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      const source = await this.incomeModel.createSource(userId, value);

      res.status(201).json({
        success: true,
        data: source,
        message: "Income source created successfully",
      });
    } catch (error) {
      console.error("Error creating income source:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update an income source
  updateSource = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const sourceId = req.params.id;

      // Validate source ID format
      if (
        !sourceId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid source ID format",
        });
        return;
      }

      // Validate request body
      const { error, value } = updateIncomeSourceSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
        return;
      }

      // Check if source exists
      const existingSource = await this.incomeModel.getSourceById(
        userId,
        sourceId
      );
      if (!existingSource) {
        res.status(404).json({
          success: false,
          message: "Income source not found",
        });
        return;
      }

      const updatedSource = await this.incomeModel.updateSource(
        userId,
        sourceId,
        value
      );

      if (!updatedSource) {
        res.status(404).json({
          success: false,
          message: "Income source not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updatedSource,
        message: "Income source updated successfully",
      });
    } catch (error) {
      console.error("Error updating income source:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Delete an income source
  deleteSource = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const sourceId = req.params.id;

      // Validate source ID format
      if (
        !sourceId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid source ID format",
        });
        return;
      }

      const deleted = await this.incomeModel.deleteSource(userId, sourceId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Income source not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Income source deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting income source:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Get income summary by source
  getIncomeSummary = async (req: Request, res: Response): Promise<void> => {
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

      const summary = await this.incomeModel.getIncomeSummary(
        userId,
        startDate,
        endDate
      );
      const totalIncome = await this.incomeModel.getTotalIncome(
        userId,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        data: {
          summary,
          totalIncome,
          period: {
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error("Error getting income summary:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export default IncomeController;
