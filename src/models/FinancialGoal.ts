// Financial Goal Model - Handle financial goals data operations
import pool from "../config/database";

// Financial Goal interfaces based on existing database schema
export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date;
  goalType: string;
  priority: number; // 1 = high, 2 = medium, 3 = low
  isAchieved: boolean;
  createdAt: Date;
  progress?: number; // calculated percentage
}

export interface CreateFinancialGoalData {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: Date;
  goalType?: string;
  priority?: number; // 1 = high, 2 = medium, 3 = low
}

export interface UpdateFinancialGoalData {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: Date;
  goalType?: string;
  priority?: number; // 1 = high, 2 = medium, 3 = low
}

export interface FinancialGoalFilters {
  goalType?: string;
  priority?: number;
  isAchieved?: boolean;
  targetDateFrom?: Date;
  targetDateTo?: Date;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  daysRemaining?: number;
  isOverdue: boolean;
  isAchieved: boolean;
  targetDate?: Date;
  priority: number;
  monthlyRequirement?: number; // Amount needed per month to reach goal
  status: "on_track" | "behind" | "ahead" | "completed" | "overdue";
}

export interface GoalSummary {
  totalGoals: number;
  achievedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalProgressPercentage: number;
  overdueGoals: number;
  goalsByType: {
    [key: string]: {
      count: number;
      totalTarget: number;
      totalCurrent: number;
    };
  };
  goalsByPriority: {
    [key: string]: {
      count: number;
      totalTarget: number;
      totalCurrent: number;
    };
  };
}

export class FinancialGoalModel {
  constructor() {
    // Using pool directly like other models
  }

  // Create a new financial goal
  async create(
    userId: string,
    goalData: CreateFinancialGoalData
  ): Promise<FinancialGoal> {
    const {
      name,
      targetAmount,
      currentAmount = 0,
      targetDate,
      goalType = "savings",
      priority = 2, // default to medium priority
    } = goalData;

    const query = `
      INSERT INTO financial_goals (
        user_id, name, target_amount, current_amount, 
        target_date, goal_type, priority
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      name,
      targetAmount,
      currentAmount,
      targetDate ? targetDate.toISOString().split("T")[0] : null,
      goalType,
      priority,
    ]);

    return this.mapDatabaseRowToGoal(result.rows[0]);
  }

  // Get financial goal by ID with user access check
  async findById(
    userId: string,
    goalId: string
  ): Promise<FinancialGoal | null> {
    const query = `
      SELECT * FROM financial_goals 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [goalId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToGoal(result.rows[0])
      : null;
  }

  // Get financial goals with pagination and filters
  async findByUser(
    userId: string,
    filters: FinancialGoalFilters = {},
    page: number = 1,
    limit: number = 20,
    sortBy: string = "created_at",
    sortOrder: "ASC" | "DESC" = "DESC"
  ): Promise<{ goals: FinancialGoal[]; total: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Map camelCase sortBy to database column names
    const sortByMapping: Record<string, string> = {
      createdAt: "created_at",
      targetDate: "target_date",
      targetAmount: "target_amount",
      currentAmount: "current_amount",
      priority: "priority",
      name: "name",
    };

    const dbSortBy = sortByMapping[sortBy] || sortBy;

    // Build WHERE clause based on filters
    const conditions = ["user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters.goalType) {
      conditions.push(`goal_type = $${paramIndex}`);
      values.push(filters.goalType);
      paramIndex++;
    }

    if (filters.priority !== undefined) {
      conditions.push(`priority = $${paramIndex}`);
      values.push(filters.priority);
      paramIndex++;
    }

    if (filters.isAchieved !== undefined) {
      conditions.push(`is_achieved = $${paramIndex}`);
      values.push(filters.isAchieved);
      paramIndex++;
    }

    if (filters.targetDateFrom) {
      conditions.push(`target_date >= $${paramIndex}`);
      values.push(filters.targetDateFrom.toISOString().split("T")[0]);
      paramIndex++;
    }

    if (filters.targetDateTo) {
      conditions.push(`target_date <= $${paramIndex}`);
      values.push(filters.targetDateTo.toISOString().split("T")[0]);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total goals
    const countQuery = `
      SELECT COUNT(*) 
      FROM financial_goals 
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get goals
    const query = `
      SELECT *
      FROM financial_goals
      WHERE ${whereClause}
      ORDER BY ${dbSortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    const goals = result.rows.map((row: any) => this.mapDatabaseRowToGoal(row));
    const totalPages = Math.ceil(total / limit);

    return { goals, total, totalPages };
  }

  // Update financial goal
  async update(
    userId: string,
    goalId: string,
    updateData: UpdateFinancialGoalData
  ): Promise<FinancialGoal | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.targetAmount !== undefined) {
      fields.push(`target_amount = $${paramIndex}`);
      values.push(updateData.targetAmount);
      paramIndex++;
    }

    if (updateData.currentAmount !== undefined) {
      fields.push(`current_amount = $${paramIndex}`);
      values.push(updateData.currentAmount);
      paramIndex++;

      // Check if goal is achieved
      const goal = await this.findById(userId, goalId);
      if (
        goal &&
        updateData.currentAmount >= goal.targetAmount &&
        !goal.isAchieved
      ) {
        fields.push(`is_achieved = $${paramIndex}`);
        values.push(true);
        paramIndex++;
      }
    }

    if (updateData.targetDate !== undefined) {
      fields.push(`target_date = $${paramIndex}`);
      values.push(
        updateData.targetDate
          ? updateData.targetDate.toISOString().split("T")[0]
          : null
      );
      paramIndex++;
    }

    if (updateData.goalType !== undefined) {
      fields.push(`goal_type = $${paramIndex}`);
      values.push(updateData.goalType);
      paramIndex++;
    }

    if (updateData.priority !== undefined) {
      fields.push(`priority = $${paramIndex}`);
      values.push(updateData.priority);
      paramIndex++;
    }

    if (fields.length === 0) {
      return null;
    }

    const query = `
      UPDATE financial_goals 
      SET ${fields.join(", ")} 
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(goalId, userId);
    const result = await pool.query(query, values);

    return result.rows.length > 0
      ? this.mapDatabaseRowToGoal(result.rows[0])
      : null;
  }

  // Delete financial goal
  async delete(userId: string, goalId: string): Promise<boolean> {
    const query = `
      DELETE FROM financial_goals 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [goalId, userId]);
    return (result.rowCount || 0) > 0;
  }

