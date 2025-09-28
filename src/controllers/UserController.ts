// User profile management controllers
import { Request, Response } from "express";
import { UserModel } from "../models/User";
import { AuthService } from "../services/AuthService";
import { ApiResponse } from "../../types";

// Extended Request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export class UserController {
  // GET /api/v1/user/profile
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        } as ApiResponse<null>);
        return;
      }

      // Get user statistics
      const stats = await UserModel.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            isVerified: user.isVerified,
            timezone: user.timezone,
            currency: user.currency,
            monthlyBudget: user.monthlyBudget,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
          },
          statistics: {
            totalExpenses: parseInt(stats.total_expenses) || 0,
            totalIncome: parseInt(stats.total_income) || 0,
            aiInteractions: parseInt(stats.ai_interactions) || 0,
            voiceCommands: parseInt(stats.voice_commands) || 0,
            totalSpent: parseFloat(stats.total_spent) || 0,
            totalEarned: parseFloat(stats.total_earned) || 0,
          },
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // PUT /api/v1/user/profile
  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const updates = req.body;

      // Update user profile
      const updatedUser = await UserModel.updateProfile(userId, updates);

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "User not found",
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
            avatarUrl: updatedUser.avatarUrl,
            isVerified: updatedUser.isVerified,
            timezone: updatedUser.timezone,
            currency: updatedUser.currency,
            monthlyBudget: updatedUser.monthlyBudget,
            updatedAt: updatedUser.updatedAt,
          },
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // PUT /api/v1/user/password
  static async changePassword(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userEmail = req.user?.email;

      if (!userId || !userEmail) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await UserModel.verifyPassword(userEmail, currentPassword);
      if (!user) {
        res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        } as ApiResponse<null>);
        return;
      }

      // Update password
      const success = await UserModel.updatePassword(userId, newPassword);

      if (!success) {
        res.status(500).json({
          success: false,
          message: "Failed to update password",
        } as ApiResponse<null>);
        return;
      }

      // Invalidate all sessions except current one (force re-login on other devices)
      await AuthService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message:
          "Password changed successfully. Please log in again on other devices.",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // DELETE /api/v1/user/account
  static async deleteAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const { password } = req.body;

      // Verify password before deletion
      const userEmail = req.user?.email;
      if (userEmail && password) {
        const user = await UserModel.verifyPassword(userEmail, password);
        if (!user) {
          res.status(400).json({
            success: false,
            message: "Password verification failed",
          } as ApiResponse<null>);
          return;
        }
      }

      // Deactivate account (soft delete)
      const success = await UserModel.deactivate(userId);

      if (!success) {
        res.status(500).json({
          success: false,
          message: "Failed to delete account",
        } as ApiResponse<null>);
        return;
      }

      // Invalidate all sessions
      await AuthService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete account",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // GET /api/v1/user/sessions
  static async getActiveSessions(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const sessions = await AuthService.getActiveSessions(userId);

      res.status(200).json({
        success: true,
        data: {
          sessions: sessions.map((session) => ({
            id: session.id,
            deviceInfo: session.deviceInfo,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
          })),
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Get sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve sessions",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // DELETE /api/v1/user/sessions/:sessionId
  static async revokeSession(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const sessionId = req.params.sessionId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: "Session ID is required",
        } as ApiResponse<null>);
        return;
      }

      const success = await AuthService.revokeSession(userId, sessionId);

      if (!success) {
        res.status(404).json({
          success: false,
          message: "Session not found",
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: "Session revoked successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Revoke session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to revoke session",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // PUT /api/v1/user/preferences
  static async updatePreferences(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      const { timezone, currency, monthlyBudget } = req.body;

      const updates: any = {};
      if (timezone) updates.timezone = timezone;
      if (currency) updates.currency = currency;
      if (monthlyBudget !== undefined) updates.monthlyBudget = monthlyBudget;

      const updatedUser = await UserModel.updateProfile(userId, updates);

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "User not found",
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: "Preferences updated successfully",
        data: {
          preferences: {
            timezone: updatedUser.timezone,
            currency: updatedUser.currency,
            monthlyBudget: updatedUser.monthlyBudget,
          },
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Update preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update preferences",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }
}
