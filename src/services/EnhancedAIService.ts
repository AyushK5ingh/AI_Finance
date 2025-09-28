// Enhanced AI Service integrating index.ts capabilities with real database
import { Groq } from "groq-sdk";
import OpenAI from "openai";
import { ExpenseModel, Expense, ExpenseCategory } from "../models/Expense";
import IncomeModel, { CreateIncomeData } from "../models/Income";
import BudgetModel, { CreateBudgetData } from "../models/Budget";
import FinancialGoalModel, {
  CreateFinancialGoalData,
} from "../models/FinancialGoal";
import pool from "../config/database";

// GitHub Models setup (FREE!)
const githubAI = new OpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN,
});

// Groq as backup
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Smart model selection (from index.ts)
function getOptimalModel(task: string) {
  const models: Record<string, { model: string; client: any; type: string }> = {
    "expense-extraction": {
      model: "openai/gpt-4o",
      client: githubAI,
      type: "github",
    },
    conversation: {
      model: "openai/gpt-4o-mini",
      client: githubAI,
      type: "github",
    },
    "spending-analysis": {
      model: "deepseek/deepseek-v3-0324",
      client: githubAI,
      type: "github",
    },
    "receipt-ocr": { model: "openai/gpt-4o", client: githubAI, type: "github" },
    "voice-to-text": {
      model: "openai/whisper-1",
      client: githubAI,
      type: "github",
    },
    backup: { model: "llama-3.3-70b-versatile", client: groq, type: "groq" },
  };

  const selectedModel = models[task] || models["conversation"];
  console.log(
    `📋 Task: ${task} → Model: ${selectedModel.model} (${selectedModel.type})`
  );
  return selectedModel;
}

// Smart AI caller with fallback (from index.ts)
async function callAIWithBestModel(
  task: string,
  messages: any[],
  tools?: any[]
) {
  const config = getOptimalModel(task);
  const startTime = Date.now();

  try {
    console.log(`🚀 Making request to ${config.model}...`);

    let response;
    if (config.type === "github") {
      response = await config.client.chat.completions.create({
        model: config.model,
        messages,
        tools,
        tool_choice: tools ? "auto" : undefined,
      });
    } else {
      // Groq fallback
      response = await config.client.chat.completions.create({
        model: config.model,
        messages,
        tools,
        tool_choice: tools ? "auto" : undefined,
      });
    }

    const duration = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || "unknown";

    console.log(
      `✅ SUCCESS: ${config.model} responded in ${duration}ms (${tokensUsed} tokens)`
    );
    return response;
  } catch (error: any) {
    console.error(`❌ ERROR with ${config.model}:`, error.message);

    // Fallback to Groq
    console.log(`🔄 Falling back to Groq...`);
    const fallback = getOptimalModel("backup");

    try {
      const fallbackResponse = await fallback.client.chat.completions.create({
        model: fallback.model,
        messages,
        tools,
        tool_choice: tools ? "auto" : undefined,
      });

      console.log(`✅ FALLBACK SUCCESS: ${fallback.model}`);
      return fallbackResponse;
    } catch (fallbackError: any) {
      console.error(`❌ FALLBACK FAILED:`, fallbackError.message);
      throw fallbackError;
    }
  }
}

