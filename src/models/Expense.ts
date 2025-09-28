// Expense Model - Database operations for expense management
import { Pool } from "pg";
import pool from "../config/database";

export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  amount: number;
  description?: string;
  receiptUrl?: string;
  receiptData?: any;
  location?: string;
  merchant?: string;
  paymentMethod?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  tags: string[];
  aiConfidence?: number;
  isAnomaly: boolean;
  expenseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  userId?: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  budgetLimit?: number;
  createdAt: Date;
}

export interface CreateExpenseData {
  categoryId: string;
  name: string;
  amount: number;
  description?: string;
  location?: string;
  merchant?: string;
  paymentMethod?: string;
  tags?: string[];
  expenseDate?: Date;
}

export interface UpdateExpenseData {
  categoryId?: string;
  name?: string;
  amount?: number;
  description?: string;
  location?: string;
  merchant?: string;
  paymentMethod?: string;
  tags?: string[];
  expenseDate?: Date;
}

export interface ExpenseFilters {
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  tags?: string[];
  paymentMethod?: string;
  merchant?: string;
}

export class ExpenseModel {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  // Create a new expense
  async create(
    userId: string,
    expenseData: CreateExpenseData
  ): Promise<Expense> {
    const {
      categoryId,
      name,
      amount,
      description,
      location,
      merchant,
      paymentMethod = "cash",
      tags = [],
      expenseDate = new Date(),
    } = expenseData;

    const query = `
      INSERT INTO expenses (
        user_id, category_id, name, amount, description, location, 
        merchant, payment_method, tags, expense_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, category_id, name, amount, description, 
                location, merchant, payment_method, is_recurring, 
                tags, ai_confidence, is_anomaly, expense_date, 
                created_at, updated_at
    `;

    const values = [
      userId,
      categoryId,
      name,
      amount,
      description,
      location,
      merchant,
      paymentMethod,
      tags,
      expenseDate,
    ];

    const result = await this.db.query(query, values);
    return this.mapDatabaseRowToExpense(result.rows[0]);
  }

