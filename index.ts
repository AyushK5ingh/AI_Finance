import readline from "node:readline/promises";
import { Groq } from "groq-sdk";
import OpenAI from "openai";

const expenseDB: Array<{
  name: string;
  amount: number;
  category?: string;
  date?: Date;
}> = [];
const incomeDB: Array<{ name: string; amount: number; date?: Date }> = [];

// GitHub Models setup (FREE!)
const githubAI = new OpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN,
});

// Groq as backup
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Smart model selection
function getOptimalModel(task: string) {
  const models: Record<string, { model: string; client: any; type: string }> = {
    "receipt-ocr": { model: "openai/gpt-4o", client: githubAI, type: "github" },
    "image-analysis": {
      model: "openai/gpt-4o",
      client: githubAI,
      type: "github",
    },
    "spending-analysis": {
      model: "deepseek/deepseek-v3-0324",
      client: githubAI,
      type: "github",
    },
    predictions: {
      model: "deepseek/deepseek-v3-0324",
      client: githubAI,
      type: "github",
    },
    "quick-response": {
      model: "openai/gpt-4o-mini",
      client: githubAI,
      type: "github",
    },
    "voice-to-text": {
      model: "openai/whisper-1",
      client: githubAI,
      type: "github",
    },
    "text-to-speech": {
      model: "openai/tts-1",
      client: githubAI,
      type: "github",
    },
    backup: { model: "llama-3.3-70b-versatile", client: groq, type: "groq" },
  };

  const selectedModel = models[task] || models["quick-response"];
  console.log(
    `📋 Task: ${task} → Model: ${selectedModel.model} (${selectedModel.type})`
  );

  return selectedModel;
}

// Smart AI caller with fallback
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
    console.log(
      `📝 Response preview: "${response.choices[0].message.content?.substring(
        0,
        100
      )}..."`
    );
    console.log(`🎯 Model Used: ${config.model} | Task: ${task}`);

    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `❌ ERROR with ${config.model} after ${duration}ms:`,
      error.message
    );

    // Fallback to Groq
    console.log(`🔄 Falling back to Groq...`);
    const fallback = getOptimalModel("backup");
    const fallbackStartTime = Date.now();

    try {
      const fallbackResponse = await fallback.client.chat.completions.create({
        model: fallback.model,
        messages,
        tools,
        tool_choice: tools ? "auto" : undefined,
      });

      const fallbackDuration = Date.now() - fallbackStartTime;
      console.log(
        `✅ FALLBACK SUCCESS: ${fallback.model} responded in ${fallbackDuration}ms`
      );

      return fallbackResponse;
    } catch (fallbackError: any) {
      console.error(
        `❌ FALLBACK FAILED: ${fallback.model}:`,
        fallbackError.message
      );
      throw fallbackError;
    }
  }
}

// Receipt OCR Function (IMPRESSIVE!)
async function scanReceiptOCR(imageBase64: string) {
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
    const response = await callAIWithBestModel("receipt-ocr", messages);
    const extracted = JSON.parse(response.choices[0].message.content);

    // Auto-add to expenses
    addSmartExpense(extracted);
    return extracted;
  } catch (error) {
    console.error("Receipt OCR failed:", error);
    return null;
  }
}

// Smart expense addition with categorization
function addSmartExpense(receiptData: any) {
  const expense = {
    name: `${receiptData.merchant} - ${
      receiptData.items?.[0]?.name || "Purchase"
    }`,
    amount: receiptData.total,
    category: receiptData.category,
    date: new Date(receiptData.date || Date.now()),
  };

  expenseDB.push(expense);

  // Smart alerts
  const alerts = detectAnomalies(expense);
  if (alerts.length > 0) {
    console.log("🚨 SMART ALERTS:");
    alerts.forEach((alert) => console.log(alert));
  }

  return expense;
}

