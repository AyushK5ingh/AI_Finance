// User model and database operations
import { query, transaction } from "../config/database";
import bcrypt from "bcryptjs";
import { User, CreateUserRequest } from "../../types";

export class UserModel {
  // Create new user
  static async create(userData: CreateUserRequest): Promise<User> {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      timezone = "UTC",
      currency = "INR",
    } = userData;

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone, timezone, currency, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id, email, first_name, last_name, phone, avatar_url,
        is_verified, is_active, timezone, currency, monthly_budget,
        created_at, updated_at, last_login_at`,
      [
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        timezone,
        currency,
        true,
      ]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT 
        id, email, password_hash, first_name, last_name, phone, avatar_url,
        is_verified, is_active, timezone, currency, monthly_budget,
        created_at, updated_at, last_login_at
      FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );

    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const result = await query(
      `SELECT 
        id, email, first_name, last_name, phone, avatar_url,
        is_verified, is_active, timezone, currency, monthly_budget,
        created_at, updated_at, last_login_at
      FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );

    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  // Update user profile
  static async updateProfile(
    id: string,
    updates: Partial<User>
  ): Promise<User | null> {
    const allowedFields = [
      "first_name",
      "last_name",
      "phone",
      "avatar_url",
      "timezone",
      "currency",
      "monthly_budget",
    ];

    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      throw new Error("No valid fields to update");
    }

    values.push(id); // Add user ID as last parameter

    const result = await query(
      `UPDATE users 
      SET ${setClause.join(", ")}, updated_at = NOW()
      WHERE id = $${paramCount} AND is_active = true
      RETURNING 
        id, email, first_name, last_name, phone, avatar_url,
        is_verified, is_active, timezone, currency, monthly_budget,
        created_at, updated_at, last_login_at`,
      values
    );

    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  // Update password
  static async updatePassword(
    id: string,
    newPassword: string
  ): Promise<boolean> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const result = await query(
      `UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true`,
      [passwordHash, id]
    );

    return result.rowCount > 0;
  }

  // Verify password
  static async verifyPassword(
    email: string,
    password: string
  ): Promise<User | null> {
    const result = await query(
      `SELECT 
        id, email, password_hash, first_name, last_name, phone, avatar_url,
        is_verified, is_active, timezone, currency, monthly_budget,
        created_at, updated_at, last_login_at
      FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [
      user.id,
    ]);

    return this.mapRowToUser(user);
  }

  // Verify email address
  static async verifyEmail(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE users 
      SET is_verified = true, updated_at = NOW()
      WHERE id = $1 AND is_active = true`,
      [id]
    );

    return result.rowCount > 0;
  }

  // Deactivate user account
  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE users 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1`,
      [id]
    );

    return result.rowCount > 0;
  }

  // Check if email exists
  static async emailExists(email: string): Promise<boolean> {
    const result = await query("SELECT 1 FROM users WHERE email = $1", [email]);

    return result.rows.length > 0;
  }

  // Get user statistics
  static async getUserStats(id: string): Promise<any> {
    const result = await query(
      `SELECT 
        (SELECT COUNT(*) FROM expenses WHERE user_id = $1) as total_expenses,
        (SELECT COUNT(*) FROM income WHERE user_id = $1) as total_income,
        (SELECT COUNT(*) FROM ai_interactions WHERE user_id = $1) as ai_interactions,
        (SELECT COUNT(*) FROM voice_commands WHERE user_id = $1) as voice_commands,
        (SELECT SUM(amount) FROM expenses WHERE user_id = $1) as total_spent,
        (SELECT SUM(amount) FROM income WHERE user_id = $1) as total_earned`,
      [id]
    );

    return result.rows[0];
  }

  // Map database row to User interface
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      isVerified: row.is_verified,
      isActive: row.is_active,
      timezone: row.timezone,
      currency: row.currency,
      monthlyBudget: parseFloat(row.monthly_budget) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }
}
