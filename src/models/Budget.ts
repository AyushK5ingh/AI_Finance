// Budget Model - Handle budget data operations
import pool from "../config/database";

// Budget interfaces
export interface Budget {
  id: string;
  userId: string;
  categoryId?: string;
  name: string;
  amount: number;
  periodType: "weekly" | "monthly" | "yearly" | "custom";
  startDate: Date;
  endDate?: Date;
  alertThreshold: number;
  isActive: boolean;
  createdAt: Date;
  category?: {
    name: string;
    color: string;
  };
}

export interface CreateBudgetData {
  categoryId?: string;
  name: string;
  amount: number;
  periodType?: "weekly" | "monthly" | "yearly" | "custom";
  startDate?: Date;
  endDate?: Date;
  alertThreshold?: number;
}

export interface UpdateBudgetData {
  categoryId?: string;
  name?: string;
  amount?: number;
  periodType?: "weekly" | "monthly" | "yearly" | "custom";
  startDate?: Date;
  endDate?: Date;
  alertThreshold?: number;
  isActive?: boolean;
}

export interface BudgetFilters {
  categoryId?: string;
  periodType?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface BudgetSpending {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  isOverBudget: boolean;
  alertThreshold: number;
  shouldAlert: boolean;
  periodType: string;
  startDate: Date;
  endDate?: Date;
  category?: {
    name: string;
    color: string;
  };
}

export class BudgetModel {
  constructor() {
    // Using pool directly like other models
  }