  // Update goal progress (add money towards goal)
  async updateProgress(
    userId: string,
    goalId: string,
    amount: number
  ): Promise<FinancialGoal | null> {
    const goal = await this.findById(userId, goalId);
    if (!goal) return null;

    const newCurrentAmount = goal.currentAmount + amount;
    return this.update(userId, goalId, { currentAmount: newCurrentAmount });
  }

  // Get detailed goal progress analysis
  async getGoalProgress(
    userId: string,
    goalId?: string
  ): Promise<GoalProgress[]> {
    let whereClause = "user_id = $1";
    const values: any[] = [userId];
    let paramIndex = 2;

    if (goalId) {
      whereClause += ` AND id = $${paramIndex}`;
      values.push(goalId);
      paramIndex++;
    }

    const query = `
      SELECT *
      FROM financial_goals
      WHERE ${whereClause}
      ORDER BY priority ASC, target_date ASC NULLS LAST
    `;

    const result = await pool.query(query, values);
    const currentDate = new Date();

    return result.rows.map((row: any) => {
      const targetAmount = parseFloat(row.target_amount);
      const currentAmount = parseFloat(row.current_amount);
      const remainingAmount = targetAmount - currentAmount;
      const progressPercentage =
        targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

      let daysRemaining: number | undefined = undefined;
      let isOverdue = false;
      let monthlyRequirement: number | undefined = undefined;

      if (row.target_date) {
        const targetDate = new Date(row.target_date);
        const timeDiff = targetDate.getTime() - currentDate.getTime();
        daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        isOverdue = daysRemaining < 0;

        // Calculate monthly requirement
        const monthsRemaining = Math.max(1, daysRemaining / 30);
        monthlyRequirement =
          remainingAmount > 0 ? remainingAmount / monthsRemaining : 0;
      }

      const isAchieved = currentAmount >= targetAmount;

      // Determine status
      let status: "on_track" | "behind" | "ahead" | "completed" | "overdue" =
        "on_track";
      if (isAchieved) {
        status = "completed";
      } else if (isOverdue) {
        status = "overdue";
      } else if (progressPercentage > 0 && daysRemaining !== undefined) {
        const expectedProgress = Math.max(0, (1 - daysRemaining / 365) * 100);
        if (progressPercentage > expectedProgress + 10) {
          status = "ahead";
        } else if (progressPercentage < expectedProgress - 10) {
          status = "behind";
        }
      }

      return {
        goalId: row.id,
        goalName: row.name,
        goalType: row.goal_type,
        targetAmount,
        currentAmount,
        remainingAmount,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        daysRemaining,
        isOverdue,
        isAchieved,
        targetDate: row.target_date ? new Date(row.target_date) : undefined,
        priority: row.priority,
        monthlyRequirement: monthlyRequirement
          ? Math.round(monthlyRequirement * 100) / 100
          : undefined,
        status,
      };
    });
  }

