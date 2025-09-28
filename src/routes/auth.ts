// Authentication routes
import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { validate } from "../middleware/validation";
import { rateLimitByUser, sanitizeInput } from "../middleware/auth";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../middleware/validation";

const router = Router();

// Apply rate limiting and input sanitization to all auth routes
router.use(rateLimitByUser(10)); // 10 requests per minute per user/IP
router.use(sanitizeInput);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, firstName, lastName, phone?, timezone?, currency?, deviceInfo? }
 */
router.post("/register", validate(registerSchema), AuthController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user and get JWT tokens
 * @access  Public
 * @body    { email, password, deviceInfo? }
 */
router.post("/login", validate(loginSchema), AuthController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/logout", validate(refreshTokenSchema), AuthController.logout);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @body    { email }
 */
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    { token, newPassword, confirmPassword }
 */
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  AuthController.resetPassword
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address using verification token
 * @access  Public
 * @body    { token }
 */
router.post("/verify-email", AuthController.verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 * @body    { email }
 */
router.post(
  "/resend-verification",
  validate(forgotPasswordSchema), // Reuse email validation
  AuthController.resendVerification
);

export default router;
