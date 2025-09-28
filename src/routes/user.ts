// User profile management routes
import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { AuthController } from "../controllers/AuthController";
import {
  authenticateToken,
  rateLimitByUser,
  sanitizeInput,
} from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  updateProfileSchema,
  changePasswordSchema,
  uuidSchema,
} from "../middleware/validation";

const router = Router();

// Apply authentication, rate limiting, and input sanitization to all user routes
router.use(authenticateToken);
router.use(rateLimitByUser(30)); // 30 requests per minute per authenticated user
router.use(sanitizeInput);

/**
 * @route   GET /api/v1/user/profile
 * @desc    Get current user profile with statistics
 * @access  Private
 * @returns { user: User, statistics: UserStats }
 */
router.get("/profile", UserController.getProfile);

/**
 * @route   PUT /api/v1/user/profile
 * @desc    Update user profile information
 * @access  Private
 * @body    { firstName?, lastName?, phone?, avatarUrl?, timezone?, currency?, monthlyBudget? }
 */
router.put(
  "/profile",
  validate(updateProfileSchema),
  UserController.updateProfile
);

/**
 * @route   PUT /api/v1/user/password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.put(
  "/password",
  validate(changePasswordSchema),
  UserController.changePassword
);

/**
 * @route   DELETE /api/v1/user/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 * @body    { password } - Required for confirmation
 */
router.delete("/account", UserController.deleteAccount);

/**
 * @route   GET /api/v1/user/sessions
 * @desc    Get all active sessions for the user
 * @access  Private
 * @returns { sessions: Session[] }
 */
router.get("/sessions", UserController.getActiveSessions);

/**
 * @route   DELETE /api/v1/user/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 * @param   sessionId - UUID of the session to revoke
 */
router.delete("/sessions/:sessionId", UserController.revokeSession);

/**
 * @route   POST /api/v1/user/logout-all
 * @desc    Logout from all devices (revoke all sessions)
 * @access  Private
 */
router.post("/logout-all", AuthController.logoutAll);

/**
 * @route   PUT /api/v1/user/preferences
 * @desc    Update user preferences (timezone, currency, budget)
 * @access  Private
 * @body    { timezone?, currency?, monthlyBudget? }
 */
router.put("/preferences", UserController.updatePreferences);

export default router;
