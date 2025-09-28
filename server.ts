// Main Express server setup
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./src/routes/auth";
import userRoutes from "./src/routes/user";
import expenseRoutes from "./src/routes/expenses";
import incomeRoutes from "./src/routes/income";
import budgetRoutes from "./src/routes/budget";
import financialGoalRoutes from "./src/routes/financialGoal";
import analyticsRoutes from "./src/routes/analytics";
import chatbotRoutes from "./src/routes/chatbot";
import chatHistoryRoutes from "./src/routes/chatHistory";

// Import database and middleware
import { testConnection, closePool } from "./src/config/database";

// Load environment variables
dotenv.config();

const app = express();
// Trust the first proxy (needed for Vercel and rate limiting)
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://vercel.live"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://api.groq.com",
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Rate limiting configuration with different tiers

// High limit for CRUD operations (user data, expenses, income, budgets, goals)
const crudLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute for CRUD operations
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Medium limit for general API calls
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for general use
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for AI endpoints (chat, voice, receipt)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 AI requests per minute (more restrictive)
  message: {
    error: "Too many AI requests from this IP, please try again later.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 auth attempts per 15 minutes
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      console.log(`🌐 CORS check: Origin = '${origin}'`);

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log("✅ CORS: No origin, allowing request");
        return callback(null, true);
      }

      // Remove trailing slash for comparison
      const normalizedOrigin = origin.replace(/\/$/, "");
      console.log(`🔄 CORS: Normalized origin = '${normalizedOrigin}'`);

      const allowedOrigins = (
        process.env.ALLOWED_ORIGINS?.split(",") || [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://127.0.0.1:3000",
          "https://ai-finance-rust.vercel.app",
        ]
      ).map((origin) => origin.replace(/\/$/, "")); // Remove trailing slashes from allowed origins too

      console.log(`📋 CORS: Allowed origins =`, allowedOrigins);

      if (allowedOrigins.includes(normalizedOrigin)) {
        console.log("✅ CORS: Origin allowed");
        return callback(null, true);
      }

      // In development, be more permissive
      if (process.env.NODE_ENV !== "production") {
        // Allow localhost and 127.0.0.1 variants
        if (
          normalizedOrigin.includes("localhost") ||
          normalizedOrigin.includes("127.0.0.1")
        ) {
          console.log("✅ CORS: Development localhost allowed");
          return callback(null, true);
        }
      }

      console.error(
        `❌ CORS Error: Origin '${origin}' not allowed. Allowed origins:`,
        allowedOrigins
      );
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: [
      "X-Request-ID",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" })); // For JSON payloads
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // For form data

// Cookie parsing middleware
app.use(cookieParser());

// Compression middleware (reduces response size by 60-80%)
app.use(compression());

// Logging middleware (essential for debugging and monitoring)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Request ID middleware for tracking and debugging
app.use((req: any, res: any, next: any) => {
  // Generate more robust request ID
  req.requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Finance Assistant Backend is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

// API status endpoint
app.get("/api/status", async (req, res) => {
  try {
    // Test database connection
    await testConnection();

    res.status(200).json({
      success: true,
      services: {
        database: "healthy",
        server: "healthy",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      services: {
        database: "unhealthy",
        server: "healthy",
      },
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes with tiered rate limiting

// Auth routes - Most restrictive (prevent brute force)
app.use("/api/v1/auth", authLimiter, authRoutes);

// CRUD routes - High limits for user data operations
app.use("/api/v1/user", crudLimiter, userRoutes);
app.use("/api/v1/expenses", crudLimiter, expenseRoutes);
app.use("/api/v1/income", crudLimiter, incomeRoutes);
app.use("/api/v1/budgets", crudLimiter, budgetRoutes);
app.use("/api/v1/goals", crudLimiter, financialGoalRoutes);
app.use("/api/v1/analytics", crudLimiter, analyticsRoutes);
app.use("/api/v1/chat-history", crudLimiter, chatHistoryRoutes);

// AI routes - Restrictive limits for expensive operations
app.use("/api/v1/chatbot", aiLimiter, chatbotRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "AI Finance Assistant Backend API",
    version: "1.0.0",
    documentation: "/api/docs",
    health: "/health",
    status: "/api/status",
  });
});

// 404 handler for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: {
      auth: "/api/v1/auth",
      user: "/api/v1/user",
      expenses: "/api/v1/expenses",
      income: "/api/v1/income",
      budgets: "/api/v1/budgets",
      goals: "/api/v1/goals",
      health: "/health",
      status: "/api/status",
    },
  });
});

// Global error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await testConnection();
    console.log("✅ Database connection verified");

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📖 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 API status: http://localhost:${PORT}/api/status`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/v1/auth`);
      console.log(`👤 User endpoints: http://localhost:${PORT}/api/v1/user`);
      console.log(
        `💰 Expense endpoints: http://localhost:${PORT}/api/v1/expenses`
      );
      console.log(
        `💵 Income endpoints: http://localhost:${PORT}/api/v1/income`
      );
      console.log(
        `📊 Budget endpoints: http://localhost:${PORT}/api/v1/budgets`
      );
      console.log(
        `🎯 Financial Goal endpoints: http://localhost:${PORT}/api/v1/goals`
      );
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("🔚 HTTP server closed");

        try {
          await closePool();
          console.log("✅ Database connections closed");
          console.log("👋 Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    // Listen for shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
