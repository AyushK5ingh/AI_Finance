// Income Model - Database operations for income management
import { Pool } from "pg";
import pool from "../config/database";

export interface Income {
  id: string;
  userId: string;
  sourceId?: string;
  name: string;
  amount: number;
  description?: string;
  isRecurring: boolean;
  incomeDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  sourceType: string;
  isRecurring: boolean;
  recurringDay?: number;
  createdAt: Date;
}

export interface CreateIncomeData {
  sourceId?: string;
  name: string;
  amount: number;
  description?: string;
  isRecurring?: boolean;
  incomeDate?: Date;
}

export interface UpdateIncomeData {
  sourceId?: string;
  name?: string;
  amount?: number;
  description?: string;
  isRecurring?: boolean;
  incomeDate?: Date;
}

export interface CreateIncomeSourceData {
  name: string;
  sourceType: string;
  isRecurring?: boolean;
  recurringDay?: number;
}

export interface UpdateIncomeSourceData {
  name?: string;
  sourceType?: string;
  isRecurring?: boolean;
  recurringDay?: number;
}

export interface IncomeFilters {
  sourceId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sourceType?: string;
  isRecurring?: boolean;
}

export class IncomeModel {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  // Create a new income entry
  async create(userId: string, incomeData: CreateIncomeData): Promise<Income> {
    const {
      sourceId,
      name,
      amount,
      description,
      isRecurring = false,
      incomeDate = new Date(),
    } = incomeData;

    const query = `
      INSERT INTO income (
        user_id, source_id, name, amount, description, is_recurring, income_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, source_id, name, amount, description, 
                is_recurring, income_date, created_at
    `;

    const values = [
      userId,
      sourceId || null,
      name,
      amount,
      description,
      isRecurring,
      incomeDate,
    ];

    const result = await this.db.query(query, values);
    return this.mapDatabaseRowToIncome(result.rows[0]);
  }

