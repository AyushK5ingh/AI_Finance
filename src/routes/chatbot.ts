// Simplified chatbot routes - One main chat API with optional extras
import express from "express";
import multer from "multer";
import {
  chat,
  processVoice,
  processReceipt,
  clearState,
  healthCheck,
  uploadBankStatement,
} from "../controllers/ChatbotController";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio" && file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else if (
      file.fieldname === "image" &&
      file.mimetype.startsWith("image/")
    ) {
      cb(null, true);
    } else if (file.fieldname === "statement") {
      // Accept CSV, Excel, and PDF files for bank statements
      const allowedTypes = [
        "text/csv",
        "application/csv",
        "text/plain", // CSV files are sometimes detected as text/plain
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
        "application/pdf",
      ];
      const extension = file.originalname.toLowerCase();

      if (
        allowedTypes.includes(file.mimetype) ||
        extension.endsWith(".csv") ||
        extension.endsWith(".xlsx") ||
        extension.endsWith(".xls") ||
        extension.endsWith(".pdf")
      ) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Invalid file type. Supported: CSV, Excel, PDF. Got: ${file.mimetype}`
          )
        );
      }
    } else {
      cb(new Error("Invalid field name"));
    }
  },
});

/**
 * 🚀 MAIN UNIFIED CHAT API
 * @route   POST /api/v1/chatbot/chat
 * @desc    The ONE API that handles everything:
 *          - ✅ Natural language expense creation: "I spent 150 on coffee"
 *          - ✅ Follow-up questions: "What category?" "How much?"
 *          - ✅ Balance queries: "What's my balance?" "Total expenses?"
 *          - ✅ Analysis: "Analyze my spending" "Show patterns"
 *          - ✅ Context memory: Remembers incomplete expenses
 *          - ✅ Database integration: Saves to real PostgreSQL
 * @body    { userId: string, message: string }
 * @example
 *   POST /api/v1/chatbot/chat
 *   { "userId": "user123", "message": "I spent 500 on groceries" }
 */
router.post("/chat", chat);

/**
 * @route   POST /api/v1/chatbot/voice
 * @desc    Optional: Voice input (converts to text, then uses main chat)
 * @body    FormData: { userId: string, audio: File }
 */
router.post("/voice", upload.single("audio"), processVoice);

/**
 * @route   POST /api/v1/chatbot/receipt
 * @desc    Optional: Receipt OCR (extracts data, then saves via chat logic)
 * @body    FormData: { userId: string, image: File }
 */
router.post("/receipt", upload.single("image"), processReceipt);

/**
 * @route   POST /api/v1/chatbot/bank-statement
 * @desc    Bank Statement Import - Upload CSV/Excel/PDF bank statements
 * @body    FormData: { userId: string, statement: File }
 * @example Upload CSV bank statement for automatic expense/income categorization
 */
router.post("/bank-statement", upload.single("statement"), uploadBankStatement);

/**
 * @route   DELETE /api/v1/chatbot/reset/:userId
 * @desc    Reset conversation state (start fresh)
 */
router.delete("/reset/:userId", clearState);

/**
 * @route   GET /api/v1/chatbot/health
 * @desc    Health check and capabilities overview
 */
router.get("/health", healthCheck);

export default router;