  // Create a new budget
  async create(userId: string, budgetData: CreateBudgetData): Promise<Budget> {
    const {
      categoryId,
      name,
      amount,
      periodType = "monthly",
      startDate = new Date(),
      endDate,
      alertThreshold = 0.8,
    } = budgetData;

    // Calculate end date if not provided based on period type
    let calculatedEndDate = endDate;
    if (!calculatedEndDate && periodType !== "custom") {
      const start = new Date(startDate);
      switch (periodType) {
        case "weekly":
          calculatedEndDate = new Date(
            start.getTime() + 7 * 24 * 60 * 60 * 1000
          );
          break;
        case "monthly":
          calculatedEndDate = new Date(
            start.getFullYear(),
            start.getMonth() + 1,
            start.getDate()
          );
          break;
        case "yearly":
          calculatedEndDate = new Date(
            start.getFullYear() + 1,
            start.getMonth(),
            start.getDate()
          );
          break;
      }
    }

    const query = `
      INSERT INTO budgets (
        user_id, category_id, name, amount, period_type, 
        start_date, end_date, alert_threshold
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      categoryId || null,
      name,
      amount,
      periodType,
      startDate.toISOString().split("T")[0],
      calculatedEndDate ? calculatedEndDate.toISOString().split("T")[0] : null,
      alertThreshold,
    ]);

    return this.mapDatabaseRowToBudget(result.rows[0]);
  }

  // Get budget by ID with user access check
  async findById(userId: string, budgetId: string): Promise<Budget | null> {
    const query = `
      SELECT b.*, ec.name as category_name, ec.color as category_color
      FROM budgets b
      LEFT JOIN expense_categories ec ON b.category_id = ec.id
      WHERE b.id = $1 AND b.user_id = $2
    `;

    const result = await pool.query(query, [budgetId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToBudgetWithCategory(result.rows[0])
      : null;
  }

  // Get budgets with pagination and filters
  async findByUser(
    userId: string,
    filters: BudgetFilters = {},
    page: number = 1,
    limit: number = 20,
    sortBy: string = "created_at",
    sortOrder: "ASC" | "DESC" = "DESC"
  ): Promise<{ budgets: Budget[]; total: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Map camelCase sortBy to database column names
    const sortByMapping: Record<string, string> = {
      createdAt: "created_at",
      startDate: "start_date",
      endDate: "end_date",
      amount: "amount",
      name: "name",
    };

    const dbSortBy = sortByMapping[sortBy] || sortBy;

    // Build WHERE clause based on filters
    const conditions = ["b.user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters.categoryId) {
      conditions.push(`b.category_id = $${paramIndex}`);
      values.push(filters.categoryId);
      paramIndex++;
    }

    if (filters.periodType) {
      conditions.push(`b.period_type = $${paramIndex}`);
      values.push(filters.periodType);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      conditions.push(`b.is_active = $${paramIndex}`);
      values.push(filters.isActive);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`b.start_date >= $${paramIndex}`);
      values.push(filters.startDate.toISOString().split("T")[0]);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`b.end_date <= $${paramIndex}`);
      values.push(filters.endDate.toISOString().split("T")[0]);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total budgets
    const countQuery = `
      SELECT COUNT(*) 
      FROM budgets b 
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get budgets with category info
    const query = `
      SELECT b.*, ec.name as category_name, ec.color as category_color
      FROM budgets b
      LEFT JOIN expense_categories ec ON b.category_id = ec.id
      WHERE ${whereClause}
      ORDER BY b.${dbSortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    const budgets = result.rows.map((row: any) =>
      this.mapDatabaseRowToBudgetWithCategory(row)
    );
    const totalPages = Math.ceil(total / limit);

    return { budgets, total, totalPages };
  }

  // Update budget
  async update(
    userId: string,
    budgetId: string,
    updateData: UpdateBudgetData
  ): Promise<Budget | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.categoryId !== undefined) {
      fields.push(`category_id = $${paramIndex}`);
      values.push(updateData.categoryId || null);
      paramIndex++;
    }

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.amount !== undefined) {
      fields.push(`amount = $${paramIndex}`);
      values.push(updateData.amount);
      paramIndex++;
    }

    if (updateData.periodType !== undefined) {
      fields.push(`period_type = $${paramIndex}`);
      values.push(updateData.periodType);
      paramIndex++;
    }

    if (updateData.startDate !== undefined) {
      fields.push(`start_date = $${paramIndex}`);
      values.push(updateData.startDate.toISOString().split("T")[0]);
      paramIndex++;
    }

    if (updateData.endDate !== undefined) {
      fields.push(`end_date = $${paramIndex}`);
      values.push(
        updateData.endDate
          ? updateData.endDate.toISOString().split("T")[0]
          : null
      );
      paramIndex++;
    }

    if (updateData.alertThreshold !== undefined) {
      fields.push(`alert_threshold = $${paramIndex}`);
      values.push(updateData.alertThreshold);
      paramIndex++;
    }

    if (updateData.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(updateData.isActive);
      paramIndex++;
    }

    if (fields.length === 0) {
      return null;
    }

    const query = `
      UPDATE budgets 
      SET ${fields.join(", ")} 
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(budgetId, userId);
    const result = await pool.query(query, values);

    return result.rows.length > 0
      ? this.mapDatabaseRowToBudget(result.rows[0])
      : null;
  }

