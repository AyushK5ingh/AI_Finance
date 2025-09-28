// TypeScript Models and Interfaces for Finance Assistant Backend API

// 1. USER AUTHENTICATION & MANAGEMENT
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  timezone: string;
  currency: string;
  monthlyBudget: number;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone?: string;
  currency?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DeviceInfo {
  deviceType: "mobile" | "desktop" | "tablet";
  os: string;
  browser?: string;
  appVersion?: string;
}

// 2. EXPENSE MANAGEMENT
export interface ExpenseCategory {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  budgetLimit?: number;
  createdAt: Date;
}

export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  amount: number;
  description?: string;
  receiptUrl?: string;
  receiptData?: ReceiptOCRData;
  location?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  tags: string[];
  aiConfidence?: number;
  isAnomaly: boolean;
  expenseDate: Date;
  createdAt: Date;
  updatedAt: Date;
  category?: ExpenseCategory; // Joined data
}

export interface CreateExpenseRequest {
  categoryId: string;
  name: string;
  amount: number;
  description?: string;
  location?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  tags?: string[];
  expenseDate?: Date;
}

export interface UpdateExpenseRequest extends Partial<CreateExpenseRequest> {
  id: string;
}

export type PaymentMethod =
  | "cash"
  | "card"
  | "upi"
  | "wallet"
  | "bank_transfer";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

// 3. INCOME MANAGEMENT
export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  sourceType: IncomeSourceType;
  isRecurring: boolean;
  recurringDay?: number;
  createdAt: Date;
}

export interface Income {
  id: string;
  userId: string;
  sourceId: string;
  name: string;
  amount: number;
  description?: string;
  isRecurring: boolean;
  incomeDate: Date;
  createdAt: Date;
  source?: IncomeSource; // Joined data
}

export type IncomeSourceType =
  | "salary"
  | "freelance"
  | "business"
  | "investment"
  | "other";

export interface CreateIncomeRequest {
  sourceId: string;
  name: string;
  amount: number;
  description?: string;
  isRecurring?: boolean;
  incomeDate?: Date;
}

// 4. AI INTERACTIONS & VOICE
export interface AIInteraction {
  id: string;
  userId: string;
  interactionType: AIInteractionType;
  modelUsed: string;
  inputData: any;
  outputData: any;
  tokensUsed?: number;
  responseTimeMs?: number;
  costUsd?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export type AIInteractionType =
  | "chat"
  | "voice"
  | "receipt_ocr"
  | "analysis"
  | "prediction";

export interface VoiceCommand {
  id: string;
  userId: string;
  transcript: string;
  intent?: string;
  confidence?: number;
  parameters?: any;
  response?: string;
  audioUrl?: string;
  processedAt: Date;
}

export interface ProcessVoiceRequest {
  audioFile: File | Buffer;
  audioFormat?: "wav" | "mp3" | "ogg";
}

export interface VoiceResponse {
  transcript: string;
  intent: string;
  parameters: any;
  response: string;
  audioUrl?: string; // TTS response audio
}

// 5. RECEIPT OCR
export interface ReceiptOCRData {
  merchant: string;
  total: number;
  items: ReceiptItem[];
  category: string;
  date: string;
  confidence: "high" | "medium" | "low";
  extractedText?: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}

export interface ScanReceiptRequest {
  imageFile: File | Buffer;
  imageFormat?: "jpg" | "jpeg" | "png" | "pdf";
}

export interface ScanReceiptResponse {
  ocrData: ReceiptOCRData;
  suggestedExpense: CreateExpenseRequest;
  autoAdded: boolean;
}

// 6. BUDGETS & FINANCIAL GOALS
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  amount: number;
  periodType: BudgetPeriod;
  startDate: Date;
  endDate?: Date;
  alertThreshold: number;
  isActive: boolean;
  createdAt: Date;
  category?: ExpenseCategory;
  spent?: number; // Calculated field
  remaining?: number; // Calculated field
}

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date;
  goalType: GoalType;
  priority: 1 | 2 | 3;
  isAchieved: boolean;
  createdAt: Date;
  progress?: number; // Calculated percentage
}

export type GoalType = "savings" | "debt_payoff" | "investment";

// 7. ANALYTICS & INSIGHTS
export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  monthlySpending: MonthlySpending[];
  categoryBreakdown: CategorySpending[];
  recentTransactions: (Expense | Income)[];
  budgetStatus: BudgetStatus[];
  anomalies: Expense[];
  upcomingBills: Expense[];
}

export interface MonthlySpending {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface BudgetStatus {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "safe" | "warning" | "exceeded";
}

export interface SpendingAnalysis {
  insights: string[];
  recommendations: string[];
  predictions: {
    nextMonthSpending: number;
    categoryPredictions: CategoryPrediction[];
  };
  anomalies: AnomalyAlert[];
  trends: SpendingTrend[];
}

export interface CategoryPrediction {
  categoryId: string;
  categoryName: string;
  predictedAmount: number;
  confidence: number;
}

export interface AnomalyAlert {
  expenseId: string;
  type: "amount" | "frequency" | "timing" | "location";
  message: string;
  severity: "low" | "medium" | "high";
}

export interface SpendingTrend {
  category: string;
  trend: "increasing" | "decreasing" | "stable";
  changePercentage: number;
  timeframe: string;
}

// 8. NOTIFICATIONS
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  actionUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export type NotificationType = "info" | "warning" | "alert" | "success";

// 9. API REQUEST/RESPONSE TYPES
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface FilterParams {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  tags?: string[];
}

// 10. CHAT & AI ASSISTANT
export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  modelUsed: string;
  tokensUsed?: number;
  responseTime?: number;
  context?: any; // Previous conversation context
  createdAt: Date;
}

export interface ChatRequest {
  message: string;
  context?: string; // Previous conversation ID
  includeFinancialData?: boolean;
}

export interface ChatResponse {
  response: string;
  modelUsed: string;
  tokensUsed: number;
  responseTime: number;
  contextId: string;
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  type: "add_expense" | "create_budget" | "view_analytics" | "set_goal";
  label: string;
  data?: any;
}

// 11. EXPORT FORMATS
export interface ExportRequest {
  format: "csv" | "pdf" | "excel";
  type: "expenses" | "income" | "full_report";
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  includeCategories?: string[];
}

export interface ExportResponse {
  downloadUrl: string;
  expiresAt: Date;
  fileName: string;
  fileSize: number;
}

// 12. MODEL HEALTH & MONITORING
export interface ModelHealth {
  modelName: string;
  status: "healthy" | "degraded" | "down";
  responseTime: number;
  successRate: number;
  lastChecked: Date;
  errorDetails?: string;
}

export interface SystemHealth {
  database: "healthy" | "degraded" | "down";
  aiModels: ModelHealth[];
  storage: "healthy" | "degraded" | "down";
  overallStatus: "healthy" | "degraded" | "down";
}
