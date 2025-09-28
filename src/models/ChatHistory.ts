// Simple Chat History Model that works with existing table structure
import { query } from "../config/database";

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  apisUsed?: string;
  context?: string;
  intent?: string;
  confidence?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  sessionName?: string;
  isActive: boolean;
  lastMessageAt: Date;
  totalMessages: number;
  context?: any;
  createdAt: Date;
}

export class ChatHistoryModel {
  // Save a chat message to the existing chat_messages table
  async saveChatMessage(
    userId: string,
    message: string,
    response: string,
    context?: any,
    intent?: string
  ): Promise<ChatMessage> {
    try {
      console.log(`💾 Saving chat message for user ${userId}`);

      const result = await query(
        `INSERT INTO chat_messages 
         (user_id, message, response, context, intent, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [
          userId,
          message,
          response,
          context ? JSON.stringify(context) : null,
          intent || null,
        ]
      );

      return this.mapDatabaseRowToMessage(result.rows[0]);
    } catch (error) {
      console.error("❌ Failed to save chat message:", error);
      throw error;
    }
  }

  // Get chat history for a user
  async getChatHistory(
    userId: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    try {
      const result = await query(
        `SELECT * FROM chat_messages 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row: any) => this.mapDatabaseRowToMessage(row));
    } catch (error) {
      console.error("❌ Failed to get chat history:", error);
      throw error;
    }
  }

  // Search chat history
  async searchChatHistory(
    userId: string,
    searchQuery: string,
    limit: number = 10
  ): Promise<ChatMessage[]> {
    try {
      const result = await query(
        `SELECT * FROM chat_messages 
         WHERE user_id = $1 
         AND (message ILIKE $2 OR response ILIKE $2)
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId, `%${searchQuery}%`, limit]
      );

      return result.rows.map((row: any) => this.mapDatabaseRowToMessage(row));
    } catch (error) {
      console.error("❌ Failed to search chat history:", error);
      throw error;
    }
  }

  // Get conversation context from recent messages
  async getConversationContext(
    userId: string,
    messageCount: number = 5
  ): Promise<string> {
    try {
      const messages = await this.getChatHistory(userId, messageCount);

      const context = messages
        .reverse() // Get chronological order
        .map((msg) => `User: ${msg.message}\nAssistant: ${msg.response}`)
        .join("\n\n");

      return context;
    } catch (error) {
      console.error("❌ Failed to get conversation context:", error);
      return "";
    }
  }

  // Helper method to map database row to ChatMessage object
  private mapDatabaseRowToMessage(row: any): ChatMessage {
    return {
      id: row.id,
      userId: row.user_id,
      message: row.message,
      response: row.response,
      apisUsed: row.apis_called,
      context: row.context,
      intent: row.intent,
      confidence: row.confidence ? parseFloat(row.confidence) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}

export default ChatHistoryModel;