  // Delete budget
  async delete(userId: string, budgetId: string): Promise<boolean> {
    const query = `
      DELETE FROM budgets 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [budgetId, userId]);
    return (result.rowCount || 0) > 0;
  }

  // Get budget spending analysis
  async getBudgetSpending(
    userId: string,
    budgetId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BudgetSpending[]> {
    let whereClause = "b.user_id = $1 AND b.is_active = true";
    const values: any[] = [userId];
    let paramIndex = 2;

    if (budgetId) {
      whereClause += ` AND b.id = $${paramIndex}`;
      values.push(budgetId);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND b.start_date >= $${paramIndex}`;
      values.push(startDate.toISOString().split("T")[0]);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND (b.end_date IS NULL OR b.end_date <= $${paramIndex})`;
      values.push(endDate.toISOString().split("T")[0]);
      paramIndex++;
    }

    const query = `
      SELECT 
        b.*,
        ec.name as category_name,
        ec.color as category_color,
        COALESCE(spent.total_spent, 0) as spent_amount
      FROM budgets b
      LEFT JOIN expense_categories ec ON b.category_id = ec.id
      LEFT JOIN (
        SELECT 
          e.category_id,
          SUM(e.amount) as total_spent
        FROM expenses e
        WHERE e.user_id = $1
          AND e.expense_date >= CURRENT_DATE - INTERVAL '1 month'
          AND e.expense_date <= CURRENT_DATE
        GROUP BY e.category_id
      ) spent ON b.category_id = spent.category_id
      WHERE ${whereClause}
      ORDER BY b.created_at DESC
    `;

    const result = await pool.query(query, values);

    return result.rows.map((row: any) => {
      const spentAmount = parseFloat(row.spent_amount) || 0;
      const budgetAmount = parseFloat(row.amount);
      const remainingAmount = budgetAmount - spentAmount;
      const percentageUsed =
        budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
      const isOverBudget = spentAmount > budgetAmount;
      const shouldAlert =
        percentageUsed >= parseFloat(row.alert_threshold) * 100;

      return {
        budgetId: row.id,
        budgetName: row.name,
        budgetAmount,
        spentAmount,
        remainingAmount,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        isOverBudget,
        alertThreshold: parseFloat(row.alert_threshold),
        shouldAlert,
        periodType: row.period_type,
        startDate: new Date(row.start_date),
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        category: row.category_name
          ? {
              name: row.category_name,
              color: row.category_color,
            }
          : undefined,
      };
    });
  }

  // Get overall budget summary
  async getBudgetSummary(
    userId: string,
    month?: Date
  ): Promise<{
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    budgetsCount: number;
    overBudgetCount: number;
    alertCount: number;
  }> {
    const targetMonth = month || new Date();
    const startOfMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      1
    );
    const endOfMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0
    );

    const query = `
      SELECT 
        COUNT(b.id) as budgets_count,
        SUM(b.amount) as total_budgeted,
        SUM(COALESCE(spent.total_spent, 0)) as total_spent,
        COUNT(CASE WHEN COALESCE(spent.total_spent, 0) > b.amount THEN 1 END) as over_budget_count,
        COUNT(CASE WHEN (COALESCE(spent.total_spent, 0) / b.amount) >= b.alert_threshold THEN 1 END) as alert_count
      FROM budgets b
      LEFT JOIN (
        SELECT 
          e.category_id,
          SUM(e.amount) as total_spent
        FROM expenses e
        WHERE e.user_id = $1
          AND e.expense_date >= $2
          AND e.expense_date <= $3
        GROUP BY e.category_id
      ) spent ON b.category_id = spent.category_id
      WHERE b.user_id = $1 
        AND b.is_active = true
        AND b.start_date <= $3
        AND (b.end_date IS NULL OR b.end_date >= $2)
    `;

    const result = await pool.query(query, [
      userId,
      startOfMonth.toISOString().split("T")[0],
      endOfMonth.toISOString().split("T")[0],
    ]);

    const row = result.rows[0];
    const totalBudgeted = parseFloat(row.total_budgeted) || 0;
    const totalSpent = parseFloat(row.total_spent) || 0;

    return {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      budgetsCount: parseInt(row.budgets_count) || 0,
      overBudgetCount: parseInt(row.over_budget_count) || 0,
      alertCount: parseInt(row.alert_count) || 0,
    };
  }

  // Helper method to map database row to Budget object
  private mapDatabaseRowToBudget(row: any): Budget {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      name: row.name,
      amount: parseFloat(row.amount),
      periodType: row.period_type,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      alertThreshold: parseFloat(row.alert_threshold),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  // Helper method to map database row to Budget object with category
  private mapDatabaseRowToBudgetWithCategory(row: any): Budget {
    const budget = this.mapDatabaseRowToBudget(row);

    if (row.category_name) {
      budget.category = {
        name: row.category_name,
        color: row.category_color,
      };
    }

    return budget;
  }
}

export default BudgetModel;