  // Get comprehensive goal summary
  async getGoalSummary(userId: string): Promise<GoalSummary> {
    const query = `
      SELECT 
        COUNT(*) as total_goals,
        COUNT(CASE WHEN is_achieved = true THEN 1 END) as achieved_goals,
        SUM(target_amount) as total_target_amount,
        SUM(current_amount) as total_current_amount,
        COUNT(CASE WHEN target_date < CURRENT_DATE AND is_achieved = false THEN 1 END) as overdue_goals,
        goal_type,
        priority
      FROM financial_goals
      WHERE user_id = $1
      GROUP BY ROLLUP(goal_type, priority)
      ORDER BY goal_type NULLS FIRST, priority NULLS FIRST
    `;

    const result = await pool.query(query, [userId]);

    // Process the rollup results
    let totalGoals = 0;
    let achievedGoals = 0;
    let totalTargetAmount = 0;
    let totalCurrentAmount = 0;
    let overdueGoals = 0;
    const goalsByType: any = {};
    const goalsByPriority: any = {};

    for (const row of result.rows) {
      if (!row.goal_type && !row.priority) {
        // This is the grand total row
        totalGoals = parseInt(row.total_goals) || 0;
        achievedGoals = parseInt(row.achieved_goals) || 0;
        totalTargetAmount = parseFloat(row.total_target_amount) || 0;
        totalCurrentAmount = parseFloat(row.total_current_amount) || 0;
        overdueGoals = parseInt(row.overdue_goals) || 0;
      } else if (row.goal_type && !row.priority) {
        // This is a goal_type subtotal
        goalsByType[row.goal_type] = {
          count: parseInt(row.total_goals) || 0,
          totalTarget: parseFloat(row.total_target_amount) || 0,
          totalCurrent: parseFloat(row.total_current_amount) || 0,
        };
      }
    }

    // Get priority breakdown separately
    const priorityQuery = `
      SELECT 
        priority,
        COUNT(*) as total_goals,
        SUM(target_amount) as total_target_amount,
        SUM(current_amount) as total_current_amount
      FROM financial_goals
      WHERE user_id = $1
      GROUP BY priority
    `;

    const priorityResult = await pool.query(priorityQuery, [userId]);
    for (const row of priorityResult.rows) {
      goalsByPriority[row.priority] = {
        count: parseInt(row.total_goals) || 0,
        totalTarget: parseFloat(row.total_target_amount) || 0,
        totalCurrent: parseFloat(row.total_current_amount) || 0,
      };
    }

    const totalProgressPercentage =
      totalTargetAmount > 0
        ? (totalCurrentAmount / totalTargetAmount) * 100
        : 0;

    return {
      totalGoals,
      achievedGoals,
      totalTargetAmount,
      totalCurrentAmount,
      totalProgressPercentage: Math.round(totalProgressPercentage * 100) / 100,
      overdueGoals,
      goalsByType,
      goalsByPriority,
    };
  }

  // Mark goal as achieved
  async markAchieved(
    userId: string,
    goalId: string
  ): Promise<FinancialGoal | null> {
    const query = `
      UPDATE financial_goals 
      SET is_achieved = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [goalId, userId]);
    return result.rows.length > 0
      ? this.mapDatabaseRowToGoal(result.rows[0])
      : null;
  }

  // Helper method to map database row to FinancialGoal object
  private mapDatabaseRowToGoal(row: any): FinancialGoal {
    const targetAmount = parseFloat(row.target_amount);
    const currentAmount = parseFloat(row.current_amount);
    const progress =
      targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      targetAmount,
      currentAmount,
      targetDate: row.target_date ? new Date(row.target_date) : undefined,
      goalType: row.goal_type,
      priority: row.priority,
      isAchieved: row.is_achieved,
      createdAt: new Date(row.created_at),
      progress: Math.round(progress * 100) / 100,
    };
  }
}

export default FinancialGoalModel;
