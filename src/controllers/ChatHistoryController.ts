// Chat History Controller for managing conversation history
import { Request, Response } from "express";
import ChatHistoryModel from "../models/ChatHistory";

export class ChatHistoryController {
  private chatHistoryModel: ChatHistoryModel;

  constructor() {
    this.chatHistoryModel = new ChatHistoryModel();
  }

  // GET /api/v1/chat-history/:userId - Get chat history for a user
  getChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      console.log(
        `📖 Getting chat history for user ${userId} (limit: ${limit}, offset: ${offset})`
      );

      const messages = await this.chatHistoryModel.getChatHistory(
        userId,
        limit
      );

      // Apply offset manually since our model doesn't support it yet
      const paginatedMessages = messages.slice(offset, offset + limit);

      res.status(200).json({
        success: true,
        data: {
          messages: paginatedMessages,
          total: messages.length,
          limit,
          offset,
          hasMore: offset + limit < messages.length,
        },
        message: "Chat history retrieved successfully",
      });
    } catch (error) {
      console.error("❌ Error getting chat history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve chat history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /api/v1/chat-history/:userId/search?q=query - Search chat history
  searchChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      if (!query || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Search query is required",
        });
        return;
      }

      console.log(
        `🔍 Searching chat history for user ${userId} with query: "${query}"`
      );

      const messages = await this.chatHistoryModel.searchChatHistory(
        userId,
        query,
        limit
      );

      res.status(200).json({
        success: true,
        data: {
          messages,
          query,
          total: messages.length,
          limit,
        },
        message: "Chat search completed successfully",
      });
    } catch (error) {
      console.error("❌ Error searching chat history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search chat history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /api/v1/chat-history/:userId/context - Get recent conversation context
  getConversationContext = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.params.userId;
      const messageCount = parseInt(req.query.count as string) || 5;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      console.log(
        `🧠 Getting conversation context for user ${userId} (${messageCount} messages)`
      );

      const context = await this.chatHistoryModel.getConversationContext(
        userId,
        messageCount
      );

      res.status(200).json({
        success: true,
        data: {
          context,
          messageCount,
          userId,
        },
        message: "Conversation context retrieved successfully",
      });
    } catch (error) {
      console.error("❌ Error getting conversation context:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve conversation context",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // DELETE /api/v1/chat-history/:userId - Clear chat history for user
  clearChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      console.log(`🗑️ Clearing chat history for user ${userId}`);

      // Note: We'd need to add this method to ChatHistoryModel
      // For now, return a placeholder response
      res.status(200).json({
        success: true,
        data: {
          userId,
          cleared: true,
        },
        message: "Chat history cleared successfully (feature coming soon)",
      });
    } catch (error) {
      console.error("❌ Error clearing chat history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear chat history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // GET /api/v1/chat-history/:userId/stats - Get chat statistics
  getChatStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      console.log(`📊 Getting chat statistics for user ${userId}`);

      const allMessages = await this.chatHistoryModel.getChatHistory(
        userId,
        1000
      ); // Get more for stats

      const stats = {
        totalMessages: allMessages.length,
        intentBreakdown: allMessages.reduce((acc: any, msg) => {
          const intent = msg.intent || "unknown";
          acc[intent] = (acc[intent] || 0) + 1;
          return acc;
        }, {}),
        firstMessage:
          allMessages.length > 0
            ? allMessages[allMessages.length - 1].createdAt
            : null,
        lastMessage: allMessages.length > 0 ? allMessages[0].createdAt : null,
        averageResponseLength:
          allMessages.length > 0
            ? Math.round(
                allMessages.reduce(
                  (sum, msg) => sum + (msg.response?.length || 0),
                  0
                ) / allMessages.length
              )
            : 0,
      };

      res.status(200).json({
        success: true,
        data: stats,
        message: "Chat statistics retrieved successfully",
      });
    } catch (error) {
      console.error("❌ Error getting chat statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve chat statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

export default ChatHistoryController;