// Anomaly detection
function detectAnomalies(expense: any) {
  const alerts = [];

  // Check if spending is unusual for category
  const categoryExpenses = expenseDB.filter(
    (e) => e.category === expense.category
  );
  if (categoryExpenses.length > 0) {
    const avgAmount =
      categoryExpenses.reduce((sum, e) => sum + e.amount, 0) /
      categoryExpenses.length;
    if (expense.amount > avgAmount * 2) {
      alerts.push(
        `💰 UNUSUAL: ₹${expense.amount} is 2x your usual ${expense.category} spending`
      );
    }
  }

  // Check time of purchase
  const hour = expense.date.getHours();
  if (hour < 6 || hour > 23) {
    alerts.push(
      `🌙 LATE NIGHT: Purchase at ${hour}:00 - was this intentional?`
    );
  }

  return alerts;
}

// Model Health Checker
async function testAllModels() {
  console.log("\n🔧 Testing all models...\n");

  const testPrompt = [{ role: "user", content: "Say 'Hello' in one word." }];
  const models = [
    { task: "quick-response", name: "GPT-4o-mini" },
    { task: "spending-analysis", name: "DeepSeek-V3" },
    { task: "receipt-ocr", name: "GPT-4o" },
    { task: "voice-to-text", name: "Whisper-1" },
    { task: "text-to-speech", name: "TTS-1" },
    { task: "backup", name: "Llama-3.3-70B (Groq)" },
  ];

  const results = [];

  for (const model of models) {
    try {
      console.log(`Testing ${model.name}...`);
      const startTime = Date.now();

      const response = await callAIWithBestModel(model.task, testPrompt);
      const duration = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || "unknown";

      results.push({
        name: model.name,
        status: "✅ Working",
        duration: `${duration}ms`,
        tokens: tokensUsed,
        response: response.choices[0].message.content?.trim(),
      });
    } catch (error: any) {
      results.push({
        name: model.name,
        status: "❌ Failed",
        duration: "N/A",
        tokens: "N/A",
        response: error.message,
      });
    }
  }

  // Display results
  console.log("\n📊 MODEL HEALTH REPORT:");
  console.log("=".repeat(50));
  results.forEach((result) => {
    console.log(`${result.status} ${result.name}`);
    console.log(`   Duration: ${result.duration} | Tokens: ${result.tokens}`);
    console.log(`   Response: "${result.response}"`);
    console.log("");
  });

  return results;
}