// Extract expense information from user message
export async function extractExpenseFromMessage(
  userId: string,
  message: string
): Promise<{
  hasExpense: boolean;
  expenseData?: {
    name?: string;
    amount?: number;
    category?: string;
    description?: string;
    merchant?: string;
    location?: string;
  };
  missingFields?: string[];
  clarificationQuestion?: string;
}> {
  console.log(`🔍 Analyzing message for expense data: "${message}"`);

  const extractionPrompt = `Analyze this user message and extract expense information if any exists:

Message: "${message}"

Return ONLY valid JSON in this exact format:
{
  "hasExpense": boolean,
  "expenseData": {
    "name": "string (expense description)",
    "amount": number or null,
    "category": "food|transport|entertainment|shopping|bills|healthcare|utilities|other",
    "description": "string or null",
    "merchant": "string or null",
    "location": "string or null"
  },
  "confidence": "high|medium|low"
}

Examples:
- "I spent 150 on coffee at Starbucks" → hasExpense: true, amount: 150, category: "food", merchant: "Starbucks"
- "Bought groceries for 500" → hasExpense: true, amount: 500, category: "food", name: "groceries"
- "How is the weather?" → hasExpense: false
- "I need to buy groceries" → hasExpense: false (future intent, not actual expense)

Be strict: only extract if it's a COMPLETED expense, not future plans.`;

  try {
    const response = await callAIWithBestModel("expense-extraction", [
      { role: "user", content: extractionPrompt },
    ]);

    let content = response.choices[0].message.content || "{}";

    // Clean up markdown code blocks if present
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    console.log(`🔍 Raw AI response: "${content.substring(0, 100)}..."`);

    const result = JSON.parse(content);

    if (!result.hasExpense) {
      return { hasExpense: false };
    }

    // Check for missing required fields
    const missingFields: string[] = [];

    if (!result.expenseData.amount || result.expenseData.amount <= 0) {
      missingFields.push("amount");
    }

    if (!result.expenseData.name && !result.expenseData.description) {
      missingFields.push("description");
    }

    if (!result.expenseData.category) {
      missingFields.push("category");
    }

    // Generate clarification question if fields are missing
    let clarificationQuestion = "";
    if (missingFields.length > 0) {
      if (missingFields.includes("amount")) {
        clarificationQuestion =
          "I see you mentioned an expense! Could you tell me the amount you spent?";
      } else if (missingFields.includes("description")) {
        clarificationQuestion =
          "I see you spent money! Could you tell me what you bought or what the expense was for?";
      } else if (missingFields.includes("category")) {
        clarificationQuestion = `I see you spent ₹${result.expenseData.amount}! What category is this expense? (food, transport, entertainment, shopping, bills, healthcare, utilities, or other)`;
      }
    }

    return {
      hasExpense: true,
      expenseData: result.expenseData,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      clarificationQuestion: clarificationQuestion || undefined,
    };
  } catch (error) {
    console.error("❌ Expense extraction failed:", error);
    return { hasExpense: false };
  }
}

// Auto-categorize expenses based on keywords
function categorizeExpenseAuto(description: string): string {
  const desc = description.toLowerCase();

  if (
    desc.includes("food") ||
    desc.includes("restaurant") ||
    desc.includes("coffee") ||
    desc.includes("lunch") ||
    desc.includes("dinner") ||
    desc.includes("groceries") ||
    desc.includes("snacks") ||
    desc.includes("pizza") ||
    desc.includes("burger")
  ) {
    return "food";
  }
  if (
    desc.includes("uber") ||
    desc.includes("taxi") ||
    desc.includes("bus") ||
    desc.includes("train") ||
    desc.includes("petrol") ||
    desc.includes("fuel") ||
    desc.includes("auto") ||
    desc.includes("metro")
  ) {
    return "transport";
  }
  if (
    desc.includes("movie") ||
    desc.includes("game") ||
    desc.includes("entertainment") ||
    desc.includes("netflix") ||
    desc.includes("spotify") ||
    desc.includes("concert")
  ) {
    return "entertainment";
  }
  if (
    desc.includes("shopping") ||
    desc.includes("clothes") ||
    desc.includes("amazon") ||
    desc.includes("flipkart") ||
    desc.includes("shoes") ||
    desc.includes("shirt")
  ) {
    return "shopping";
  }
  if (
    desc.includes("electricity") ||
    desc.includes("water") ||
    desc.includes("internet") ||
    desc.includes("phone") ||
    desc.includes("rent") ||
    desc.includes("bill")
  ) {
    return "bills";
  }
  if (
    desc.includes("doctor") ||
    desc.includes("medicine") ||
    desc.includes("hospital") ||
    desc.includes("pharmacy") ||
    desc.includes("clinic")
  ) {
    return "healthcare";
  }

  return "other";
}

