// Chat History Routes - API endpoints for managing conversation history
import express from "express";
import ChatHistoryController from "../controllers/ChatHistoryController";

const router = express.Router();
const chatHistoryController = new ChatHistoryController();

/**
 * @route   GET /api/v1/chat-history/:userId
 * @desc    Get chat history for a specific user
 * @params  userId - User ID
 * @query   limit - Number of messages to return (default: 20)
 * @query   offset - Number of messages to skip (default: 0)
 * @example GET /api/v1/chat-history/96a3697d-7b61-4537-9f93-a9398c10a8bc?limit=10&offset=0
 */
router.get("/:userId", chatHistoryController.getChatHistory);

/**
 * @route   GET /api/v1/chat-history/:userId/search
 * @desc    Search through user's chat history
 * @params  userId - User ID
 * @query   q - Search query
 * @query   limit - Number of results to return (default: 10)
 * @example GET /api/v1/chat-history/96a3697d-7b61-4537-9f93-a9398c10a8bc/search?q=coffee&limit=5
 */
router.get("/:userId/search", chatHistoryController.searchChatHistory);

/**
 * @route   GET /api/v1/chat-history/:userId/context
 * @desc    Get recent conversation context for AI
 * @params  userId - User ID
 * @query   count - Number of recent messages to include (default: 5)
 * @example GET /api/v1/chat-history/96a3697d-7b61-4537-9f93-a9398c10a8bc/context?count=3
 */
router.get("/:userId/context", chatHistoryController.getConversationContext);

/**
 * @route   GET /api/v1/chat-history/:userId/stats
 * @desc    Get chat statistics for a user
 * @params  userId - User ID
 * @example GET /api/v1/chat-history/96a3697d-7b61-4537-9f93-a9398c10a8bc/stats
 */
router.get("/:userId/stats", chatHistoryController.getChatStats);

/**
 * @route   DELETE /api/v1/chat-history/:userId
 * @desc    Clear all chat history for a user
 * @params  userId - User ID
 * @example DELETE /api/v1/chat-history/96a3697d-7b61-4537-9f93-a9398c10a8bc
 */
router.delete("/:userId", chatHistoryController.clearChatHistory);

export default router;
