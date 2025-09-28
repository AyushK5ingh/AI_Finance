// Authentication middleware
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/AuthService";
import { UserModel } from "../models/User";
import { ApiResponse } from "../../types";

// Extended Request interface for authenticated requests
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// Main authentication middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    let token = AuthService.extractTokenFromHeader(authHeader || "");

    // If no token in header, check cookies
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token required",
      } as ApiResponse<null>);
      return;
    }

    // Validate token format
    if (!AuthService.isValidTokenFormat(token)) {
      res.status(401).json({
        success: false,
        message: "Invalid token format",
      } as ApiResponse<null>);
      return;
    }

    // Verify token
    const payload = AuthService.verifyAccessToken(token);

    // Check if user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: "User account not found or deactivated",
      } as ApiResponse<null>);
      return;
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error: any) {
    console.error("Authentication error:", error);

    // Handle specific JWT errors
    if (error.message.includes("expired")) {
      res.status(401).json({
        success: false,
        message: "Token has expired",
        errors: ["TOKEN_EXPIRED"],
      } as ApiResponse<null>);
      return;
    }

    if (error.message.includes("invalid")) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
        errors: ["INVALID_TOKEN"],
      } as ApiResponse<null>);
      return;
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
      errors: [error.message],
    } as ApiResponse<null>);
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader || "");

    if (token && AuthService.isValidTokenFormat(token)) {
      const payload = AuthService.verifyAccessToken(token);
      const user = await UserModel.findById(payload.userId);

      if (user && user.isActive) {
        req.user = {
          userId: payload.userId,
          email: payload.email,
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Role-based authorization middleware (future use)
export const requireRole = (allowedRoles: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        } as ApiResponse<null>);
        return;
      }

      // TODO: Implement role checking when roles are added to user model
      // For now, all authenticated users have access
      next();
    } catch (error: any) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        errors: [error.message],
      } as ApiResponse<null>);
    }
  };
};

// Rate limiting middleware
export const rateLimitByUser = (requestsPerMinute: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const userId = req.user?.userId || req.ip || "anonymous"; // Fall back to IP if not authenticated
    const now = Date.now();
    const resetTime = now + 60000; // 1 minute from now

    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize user limit
      userRequests.set(userId, { count: 1, resetTime });
      next();
      return;
    }

    if (userLimit.count >= requestsPerMinute) {
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        errors: ["RATE_LIMIT_EXCEEDED"],
      } as ApiResponse<null>);
      return;
    }

    userLimit.count++;
    next();
  };
};

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Basic XSS protection
  const sanitize = (obj: any): any => {
    if (typeof obj === "string") {
      return obj
        .replace(/[<>]/g, "") // Remove < and >
        .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

// Error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Unhandled error:", error);

  // Database connection errors
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    res.status(503).json({
      success: false,
      message: "Database connection failed",
      errors: ["SERVICE_UNAVAILABLE"],
    } as ApiResponse<null>);
    return;
  }

  // Validation errors
  if (error.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(error.errors).map((err: any) => err.message),
    } as ApiResponse<null>);
    return;
  }

  // Default server error
  res.status(500).json({
    success: false,
    message: "Internal server error",
    errors:
      process.env.NODE_ENV === "development"
        ? [error.message]
        : ["INTERNAL_ERROR"],
  } as ApiResponse<null>);
};