// Save expense to database
export async function saveExpenseToDatabase(
  userId: string,
  expenseData: {
    name?: string;
    amount: number;
    category?: string;
    description?: string;
    merchant?: string;
    location?: string;
  }
): Promise<{ success: boolean; expense?: any; error?: string }> {
  try {
    console.log(
      `💾 Saving expense to database for user ${userId}:`,
      expenseData
    );

    const expenseModel = new ExpenseModel();

    // Get or create category
    const categoryName =
      expenseData.category ||
      categorizeExpenseAuto(expenseData.description || expenseData.name || "");

    // Get existing categories for the user
    const categories = await expenseModel.getCategories(userId);
    let category = categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!category) {
      // Create default category if it doesn't exist
      category = await expenseModel.createCategory(userId, {
        name: categoryName,
        color: getDefaultColorForCategory(categoryName),
        icon: getDefaultIconForCategory(categoryName),
      });
    }

    // Create expense
    const expenseCreateData = {
      categoryId: category.id,
      name:
        expenseData.name ||
        expenseData.description ||
        `${categoryName} expense`,
      amount: expenseData.amount,
      description: expenseData.description || expenseData.name,
      merchant: expenseData.merchant,
      location: expenseData.location,
      tags: [],
      expenseDate: new Date(),
    };

    const expense = await expenseModel.create(userId, expenseCreateData);

    console.log(`✅ Expense saved successfully with ID: ${expense.id}`);

    return {
      success: true,
      expense: {
        ...expense,
        categoryName: category.name,
      },
    };
  } catch (error: any) {
    console.error("❌ Failed to save expense:", error);
    return { success: false, error: error.message };
  }
}

// Get default colors and icons for categories
function getDefaultColorForCategory(category: string): string {
  const colors: Record<string, string> = {
    food: "#FF6B6B",
    transport: "#4ECDC4",
    entertainment: "#45B7D1",
    shopping: "#96CEB4",
    bills: "#FFEAA7",
    healthcare: "#DDA0DD",
    utilities: "#98D8C8",
    other: "#B8B8B8",
  };
  return colors[category] || colors.other;
}

function getDefaultIconForCategory(category: string): string {
  const icons: Record<string, string> = {
    food: "🍽️",
    transport: "🚗",
    entertainment: "🎬",
    shopping: "🛍️",
    bills: "📄",
    healthcare: "🏥",
    utilities: "⚡",
    other: "💳",
  };
  return icons[category] || icons.other;
}

// Process voice to text using Whisper
export async function processVoiceToText(audioBuffer: Buffer): Promise<string> {
  console.log("🎤 Converting voice to text with Whisper...");

  try {
    const config = getOptimalModel("voice-to-text");

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioBuffer], { type: "audio/wav" }),
      "audio.wav"
    );
    formData.append("model", "whisper-1");

    const response = await fetch(
      `${config.client.baseURL}/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.client.apiKey}`,
        },
        body: formData,
      }
    );

    const result = (await response.json()) as { text: string };
    console.log("✅ Voice transcription successful:", result.text);
    return result.text;
  } catch (error: any) {
    console.error("❌ Voice transcription failed:", error.message);
    throw error;
  }
}

// Receipt OCR Function
export async function scanReceiptOCR(
  imageBase64: string,
  userId: string
): Promise<{
  success: boolean;
  expenseData?: any;
  error?: string;
}> {
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: `Extract receipt data and return ONLY valid JSON:
        {
          "merchant": "store name",
          "total": number,
          "items": [{"name": "item", "price": number}],
          "category": "food|transport|entertainment|shopping|bills|healthcare|utilities",
          "date": "YYYY-MM-DD",
          "confidence": "high|medium|low"
        }`,
        },
        {
          type: "image_url" as const,
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
        },
      ],
    },
  ];

  try {
    console.log("🔍 Scanning receipt with OCR...");
    const response = await callAIWithBestModel("receipt-ocr", messages);

    let content = response.choices[0].message.content || "{}";

    // Clean up markdown code blocks if present
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    console.log(`📄 Raw OCR response: "${content.substring(0, 100)}..."`);

    const extracted = JSON.parse(content);

    // Auto-save to database
    const saveResult = await saveExpenseToDatabase(userId, {
      name: `${extracted.merchant} - ${
        extracted.items?.[0]?.name || "Purchase"
      }`,
      amount: extracted.total,
      category: extracted.category,
      merchant: extracted.merchant,
      description: `Receipt scan: ${extracted.items
        ?.map((i: any) => i.name)
        .join(", ")}`,
    });

    if (saveResult.success) {
      return { success: true, expenseData: saveResult.expense };
    } else {
      return { success: false, error: saveResult.error };
    }
  } catch (error: any) {
    console.error("❌ Receipt OCR failed:", error);
    return { success: false, error: error.message };
  }
}