  // Get income by ID
  async findById(userId: string, incomeId: string): Promise<Income | null> {
    const query = `
      SELECT i.*, ins.name as source_name, ins.source_type, ins.is_recurring as source_is_recurring
      FROM income i
      LEFT JOIN income_sources ins ON i.source_id = ins.id
      WHERE i.id = $1 AND i.user_id = $2
    `;

    const result = await this.db.query(query, [incomeId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToIncomeWithSource(result.rows[0])
      : null;
  }

  // Get income with pagination and filters
  async findByUser(
    userId: string,
    filters: IncomeFilters = {},
    page: number = 1,
    limit: number = 20,
    sortBy: string = "income_date",
    sortOrder: "ASC" | "DESC" = "DESC"
  ): Promise<{ income: Income[]; total: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Map camelCase sortBy to database column names
    const sortByMapping: Record<string, string> = {
      incomeDate: "income_date",
      createdAt: "created_at",
      updatedAt: "updated_at",
      amount: "amount",
      name: "name",
    };

    const dbSortBy = sortByMapping[sortBy] || sortBy;

    // Build WHERE clause based on filters
    const conditions = ["i.user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters.sourceId) {
      conditions.push(`i.source_id = $${paramIndex}`);
      values.push(filters.sourceId);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`i.income_date >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`i.income_date <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    if (filters.minAmount) {
      conditions.push(`i.amount >= $${paramIndex}`);
      values.push(filters.minAmount);
      paramIndex++;
    }

    if (filters.maxAmount) {
      conditions.push(`i.amount <= $${paramIndex}`);
      values.push(filters.maxAmount);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(
        `(i.name ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex} OR ins.name ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.sourceType) {
      conditions.push(`ins.source_type = $${paramIndex}`);
      values.push(filters.sourceType);
      paramIndex++;
    }

    if (filters.isRecurring !== undefined) {
      conditions.push(`i.is_recurring = $${paramIndex}`);
      values.push(filters.isRecurring);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total income entries
    const countQuery = `
      SELECT COUNT(*) 
      FROM income i 
      LEFT JOIN income_sources ins ON i.source_id = ins.id
      WHERE ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get income entries with source info
    const query = `
      SELECT i.*, ins.name as source_name, ins.source_type, ins.is_recurring as source_is_recurring
      FROM income i
      LEFT JOIN income_sources ins ON i.source_id = ins.id
      WHERE ${whereClause}
      ORDER BY i.${dbSortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);

    const income = result.rows.map((row) =>
      this.mapDatabaseRowToIncomeWithSource(row)
    );
    const totalPages = Math.ceil(total / limit);

    return { income, total, totalPages };
  }

  // Update income
  async update(
    userId: string,
    incomeId: string,
    updateData: UpdateIncomeData
  ): Promise<Income | null> {
    const fields = [];
    const values: any[] = [userId, incomeId];
    let paramIndex = 3;

    // Build dynamic update query
    if (updateData.sourceId !== undefined) {
      fields.push(`source_id = $${paramIndex}`);
      values.push(updateData.sourceId);
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

    if (updateData.isRecurring !== undefined) {
      fields.push(`is_recurring = $${paramIndex}`);
      values.push(updateData.isRecurring);
      paramIndex++;
    }

    if (updateData.incomeDate !== undefined) {
      fields.push(`income_date = $${paramIndex}`);
      values.push(updateData.incomeDate.toISOString());
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    const query = `
      UPDATE income 
      SET ${fields.join(", ")}
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, source_id, name, amount, description, 
                is_recurring, income_date, created_at
    `;

    const result = await this.db.query(query, values);
    return result.rows.length > 0
      ? this.mapDatabaseRowToIncome(result.rows[0])
      : null;
  }

  // Delete income
  async delete(userId: string, incomeId: string): Promise<boolean> {
    const query = "DELETE FROM income WHERE user_id = $1 AND id = $2";
    const result = await this.db.query(query, [userId, incomeId]);
    return (result.rowCount || 0) > 0;
  }

  // Get income sources for user
  async getSources(userId: string): Promise<IncomeSource[]> {
    const query = `
      SELECT * FROM income_sources 
      WHERE user_id = $1
      ORDER BY name ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row) => this.mapDatabaseRowToIncomeSource(row));
  }

  // Get income source by ID
  async getSourceById(
    userId: string,
    sourceId: string
  ): Promise<IncomeSource | null> {
    const query = `
      SELECT * FROM income_sources 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [sourceId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToIncomeSource(result.rows[0])
      : null;
  }

  // Create income source
  async createSource(
    userId: string,
    sourceData: CreateIncomeSourceData
  ): Promise<IncomeSource> {
    const { name, sourceType, isRecurring = false, recurringDay } = sourceData;

    const query = `
      INSERT INTO income_sources (user_id, name, source_type, is_recurring, recurring_day)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      userId,
      name,
      sourceType,
      isRecurring,
      recurringDay,
    ]);
    return this.mapDatabaseRowToIncomeSource(result.rows[0]);
  }

  // Update income source
  async updateSource(
    userId: string,
    sourceId: string,
    updateData: UpdateIncomeSourceData
  ): Promise<IncomeSource | null> {
    const fields = [];
    const values: any[] = [userId, sourceId];
    let paramIndex = 3;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.sourceType !== undefined) {
      fields.push(`source_type = $${paramIndex}`);
      values.push(updateData.sourceType);
      paramIndex++;
    }

    if (updateData.isRecurring !== undefined) {
      fields.push(`is_recurring = $${paramIndex}`);
      values.push(updateData.isRecurring);
      paramIndex++;
    }

    if (updateData.recurringDay !== undefined) {
      fields.push(`recurring_day = $${paramIndex}`);
      values.push(updateData.recurringDay);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    const query = `
      UPDATE income_sources 
      SET ${fields.join(", ")}
      WHERE user_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows.length > 0
      ? this.mapDatabaseRowToIncomeSource(result.rows[0])
      : null;
  }

  // Delete income source
  async deleteSource(userId: string, sourceId: string): Promise<boolean> {
    const query = "DELETE FROM income_sources WHERE user_id = $1 AND id = $2";
    const result = await this.db.query(query, [userId, sourceId]);
    return (result.rowCount || 0) > 0;
  }

  // Get income summary by source
  async getIncomeSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const conditions = ["i.user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`i.income_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`i.income_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        ins.id as source_id,
        ins.name as source_name,
        ins.source_type,
        COALESCE(SUM(i.amount), 0) as total_amount,
        COUNT(i.id) as entry_count,
        ROUND(AVG(i.amount), 2) as avg_amount
      FROM income_sources ins
      LEFT JOIN income i ON ins.id = i.source_id AND ${conditions.join(" AND ")}
      WHERE ins.user_id = $1
      GROUP BY ins.id, ins.name, ins.source_type
      ORDER BY total_amount DESC
    `;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // Get total income for period
  async getTotalIncome(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const conditions = ["user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`income_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`income_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM income
      WHERE ${conditions.join(" AND ")}
    `;

    const result = await this.db.query(query, values);
    return parseFloat(result.rows[0].total);
  }

  // Helper method to map database row to Income object
  private mapDatabaseRowToIncome(row: any): Income {
    return {
      id: row.id,
      userId: row.user_id,
      sourceId: row.source_id,
      name: row.name,
      amount: parseFloat(row.amount),
      description: row.description,
      isRecurring: row.is_recurring,
      incomeDate: new Date(row.income_date),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at), // Income table doesn't have updated_at yet
    };
  }

  // Helper method to map database row to Income with source info
  private mapDatabaseRowToIncomeWithSource(row: any): any {
    const income = this.mapDatabaseRowToIncome(row);
    return {
      ...income,
      source: {
        name: row.source_name,
        sourceType: row.source_type,
        isRecurring: row.source_is_recurring,
      },
    };
  }

  // Helper method to map database row to IncomeSource object
  private mapDatabaseRowToIncomeSource(row: any): IncomeSource {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      sourceType: row.source_type,
      isRecurring: row.is_recurring,
      recurringDay: row.recurring_day,
      createdAt: new Date(row.created_at),
    };
  }
}

export default IncomeModel;
