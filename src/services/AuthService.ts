// JWT token management and session handling
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { User, DeviceInfo } from "../../types";

interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRES = "1h";
  private static readonly REFRESH_TOKEN_EXPIRES = "30d";

  // Generate access and refresh tokens
  static async generateTokens(
    user: User,
    deviceInfo?: DeviceInfo
  ): Promise<TokenPair> {
    const payload = {
      userId: user.id,
      email: user.email,
    };

    // Generate tokens
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES,
    });

    // Store session in database
    await this.createSession(user.id, refreshToken, deviceInfo);

    // Get expiration time in seconds
    const decoded = jwt.decode(accessToken) as TokenPayload;
    const expiresIn = decoded.exp! - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  // Verify access token
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  // Refresh access token using refresh token
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify refresh token
    const payload = this.verifyRefreshToken(refreshToken);

    // Check if session exists and is active
    const sessionResult = await query(
      `SELECT us.*, u.email, u.is_active 
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.token_hash = $1 AND us.is_active = true AND us.expires_at > NOW()`,
      [this.hashToken(refreshToken)]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error("Invalid refresh token or session expired");
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      throw new Error("User account is deactivated");
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: payload.userId, email: payload.email },
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRES }
    );

    const decoded = jwt.decode(newAccessToken) as TokenPayload;
    const expiresIn = decoded.exp! - Math.floor(Date.now() / 1000);

    return {
      accessToken: newAccessToken,
      expiresIn,
    };
  }

  // Create session record
  private static async createSession(
    userId: string,
    refreshToken: string,
    deviceInfo?: DeviceInfo
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      `INSERT INTO user_sessions (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        tokenHash,
        deviceInfo ? JSON.stringify(deviceInfo) : null,
        expiresAt,
      ]
    );
  }

  // Logout - invalidate session
  static async logout(refreshToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(refreshToken);

    const result = await query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE token_hash = $1`,
      [tokenHash]
    );

    return result.rowCount > 0;
  }

  // Logout from all devices
  static async logoutAll(userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE user_id = $1`,
      [userId]
    );

    return result.rowCount > 0;
  }

  // Get active sessions for user
  static async getActiveSessions(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
        id, device_info, ip_address, created_at, expires_at
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row:any) => ({
      id: row.id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  // Revoke specific session
  static async revokeSession(
    userId: string,
    sessionId: string
  ): Promise<boolean> {
    const result = await query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    return result.rowCount > 0;
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE expires_at <= NOW() AND is_active = true`
    );

    return result.rowCount;
  }

  // Hash token for storage (security)
  private static hashToken(token: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // Extract token from Authorization header
  static extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  }

  // Validate token format
  static isValidTokenFormat(token: string): boolean {
    const parts = token.split(".");
    return parts.length === 3; // JWT has 3 parts
  }
}