// AI-powered spending analysis
export async function analyzeSpendingWithAI(
  userId: string,
  userQuery?: string,
  conversationContext?: string
): Promise<string> {
  try {
    console.log("🔍 Starting AI spending analysis...");

    const expenseModel = new ExpenseModel();
    // Get user's recent expenses from database
    const result = await expenseModel.findByUser(userId, {}, 1, 50);
    const expenses = result.expenses;

    if (!expenses || expenses.length === 0) {
      return "No spending data available for analysis.";
    }

    const spendingData = {
      totalExpenses: expenses.reduce(
        (sum: number, e: Expense) => sum + e.amount,
        0
      ),
      expenseCount: expenses.length,
      categories: expenses.reduce((acc: any, e: Expense) => {
        const category = (e as any).category?.name || "other";
        acc[category] = (acc[category] || 0) + e.amount;
        return acc;
      }, {}),
      recentExpenses: expenses.slice(0, 5),
      timeRange: "last 50 transactions",
    };

    const analysisPrompt = `Analyze this real spending data for an Indian user and provide insights in INR (₹):
    ${JSON.stringify(spendingData, null, 2)}
    
    ${userQuery ? `User's Current Question: "${userQuery}"` : ""}
    ${
      conversationContext
        ? `\nConversation Context:\n${conversationContext}`
        : ""
    }
    
    IMPORTANT INSTRUCTIONS:
    - Use INR currency (₹) for ALL amounts, not USD ($)
    - Answer the user's specific question if provided
    - If user asks about "last expense" or similar, reference recent transactions from the data
    - Focus on travel/transport related expenses if asked about travel
    - Current date: August 8, 2025 (consider "last month" as July 2025)
    - Categories to check for travel: transport, travel, cab, taxi, fuel, metro, bus, flight
    
    Provide insights about:
    1. **Direct answer to user's question** (if specific question asked)
    2. **Spending patterns** in INR (₹)
    3. **Top spending categories** with amounts in ₹
    4. **Month-specific analysis** (filter by date if requested)
    5. **Recommendations for saving** 
    
    FORMAT: Use ₹ symbol for all amounts. Be specific and reference actual data from the transactions.
    
    Keep it concise and actionable.`;

    const response = await callAIWithBestModel("spending-analysis", [
      { role: "user", content: analysisPrompt },
    ]);

    console.log("✅ Spending analysis completed successfully!");
    return response.choices[0].message.content || "Analysis unavailable";
  } catch (error) {
    console.error("❌ Spending analysis failed:", error);
    return "Unable to analyze spending at the moment. Try again later.";
  }
}

// Get user's balance from database
export async function getUserBalance(userId: string): Promise<string> {
  try {
    const expenseModel = new ExpenseModel();
    const incomeModel = new IncomeModel();

    // Get total expenses and income from database
    const [expenseResult, incomeResult] = await Promise.all([
      expenseModel.findByUser(userId),
      incomeModel.findByUser(userId),
    ]);

    const expenses = expenseResult.expenses;
    const incomes = incomeResult.income;

    const totalExpenses = expenses.reduce(
      (sum: number, e: Expense) => sum + e.amount,
      0
    );

    const totalIncome = incomes.reduce(
      (sum: number, i: any) => sum + i.amount,
      0
    );

    const balance = totalIncome - totalExpenses;

    // Get expenses by category
    const expensesByCategory = expenses.reduce((acc: any, e: Expense) => {
      const category = (e as any).category?.name || "Other";
      acc[category] = (acc[category] || 0) + e.amount;
      return acc;
    }, {});

    // Get income by source
    const incomeBySource = incomes.reduce((acc: any, i: any) => {
      const source = i.source_type || "Other";
      acc[source] = (acc[source] || 0) + i.amount;
      return acc;
    }, {});

    const expenseBreakdown = Object.entries(expensesByCategory)
      .map(([cat, amount]) => `${cat}: ₹${amount}`)
      .join(", ");

    const incomeBreakdown = Object.entries(incomeBySource)
      .map(([source, amount]) => `${source}: ₹${amount}`)
      .join(", ");

    return (
      `💰 **Your Financial Summary**\n\n` +
      `📊 **Balance:** ₹${balance} ${balance >= 0 ? "✅" : "⚠️"}\n\n` +
      `📈 **Total Income:** ₹${totalIncome}\n${
        incomeBreakdown ? `   ${incomeBreakdown}\n` : ""
      }\n` +
      `📉 **Total Expenses:** ₹${totalExpenses}\n${
        expenseBreakdown ? `   ${expenseBreakdown}\n` : ""
      }\n` +
      `🎯 **Financial Health:** ${
        balance >= 0
          ? "Good - You have positive balance!"
          : "Attention needed - Expenses exceed income"
      }`
    );
  } catch (error) {
    console.error("❌ Failed to get user balance:", error);
    return "Unable to fetch balance information right now.";
  }
}

// 🚀 ENHANCED FINANCIAL DATA EXTRACTION - Supports ALL Controllers!
export async function extractFinancialData(
  message: string,
  conversationContext?: string
): Promise<{
  type:
    | "expense"
    | "income"
    | "budget"
    | "goal"
    | "analytics"
    | "advice"
    | "none";
  hasData: boolean;
  data?: any;
  isMultiple?: boolean;
  missingFields?: string[];
  clarificationQuestion?: string;
}> {
  const extractionPrompt = `You are an AI financial assistant. Analyze this user message and extract financial intent/data.

${
  conversationContext
    ? `
**Previous Conversation Context:**
${conversationContext}
`
    : ""
}

**Current User Message:** "${message}"

Based on the message (and conversation context if provided), determine the intent and extract relevant data.

Return a JSON object with this structure:
{
  "type": "expense|income|budget|goal|analytics|advice|none",
  "hasData": boolean,
  "data": {
    // For expense: { name, amount, category, merchant, description } OR [array of expenses]
    // For income: { source, amount, frequency }
    // For budget: { category, amount, period }
    // For goal: { name, targetAmount, deadline }
    // For analytics: { requestType: "spending_analysis|balance|insights|investment_advice" }
    // For advice: { requestType: "investment|savings|budget_recommendation|financial_planning|affordability|savings_timeline" }
  },
  "isMultiple": boolean // true if multiple expenses detected
}

Examples:
- "I spent 150 on coffee" → expense (single)
- "I spent 500 on coffee, 300 on lunch, 200 on uber" → expense (multiple array)
- "Got 50000 salary this month" → income  
- "Set 5000 food budget for this month" → budget
- "Want to save 100000 for vacation by December" → goal
- "Show my spending analysis" → analytics
- "How much did I spend?" → analytics
- "What was my last expense?" → analytics (with context awareness)
- "How much can I invest in stocks?" → advice (investment)
- "Should I invest in mutual funds?" → advice (investment) 
- "How much should I save monthly?" → advice (savings)
- "Can I afford iPhone worth 50k?" → advice (affordability with amount: 50000, item: "iPhone")
- "Should I buy a car for 800000?" → advice (affordability with amount: 800000, item: "car")
- "When can I afford iPhone worth 50k?" → advice (savings_timeline with amount: 50000, item: "iPhone")
- "How long to save for iPhone 50k?" → advice (savings_timeline with amount: 50000, item: "iPhone")
- "In how much time will I be able to afford it?" → advice (savings_timeline)

For multiple expenses, return data as array:
{
  "type": "expense",
  "hasData": true,
  "isMultiple": true,
  "data": [
    { "name": "coffee", "amount": 500, "category": "food" },
    { "name": "lunch", "amount": 300, "category": "food" },
    { "name": "uber", "amount": 200, "category": "transport" }
  ]
}

Return ONLY the JSON object.`;

  try {
    console.log(`🔍 Extracting financial data from: "${message}"`);

    const response = await callAIWithBestModel("expense-extraction", [
      { role: "user", content: extractionPrompt },
    ]);

    let content = response.choices[0].message.content || "{}";

    // Clean up markdown code blocks if present
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    console.log(`📋 AI extracted: "${content.substring(0, 200)}..."`);

    const result = JSON.parse(content);

    if (!result.type || result.type === "none") {
      return { type: "none", hasData: false };
    }

    // Validate and return structured data
    return {
      type: result.type,
      hasData: true,
      data: result.data,
      isMultiple: result.isMultiple || false,
    };
  } catch (error) {
    console.error("❌ Financial data extraction failed:", error);
    return { type: "none", hasData: false };
  }
}

// 💰 INCOME PROCESSING
export async function saveIncomeToDatabase(
  userId: string,
  incomeData: {
    name: string;
    amount: number;
    sourceType?: string;
    isRecurring?: boolean;
    description?: string;
  }
): Promise<{ success: boolean; income?: any; error?: string }> {
  try {
    console.log(`💰 Saving income to database for user ${userId}:`, incomeData);

    const incomeModel = new IncomeModel();

    // Create income source if needed
    let sourceId: string | undefined = undefined;
    if (incomeData.sourceType) {
      const sources = await incomeModel.getSources(userId);
      let existingSource = sources.find(
        (s) =>
          s.sourceType === incomeData.sourceType ||
          s.name.toLowerCase().includes(incomeData.sourceType!.toLowerCase())
      );

      if (!existingSource) {
        const newSource = await incomeModel.createSource(userId, {
          name: incomeData.sourceType,
          sourceType: incomeData.sourceType as any,
          isRecurring: incomeData.isRecurring || false,
        });
        sourceId = newSource.id;
      } else {
        sourceId = existingSource.id;
      }
    }

    const createData: CreateIncomeData = {
      sourceId,
      name: incomeData.name,
      amount: incomeData.amount,
      description: incomeData.description,
      isRecurring: incomeData.isRecurring || false,
      incomeDate: new Date(),
    };

    const income = await incomeModel.create(userId, createData);

    console.log(`✅ Income saved successfully with ID: ${income.id}`);

    return { success: true, income };
  } catch (error: any) {
    console.error("❌ Failed to save income:", error);
    return { success: false, error: error.message };
  }
}

// 📊 BUDGET PROCESSING
export async function saveBudgetToDatabase(
  userId: string,
  budgetData: {
    name: string;
    amount: number;
    category?: string;
    periodType?: string;
    alertThreshold?: number;
  }
): Promise<{ success: boolean; budget?: any; error?: string }> {
  try {
    console.log(`📊 Saving budget to database for user ${userId}:`, budgetData);

    const budgetModel = new BudgetModel();
    const expenseModel = new ExpenseModel();

    // Get or create category if specified
    let categoryId: string | undefined = undefined;
    if (budgetData.category) {
      const categories = await expenseModel.getCategories(userId);
      let category = categories.find(
        (c) => c.name.toLowerCase() === budgetData.category?.toLowerCase()
      );

      if (!category) {
        category = await expenseModel.createCategory(userId, {
          name: budgetData.category,
          color: getDefaultColorForCategory(budgetData.category),
          icon: getDefaultIconForCategory(budgetData.category),
        });
      }
      categoryId = category.id;
    }

    const createData: CreateBudgetData = {
      categoryId,
      name: budgetData.name,
      amount: budgetData.amount,
      periodType: (budgetData.periodType as any) || "monthly",
      startDate: new Date(),
      alertThreshold: budgetData.alertThreshold || 0.8,
    };

    const budget = await budgetModel.create(userId, createData);

    console.log(`✅ Budget saved successfully with ID: ${budget.id}`);

    return { success: true, budget };
  } catch (error: any) {
    console.error("❌ Failed to save budget:", error);
    return { success: false, error: error.message };
  }
}

// 🎯 FINANCIAL GOAL PROCESSING
export async function saveGoalToDatabase(
  userId: string,
  goalData: {
    name: string;
    goalType?: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    priority?: number;
  }
): Promise<{ success: boolean; goal?: any; error?: string }> {
  try {
    console.log(`🎯 Saving goal to database for user ${userId}:`, goalData);

    const goalModel = new FinancialGoalModel();

    const createData: CreateFinancialGoalData = {
      name: goalData.name,
      goalType: (goalData.goalType as any) || "savings",
      targetAmount: goalData.targetAmount,
      currentAmount: goalData.currentAmount || 0,
      targetDate: goalData.targetDate
        ? new Date(goalData.targetDate)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      priority: goalData.priority || 2,
    };

    const goal = await goalModel.create(userId, createData);

    console.log(`✅ Goal saved successfully with ID: ${goal.id}`);

    return { success: true, goal };
  } catch (error: any) {
    console.error("❌ Failed to save goal:", error);
    return { success: false, error: error.message };
  }
}

// 📈 ANALYTICS PROCESSING
export async function getFinancialAnalytics(
  userId: string,
  requestType: string,
  userQuery?: string,
  conversationContext?: string
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
  try {
    console.log(`📈 Getting ${requestType} analytics for user ${userId}`);

    const expenseModel = new ExpenseModel();
    const incomeModel = new IncomeModel();
    const budgetModel = new BudgetModel();
    const goalModel = new FinancialGoalModel();

    switch (requestType) {
      case "dashboard":
      case "summary":
        // Get comprehensive dashboard data
        const [expenses, incomes, budgets, goals] = await Promise.all([
          expenseModel.findByUser(userId, {}, 1, 100),
          incomeModel.findByUser(userId, {}, 1, 100),
          budgetModel.findByUser(userId, {}, 1, 20),
          goalModel.findByUser(userId, {}, 1, 10),
        ]);

        const totalExpenses = expenses.expenses.reduce(
          (sum, e) => sum + e.amount,
          0
        );
        const totalIncome = incomes.income.reduce(
          (sum, i) => sum + i.amount,
          0
        );
        const balance = totalIncome - totalExpenses;

        return {
          success: true,
          data: {
            balance,
            totalIncome,
            totalExpenses,
            expenseCount: expenses.total,
            incomeCount: incomes.total,
            budgetCount: budgets.total,
            goalCount: goals.total,
            financialHealth: balance > 0 ? "Positive" : "Needs Attention",
          },
          message: `📊 **Financial Summary**\n💰 Balance: ₹${balance}\n📈 Income: ₹${totalIncome}\n📉 Expenses: ₹${totalExpenses}\n🎯 Active Goals: ${goals.total}\n📊 Active Budgets: ${budgets.total}`,
        };

      case "spending_analysis":
        const analysisResult = await analyzeSpendingWithAI(
          userId,
          userQuery,
          conversationContext
        );
        return {
          success: true,
          message: analysisResult,
        };

      case "balance":
        const balanceResult = await getUserBalance(userId);
        return {
          success: true,
          message: balanceResult,
        };

      case "insights":
        // Generate AI insights
        const analyticsData = await getComprehensiveFinancialData(userId);
        const insights = await generateFinancialInsights(analyticsData);

        return {
          success: true,
          data: analyticsData,
          message: insights,
        };

      default:
        return {
          success: false,
          error: `Unknown analytics request: ${requestType}`,
        };
    }
  } catch (error: any) {
    console.error("❌ Failed to get analytics:", error);
    return { success: false, error: error.message };
  }
}

// 🔍 Get comprehensive financial data for insights
async function getComprehensiveFinancialData(userId: string) {
  const expenseModel = new ExpenseModel();
  const incomeModel = new IncomeModel();
  const budgetModel = new BudgetModel();
  const goalModel = new FinancialGoalModel();

  const [expenses, incomes, budgets, goals] = await Promise.all([
    expenseModel.findByUser(userId, {}, 1, 50),
    incomeModel.findByUser(userId, {}, 1, 50),
    budgetModel.findByUser(userId, {}, 1, 20),
    goalModel.findByUser(userId, {}, 1, 10),
  ]);

  return {
    expenses: expenses.expenses,
    incomes: incomes.income,
    budgets: budgets.budgets,
    goals: goals.goals,
    summary: {
      totalExpenses: expenses.expenses.reduce((sum, e) => sum + e.amount, 0),
      totalIncome: incomes.income.reduce((sum, i) => sum + i.amount, 0),
      expenseCount: expenses.total,
      incomeCount: incomes.total,
      budgetCount: budgets.total,
      goalCount: goals.total,
    },
  };
}

// 🧠 Generate AI-powered financial insights
async function generateFinancialInsights(data: any): Promise<string> {
  const insightsPrompt = `Analyze this comprehensive financial data and provide actionable insights:

${JSON.stringify(data.summary, null, 2)}

Recent Expenses: ${data.expenses
    .slice(0, 5)
    .map((e: any) => `₹${e.amount} - ${e.name}`)
    .join(", ")}
Recent Income: ${data.incomes
    .slice(0, 3)
    .map((i: any) => `₹${i.amount} - ${i.name}`)
    .join(", ")}
Active Budgets: ${data.budgets
    .map((b: any) => `₹${b.amount} - ${b.name}`)
    .join(", ")}
Financial Goals: ${data.goals
    .map((g: any) => `₹${g.targetAmount} - ${g.name}`)
    .join(", ")}

Provide insights about:
1. 💰 Income vs Expense ratio
2. 📊 Budget adherence  
3. 🎯 Goal progress
4. ⚠️ Financial warnings
5. 💡 Recommendations

Keep it concise, actionable, and use emojis.`;

  try {
    const response = await callAIWithBestModel("spending-analysis", [
      { role: "user", content: insightsPrompt },
    ]);

    return response.choices[0].message.content || "Unable to generate insights";
  } catch (error) {
    console.error("❌ Failed to generate insights:", error);
    return "Unable to generate insights at the moment.";
  }
}