// Voice Processing Functions
async function processVoiceToText(audioBuffer: Buffer): Promise<string> {
  console.log("🎤 Converting voice to text with Whisper...");

  try {
    const config = getOptimalModel("voice-to-text");

    // Create form data for audio upload
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

async function processTextToSpeech(text: string): Promise<Buffer> {
  console.log("🔊 Converting text to speech...");

  try {
    const config = getOptimalModel("text-to-speech");

    const response = await fetch(`${config.client.baseURL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.client.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
        speed: 1.0,
      }),
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    console.log("✅ Text-to-speech conversion successful");
    return audioBuffer;
  } catch (error: any) {
    console.error("❌ Text-to-speech failed:", error.message);
    throw error;
  }
}

// Smart Voice Command Processor
function parseVoiceCommand(transcript: string): {
  intent: string;
  params: any;
} {
  const text = transcript.toLowerCase();

  // Add expense commands
  if (
    text.includes("add expense") ||
    text.includes("spent") ||
    text.includes("bought")
  ) {
    const amountMatch = text.match(/(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : null;

    let category = "other";
    if (
      text.includes("food") ||
      text.includes("coffee") ||
      text.includes("restaurant")
    )
      category = "food";
    if (
      text.includes("uber") ||
      text.includes("taxi") ||
      text.includes("transport")
    )
      category = "transport";
    if (text.includes("shopping") || text.includes("bought"))
      category = "shopping";

    return {
      intent: "add_expense",
      params: { name: transcript, amount, category },
    };
  }

  // Balance check
  if (
    text.includes("balance") ||
    text.includes("money left") ||
    text.includes("how much")
  ) {
    return { intent: "check_balance", params: {} };
  }

  // Analysis
  if (
    text.includes("analyze") ||
    text.includes("spending pattern") ||
    text.includes("insights")
  ) {
    return { intent: "analyze_spending", params: {} };
  }

  // Default to chat
  return { intent: "chat", params: { message: transcript } };
}

// Voice Command Handler
async function handleVoiceCommand(command: string): Promise<string> {
  console.log(`🎤 Processing voice command: "${command}"`);

  const parsed = parseVoiceCommand(command);
  console.log(`🧠 Parsed intent: ${parsed.intent}`, parsed.params);

  try {
    switch (parsed.intent) {
      case "add_expense":
        if (parsed.params.amount) {
          const result = addExpense({
            name: parsed.params.name,
            amount: parsed.params.amount,
            category: parsed.params.category,
          });
          return `✅ Added ₹${parsed.params.amount} expense for ${parsed.params.category}. ${result}`;
        }
        return "I couldn't understand the amount. Please say something like 'I spent 100 on coffee'";

      case "check_balance":
        return getMoneyBalance();

      case "analyze_spending":
        return await analyzeSpendingWithAI();

      default:
        // For general chat, use AI
        const response = await callAIWithBestModel("quick-response", [
          { role: "user", content: command },
        ]);
        return (
          response.choices[0].message.content || "I didn't understand that."
        );
    }
  } catch (error: any) {
    console.error("❌ Voice command processing failed:", error.message);
    return "Sorry, I had trouble processing that voice command. Please try again.";
  }
}
async function callAgent() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: any[] = [
    {
      role: "system",
      content: `You are Josh, a personal finance assistant. Your task is to assist user with their expenses, balances and financial planning.
      You have access to following tools:
      1. getTotalExpenses({from, to}): string // Get total expense for a time period.
      2. addExpense({name, amount, category}): string // Add new expense to the expense database.
      3. addIncome({name, amount}): string // Add new income to income database.
      4. getMoneyBalance(): string // Get remaining money balance from database.
      5. scanReceipt({imageBase64}): string // Scan receipt image and extract expense data.
      6. analyzeSpending(): string // Get AI-powered spending insights.
      7. testModels(): string // Test all AI models and show health status.
      8. processVoiceCommand({command}): string // Process voice commands from user.

      When responding to voice commands, be conversational and natural.
      current datetime: ${new Date().toUTCString()}`,
    },
  ];

  // this is for user prompt loop
  while (true) {
    const question = await rl.question("User (type 'voice' for voice input): ");

    if (question === "bye") {
      break;
    }

    let userInput = question;

    // Handle voice input
    if (question.toLowerCase() === "voice") {
      try {
        console.log("🎤 Voice mode activated! Please speak...");
        console.log(
          "Note: For full voice support, this would need audio recording capability."
        );
        console.log("For now, you can test by typing what you would say:");
        const voiceText = await rl.question("Simulate voice input: ");
        userInput = `[VOICE] ${voiceText}`;

        // Process as voice command
        const voiceResult = await handleVoiceCommand(voiceText);
        console.log(`🗣️ Assistant: ${voiceResult}`);
        continue;
      } catch (error: any) {
        console.log("❌ Voice input failed:", error.message);
        continue;
      }
    }

    messages.push({
      role: "user",
      content: userInput,
    });

    // this is for agent
    while (true) {
      try {
        const completion = await callAIWithBestModel(
          "quick-response",
          messages,
          [
            {
              type: "function",
              function: {
                name: "getTotalExpenses",
                description: "Get total expense from date to date.",
                parameters: {
                  type: "object",
                  properties: {
                    from: {
                      type: "string",
                      description: "From date to get the expense (ISO format).",
                    },
                    to: {
                      type: "string",
                      description: "To date to get the expense (ISO format).",
                    },
                  },
                  required: ["from", "to"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "addExpense",
                description: "Add new expense entry to the expense database.",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description:
                        "Name of the expense. e.g., Bought an iphone",
                    },
                    amount: {
                      type: "number",
                      description: "Amount of the expense as a number.",
                    },
                    category: {
                      type: "string",
                      description:
                        "Category of expense: food|transport|entertainment|shopping|bills|healthcare|utilities",
                    },
                  },
                  required: ["name", "amount"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "addIncome",
                description: "Add new income entry to income database",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the income. e.g., Got salary",
                    },
                    amount: {
                      type: "number",
                      description: "Amount of the income as a number.",
                    },
                  },
                  required: ["name", "amount"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "getMoneyBalance",
                description: "Get remaining money balance from database.",
                parameters: {
                  type: "object",
                  properties: {},
                  required: [],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "analyzeSpending",
                description:
                  "Get AI-powered insights about spending patterns and behavior.",
                parameters: {
                  type: "object",
                  properties: {},
                  required: [],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "testModels",
                description: "Test all AI models and show their health status.",
                parameters: {
                  type: "object",
                  properties: {},
                  required: [],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "processVoiceCommand",
                description: "Process voice commands from the user.",
                parameters: {
                  type: "object",
                  properties: {
                    command: {
                      type: "string",
                      description: "The voice command transcript to process.",
                    },
                  },
                  required: ["command"],
                },
              },
            },
          ]
        );

        messages.push(completion.choices[0].message);

        const toolCalls = completion.choices[0].message.tool_calls;
        if (!toolCalls) {
          console.log(`Assistant: ${completion.choices[0].message.content}`);
          break;
        }

        for (const tool of toolCalls) {
          const functionName = tool.function.name;
          const functionArgs = tool.function.arguments;

          let result = "";
          if (functionName === "getTotalExpenses") {
            result = getTotalExpenses(JSON.parse(functionArgs));
          } else if (functionName === "addExpense") {
            result = addExpense(JSON.parse(functionArgs));
          } else if (functionName === "addIncome") {
            result = addIncome(JSON.parse(functionArgs));
          } else if (functionName === "getMoneyBalance") {
            result = getMoneyBalance();
          } else if (functionName === "analyzeSpending") {
            result = await analyzeSpendingWithAI();
          } else if (functionName === "testModels") {
            const testResults = await testAllModels();
            result = `Model test completed. ${
              testResults.filter((r) => r.status.includes("✅")).length
            }/${testResults.length} models working.`;
          } else if (functionName === "processVoiceCommand") {
            const args = JSON.parse(functionArgs);
            result = await handleVoiceCommand(args.command);
          }

          messages.push({
            role: "tool",
            content: result,
            tool_call_id: tool.id,
          });
        }
      } catch (error: any) {
        console.error("Error occurred:", error);

        // If it's a tool use error, try to handle it gracefully
        if (
          error.message &&
          (error.message.includes("tool_use_failed") ||
            error.message.includes("unauthorized"))
        ) {
          console.log(
            "Assistant: I'm having trouble with the AI service. Let me provide a direct response based on your data:"
          );

          // Provide direct response based on the databases
          const totalIncome = incomeDB.reduce(
            (acc, item) => acc + item.amount,
            0
          );
          const totalExpense = expenseDB.reduce(
            (acc, item) => acc + item.amount,
            0
          );
          const balance = totalIncome - totalExpense;

          console.log(
            `Assistant: Your current balance is ${balance} INR (Income: ${totalIncome} INR, Expenses: ${totalExpense} INR)`
          );
          break;
        } else {
          throw error; // Re-throw if it's a different error
        }
      }
    }
  }

  rl.close();
}

// AI-powered spending analysis
async function analyzeSpendingWithAI(): Promise<string> {
  if (expenseDB.length === 0) {
    return "No spending data available for analysis.";
  }

  console.log("🔍 Starting AI spending analysis...");

  const spendingData = {
    totalExpenses: expenseDB.reduce((sum, e) => sum + e.amount, 0),
    expenseCount: expenseDB.length,
    categories: expenseDB.reduce((acc: any, e) => {
      acc[e.category || "other"] = (acc[e.category || "other"] || 0) + e.amount;
      return acc;
    }, {}),
    recentExpenses: expenseDB.slice(-5),
  };

  const analysisPrompt = `Analyze this spending data and provide insights:
  ${JSON.stringify(spendingData, null, 2)}
  
  Provide insights about:
  1. Spending patterns
  2. Top spending categories
  3. Unusual expenses
  4. Recommendations for saving
  5. Budget warnings if any
  
  Keep it concise and actionable.`;

  try {
    console.log("📊 Analyzing spending patterns with AI...");
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
callAgent();

/**
 * Get total expenses for a given period
 */
function getTotalExpenses({ from, to }: { from: string; to: string }): string {
  console.log("calling getTotalExpenses with", { from, to });

  // In reality -> we would filter by date range here...
  const expense = expenseDB.reduce((acc, item) => {
    return acc + item.amount;
  }, 0);
  return `${expense} INR`;
}

/**
 * Add new expense to database with smart categorization
 */
function addExpense({
  name,
  amount,
  category = "other",
}: {
  name: string;
  amount: number;
  category?: string;
}): string {
  const expense = {
    name,
    amount,
    category: category || categorizeExpenseAuto(name),
    date: new Date(),
  };

  console.log(
    `Adding ₹${amount} to expense db for ${name} (${expense.category})`
  );
  expenseDB.push(expense);

  // Run anomaly detection
  const alerts = detectAnomalies(expense);
  let response = "Added expense to the database.";

  if (alerts.length > 0) {
    response += "\n🚨 Alerts: " + alerts.join(", ");
  }

  return response;
}

/**
 * Auto-categorize expenses based on keywords
 */
function categorizeExpenseAuto(description: string): string {
  const desc = description.toLowerCase();

  if (
    desc.includes("food") ||
    desc.includes("restaurant") ||
    desc.includes("coffee") ||
    desc.includes("lunch") ||
    desc.includes("dinner")
  ) {
    return "food";
  }
  if (
    desc.includes("uber") ||
    desc.includes("taxi") ||
    desc.includes("bus") ||
    desc.includes("train") ||
    desc.includes("petrol") ||
    desc.includes("fuel")
  ) {
    return "transport";
  }
  if (
    desc.includes("movie") ||
    desc.includes("game") ||
    desc.includes("entertainment") ||
    desc.includes("netflix")
  ) {
    return "entertainment";
  }
  if (
    desc.includes("shopping") ||
    desc.includes("clothes") ||
    desc.includes("amazon") ||
    desc.includes("flipkart")
  ) {
    return "shopping";
  }
  if (
    desc.includes("electricity") ||
    desc.includes("water") ||
    desc.includes("internet") ||
    desc.includes("phone") ||
    desc.includes("rent")
  ) {
    return "bills";
  }
  if (
    desc.includes("doctor") ||
    desc.includes("medicine") ||
    desc.includes("hospital") ||
    desc.includes("pharmacy")
  ) {
    return "healthcare";
  }

  return "other";
}

/**
 * Add new income to database
 */
function addIncome({ name, amount }: { name: string; amount: number }): string {
  console.log(`Adding ${amount} INR to income db for ${name}`);
  incomeDB.push({ name, amount });
  return "Added income to the database.";
}

/**
 * Get current money balance
 */
function getMoneyBalance(): string {
  const totalIncome = incomeDB.reduce((acc, item) => acc + item.amount, 0);
  const totalExpense = expenseDB.reduce((acc, item) => acc + item.amount, 0);
  const balance = totalIncome - totalExpense;

  console.log(
    `Total Income: ${totalIncome} INR, Total Expense: ${totalExpense} INR`
  );
  return `Your current balance is ${balance} INR`;
}