  // Get expense by ID
  async findById(userId: string, expenseId: string): Promise<Expense | null> {
    const query = `
      SELECT e.*, ec.name as category_name, ec.color as category_color, ec.icon as category_icon
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = $1 AND e.user_id = $2
    `;

    const result = await this.db.query(query, [expenseId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToExpenseWithCategory(result.rows[0])
      : null;
  }

  // Get expenses with pagination and filters
  async findByUser(
    userId: string,
    filters: ExpenseFilters = {},
    page: number = 1,
    limit: number = 20,
    sortBy: string = "expense_date",
    sortOrder: "ASC" | "DESC" = "DESC"
  ): Promise<{ expenses: Expense[]; total: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Build WHERE clause based on filters
    const conditions = ["e.user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters.categoryId) {
      conditions.push(`e.category_id = $${paramIndex}`);
      values.push(filters.categoryId);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`e.expense_date >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`e.expense_date <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    if (filters.minAmount) {
      conditions.push(`e.amount >= $${paramIndex}`);
      values.push(filters.minAmount);
      paramIndex++;
    }

    if (filters.maxAmount) {
      conditions.push(`e.amount <= $${paramIndex}`);
      values.push(filters.maxAmount);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(
        `(e.name ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex} OR e.merchant ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.paymentMethod) {
      conditions.push(`e.payment_method = $${paramIndex}`);
      values.push(filters.paymentMethod);
      paramIndex++;
    }

    if (filters.merchant) {
      conditions.push(`e.merchant ILIKE $${paramIndex}`);
      values.push(`%${filters.merchant}%`);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`e.tags && $${paramIndex}`);
      values.push(filters.tags);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total expenses
    const countQuery = `
      SELECT COUNT(*) 
      FROM expenses e 
      WHERE ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get expenses with category info
    const query = `
      SELECT e.*, ec.name as category_name, ec.color as category_color, ec.icon as category_icon
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE ${whereClause}
      ORDER BY e.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);

    const expenses = result.rows.map((row) =>
      this.mapDatabaseRowToExpenseWithCategory(row)
    );
    const totalPages = Math.ceil(total / limit);

    return { expenses, total, totalPages };
  }

  // Update expense
  async update(
    userId: string,
    expenseId: string,
    updateData: UpdateExpenseData
  ): Promise<Expense | null> {
    const fields = [];
    const values: any[] = [userId, expenseId];
    let paramIndex = 3;

    // Build dynamic update query
    if (updateData.categoryId !== undefined) {
      fields.push(`category_id = $${paramIndex}`);
      values.push(updateData.categoryId);
      paramIndex++;
    }

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.amount !== undefined) {
      fields.push(`amount = $${paramIndex}`);
      values.push(updateData.amount.toString());
      paramIndex++;
    }

    if (updateData.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(updateData.description);
      paramIndex++;
    }

    if (updateData.location !== undefined) {
      fields.push(`location = $${paramIndex}`);
      values.push(updateData.location);
      paramIndex++;
    }

    if (updateData.merchant !== undefined) {
      fields.push(`merchant = $${paramIndex}`);
      values.push(updateData.merchant);
      paramIndex++;
    }

    if (updateData.paymentMethod !== undefined) {
      fields.push(`payment_method = $${paramIndex}`);
      values.push(updateData.paymentMethod);
      paramIndex++;
    }

    if (updateData.tags !== undefined) {
      fields.push(`tags = $${paramIndex}`);
      values.push(updateData.tags);
      paramIndex++;
    }

    if (updateData.expenseDate !== undefined) {
      fields.push(`expense_date = $${paramIndex}`);
      values.push(updateData.expenseDate.toISOString());
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push("updated_at = NOW()");

    const query = `
      UPDATE expenses 
      SET ${fields.join(", ")}
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, category_id, name, amount, description, 
                location, merchant, payment_method, is_recurring, 
                tags, ai_confidence, is_anomaly, expense_date, 
                created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    return result.rows.length > 0
      ? this.mapDatabaseRowToExpense(result.rows[0])
      : null;
  }

  // Delete expense
  async delete(userId: string, expenseId: string): Promise<boolean> {
    const query = "DELETE FROM expenses WHERE user_id = $1 AND id = $2";
    const result = await this.db.query(query, [userId, expenseId]);
    return (result.rowCount || 0) > 0;
  }

  // Get expense categories (default + user custom)
  async getCategories(userId: string): Promise<ExpenseCategory[]> {
    const query = `
      SELECT * FROM expense_categories 
      WHERE is_default = TRUE OR user_id = $1
      ORDER BY is_default DESC, name ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row) => this.mapDatabaseRowToCategory(row));
  }

  // Get category by ID
  async getCategoryById(
    userId: string,
    categoryId: string
  ): Promise<ExpenseCategory | null> {
    const query = `
      SELECT * FROM expense_categories 
      WHERE id = $1 AND (is_default = TRUE OR user_id = $2)
    `;

    const result = await this.db.query(query, [categoryId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToCategory(result.rows[0])
      : null;
  }

  // Create custom category
  async createCategory(
    userId: string,
    categoryData: {
      name: string;
      color?: string;
      icon?: string;
      budgetLimit?: number;
    }
  ): Promise<ExpenseCategory> {
    const {
      name,
      color = "#6B7280",
      icon = "other",
      budgetLimit,
    } = categoryData;

    const query = `
      INSERT INTO expense_categories (user_id, name, color, icon, budget_limit)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      userId,
      name,
      color,
      icon,
      budgetLimit,
    ]);
    return this.mapDatabaseRowToCategory(result.rows[0]);
  }

  // Get spending summary by category
  async getSpendingSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const conditions = ["e.user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`e.expense_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`e.expense_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        ec.id as category_id,
        ec.name as category_name,
        ec.color as category_color,
        ec.icon as category_icon,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as expense_count,
        ROUND(AVG(e.amount), 2) as avg_amount
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id AND ${conditions.join(
        " AND "
      )}
      WHERE ec.is_default = TRUE OR ec.user_id = $1
      GROUP BY ec.id, ec.name, ec.color, ec.icon
      ORDER BY total_amount DESC
    `;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // Helper method to map database row to Expense object
  private mapDatabaseRowToExpense(row: any): Expense {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      name: row.name,
      amount: parseFloat(row.amount),
      description: row.description,
      receiptUrl: row.receipt_url,
      receiptData: row.receipt_data,
      location: row.location,
      merchant: row.merchant,
      paymentMethod: row.payment_method,
      isRecurring: row.is_recurring,
      recurringFrequency: row.recurring_frequency,
      tags: row.tags || [],
      aiConfidence: row.ai_confidence
        ? parseFloat(row.ai_confidence)
        : undefined,
      isAnomaly: row.is_anomaly,
      expenseDate: new Date(row.expense_date),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Helper method to map database row to Expense with category info
  private mapDatabaseRowToExpenseWithCategory(row: any): any {
    const expense = this.mapDatabaseRowToExpense(row);
    return {
      ...expense,
      category: {
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      },
    };
  }

  // Helper method to map database row to ExpenseCategory object
  private mapDatabaseRowToCategory(row: any): ExpenseCategory {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      isDefault: row.is_default,
      budgetLimit: row.budget_limit ? parseFloat(row.budget_limit) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

export default ExpenseModel;
