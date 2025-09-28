// ChatbotController - Single unified AI chat endpoint for expense tracking
import { Request, Response } from "express";
import {
  processChatMessage,
  processVoiceInput,
  processReceiptUpload,
  clearConversationState,
  getConversationState,
} from "../services/ChatbotService";
import { processBankStatement } from "../services/BankStatementProcessor";

// MAIN UNIFIED CHAT API - Handles everything through natural language
export const chat = async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: "userId and message are required",
      });
    }

    console.log(`🤖 AI Chat from user ${userId}: "${message}"`);

    const result = await processChatMessage(userId, message);

    // Unified response format
    res.json({
      success: true,
      response: result.response,
      action: result.action || "chat",
      data: result.data || {},
      // Enhanced context for UI with all new action types
      context: {
        expenseSaved: result.action === "expense_saved",
        incomeSaved: result.action === "income_saved",
        budgetSaved: result.action === "budget_saved",
        goalSaved: result.action === "goal_saved",
        needsMoreInfo: result.action === "pending",
        isAnalysis: result.action === "analytics",
        isBalance: result.action === "analytics", // Analytics includes balance
      },
    });
  } catch (error: any) {
    console.error("❌ AI Chat error:", error);
    res.status(500).json({
      success: false,
      response: "Sorry, I'm having technical difficulties. Please try again.",
      error: error.message,
    });
  }
};

// Optional: Voice input (converts to text then processes via main chat)
export const processVoice = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId || !req.file) {
      return res.status(400).json({
        success: false,
        response: "userId and audio file are required",
      });
    }

    console.log(`🎤 Voice input from user ${userId}`);

    const result = await processVoiceInput(userId, req.file.buffer);

    res.json({
      success: true,
      response: result.response,
      transcript: result.transcript,
      action: result.action || "voice",
      data: result.data || {},
    });
  } catch (error: any) {
    console.error("❌ Voice processing error:", error);
    res.status(500).json({
      success: false,
      response:
        "Sorry, I couldn't process your voice input. Please try typing instead.",
      error: error.message,
    });
  }
};

// Optional: Receipt OCR (processes image then saves via main chat logic)
export const processReceipt = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId || !req.file) {
      return res.status(400).json({
        success: false,
        response: "userId and image file are required",
      });
    }

    console.log(`📷 Receipt upload from user ${userId}`);

    const imageBase64 = req.file.buffer.toString("base64");
    const result = await processReceiptUpload(userId, imageBase64);

    res.json({
      success: true,
      response: result.response,
      action: result.action || "receipt",
      data: result.data || {},
      messages: result.messages || [], // Include the messages array for real-time UI updates
    });
  } catch (error: any) {
    console.error("❌ Receipt processing error:", error);
    res.status(500).json({
      success: false,
      response:
        "Sorry, I couldn't process your receipt. Please try typing the expense manually.",
      error: error.message,
    });
  }
};

// Utility endpoints for debugging/management
export const clearState = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        response: "userId is required",
      });
    }

    clearConversationState(userId);

    res.json({
      success: true,
      response: `Conversation reset for user ${userId}. You can start fresh!`,
    });
  } catch (error: any) {
    console.error("❌ Clear state error:", error);
    res.status(500).json({
      success: false,
      response: "Sorry, couldn't reset conversation state.",
      error: error.message,
    });
  }
};

// Health check
export const healthCheck = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      response: "AI Finance Assistant is running perfectly! 🚀",
      status: "healthy",
      services: {
        ai_models: "connected",
        database: "connected",
        chatbot: "active",
      },
      capabilities: [
        "� Natural language expense tracking",
        "💰 Income management and source tracking",
        "📊 Budget creation and monitoring",
        "🎯 Financial goal setting and tracking",
        "� AI-powered spending analysis and insights",
        "🧠 Context-aware conversations",
        "💳 Balance and summary queries",
        "🎤 Voice input support",
        "📷 Receipt OCR processing",
        "� Bank statement import (CSV/Excel/PDF)",
        "�🔗 Complete financial ecosystem integration",
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Health check error:", error);
    res.status(500).json({
      success: false,
      response: "Service is experiencing issues",
      error: error.message,
    });
  }
};

// 📊 Bank Statement Upload - CSV/Excel/PDF Import
export const uploadBankStatement = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const file = req.file;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Bank statement file is required",
      });
    }

    console.log(
      `📊 Processing bank statement for user ${userId}: ${file.originalname}`
    );

    // Process the bank statement
    const result = await processBankStatement(
      userId,
      file.buffer,
      file.originalname
    );

    res.json({
      success: true,
      response: result.summary,
      data: {
        totalTransactions: result.processed,
        successCount: result.imported,
        failureCount: result.skipped,
        categories: result.summary.categories,
        totalExpenses: result.summary.totalExpenses,
        totalIncome: result.summary.totalIncome,
        errors: result.errors,
      },
      context: {
        bankStatementProcessed: true,
        hasNewTransactions: result.imported > 0,
      },
    });
  } catch (error: any) {
    console.error("❌ Bank statement upload error:", error);
    res.status(500).json({
      success: false,
      response:
        "Sorry, I couldn't process your bank statement. Please try again.",
      error: error.message,
    });
  }
};
