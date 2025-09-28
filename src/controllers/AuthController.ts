// User authentication controllers
import { Request, Response } from "express";
import { UserModel } from "../models/User";
import { AuthService } from "../services/AuthService";
import {
  ApiResponse,
  User,
  CreateUserRequest,
  LoginRequest,
  DeviceInfo,
} from "../../types";

// Extended Request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export class AuthController {
  // POST /api/v1/auth/register
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userData: CreateUserRequest = req.body;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "User with this email already exists",
        } as ApiResponse<null>);
        return;
      }

      // Create new user
      const user = await UserModel.create(userData);

      // Generate tokens
      const deviceInfo: DeviceInfo | undefined = req.body.deviceInfo;
      const tokens = await AuthService.generateTokens(user, deviceInfo);

      // Return user data and tokens
      res.status(201).json({
        success: true,
        message: "User registered successfully",
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
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/login
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, deviceInfo }: LoginRequest = req.body;

      // Verify user credentials
      const user = await UserModel.verifyPassword(email, password);
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        } as ApiResponse<null>);
        return;
      }

      // Email verification disabled for better user experience
      // Users can login immediately after registration

      // Generate tokens
      const tokens = await AuthService.generateTokens(user, deviceInfo);

      // Return user data and tokens
      res.status(200).json({
        success: true,
        message: "Login successful",
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
            lastLoginAt: user.lastLoginAt,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/refresh
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: "Refresh token is required",
        } as ApiResponse<null>);
        return;
      }

      // Generate new access token
      const tokens = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(401).json({
        success: false,
        message: "Token refresh failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/logout
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: "Refresh token is required",
        } as ApiResponse<null>);
        return;
      }

      // Invalidate session
      const success = await AuthService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: success
          ? "Logged out successfully"
          : "Token was already invalid",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/logout-all
  static async logoutAll(
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

      // Invalidate all sessions for user
      await AuthService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message: "Logged out from all devices successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Logout all error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/forgot-password
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await UserModel.findByEmail(email);

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, we've sent password reset instructions",
      } as ApiResponse<null>);

      // If user exists, you would send reset email here
      if (user) {
        console.log(`Password reset requested for: ${email}`);
        // TODO: Implement email service for password reset
        // await EmailService.sendPasswordReset(user.email, resetToken);
      }
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset request failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/reset-password
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      // TODO: Verify reset token and update password
      // This would typically involve:
      // 1. Verify token is valid and not expired
      // 2. Find user by token
      // 3. Update password
      // 4. Invalidate reset token

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(400).json({
        success: false,
        message: "Password reset failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/verify-email
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      // TODO: Verify email token and mark user as verified
      // This would typically involve:
      // 1. Verify token is valid and not expired
      // 2. Find user by token
      // 3. Mark as verified
      // 4. Invalidate verification token

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(400).json({
        success: false,
        message: "Email verification failed",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }

  // POST /api/v1/auth/resend-verification
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      const user = await UserModel.findByEmail(email);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        } as ApiResponse<null>);
        return;
      }

      if (user.isVerified) {
        res.status(400).json({
          success: false,
          message: "Email is already verified",
        } as ApiResponse<null>);
        return;
      }

      // TODO: Send verification email
      // await EmailService.sendVerificationEmail(user.email, verificationToken);

      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
      } as ApiResponse<null>);
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send verification email",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  }
}
