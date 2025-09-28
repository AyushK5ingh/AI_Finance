# REST API Endpoints for AI Finance Assistant Backend

## Base URL: `/api/v1`

## 1. AUTHENTICATION & USER MANAGEMENT

### Auth Endpoints

```
POST   /auth/register          # Register new user
POST   /auth/login             # User login (JWT)
POST   /auth/refresh           # Refresh JWT token
POST   /auth/logout            # Logout (invalidate token)
POST   /auth/forgot-password   # Send password reset email
POST   /auth/reset-password    # Reset password with token
POST   /auth/verify-email      # Verify email address
POST   /auth/resend-verification # Resend verification email
```

### User Profile

```
GET    /user/profile           # Get current user profile
PUT    /user/profile           # Update user profile
DELETE /user/account           # Delete user account
PUT    /user/password          # Change password
PUT    /user/preferences       # Update user preferences (currency, timezone)
GET    /user/sessions          # Get active sessions
DELETE /user/sessions/:id      # Revoke specific session
```

## 2. EXPENSE MANAGEMENT

### Expenses

```
GET    /expenses               # Get user expenses (paginated, filterable)
POST   /expenses               # Create new expense
GET    /expenses/:id           # Get specific expense
PUT    /expenses/:id           # Update expense
DELETE /expenses/:id           # Delete expense
POST   /expenses/bulk          # Bulk create expenses
PUT    /expenses/bulk          # Bulk update expenses
DELETE /expenses/bulk          # Bulk delete expenses
```

### Expense Categories

```
GET    /expenses/categories    # Get all categories (default + user custom)
POST   /expenses/categories    # Create custom category
PUT    /expenses/categories/:id # Update category
DELETE /expenses/categories/:id # Delete custom category
```

### Receipt OCR

```
POST   /expenses/scan-receipt  # Upload & scan receipt image
GET    /expenses/receipts/:id  # Get receipt details
POST   /expenses/receipts/:id/verify # Verify/correct OCR data
```

## 3. INCOME MANAGEMENT

### Income

```
GET    /income                 # Get user income (paginated, filterable)
POST   /income                 # Create new income entry
GET    /income/:id             # Get specific income
PUT    /income/:id             # Update income
DELETE /income/:id             # Delete income
```

### Income Sources

```
GET    /income/sources         # Get user income sources
POST   /income/sources         # Create new income source
PUT    /income/sources/:id     # Update income source
DELETE /income/sources/:id     # Delete income source
```

## 4. BUDGETS & FINANCIAL GOALS

### Budgets

```
GET    /budgets                # Get user budgets
POST   /budgets                # Create new budget
GET    /budgets/:id            # Get specific budget
PUT    /budgets/:id            # Update budget
DELETE /budgets/:id            # Delete budget
GET    /budgets/:id/status     # Get budget utilization status
```

### Financial Goals

```
GET    /goals                  # Get user financial goals
POST   /goals                  # Create new goal
GET    /goals/:id              # Get specific goal
PUT    /goals/:id              # Update goal
DELETE /goals/:id              # Delete goal
POST   /goals/:id/contribute   # Add contribution to goal
```

## 5. AI & ANALYTICS

### Dashboard & Analytics

```
GET    /analytics/dashboard    # Main dashboard data
GET    /analytics/spending     # Detailed spending analysis
GET    /analytics/trends       # Spending trends over time
GET    /analytics/predictions  # AI-powered predictions
GET    /analytics/insights     # AI-generated insights
GET    /analytics/anomalies    # Detected spending anomalies
GET    /analytics/category-breakdown # Spending by category
GET    /analytics/monthly-summary/:year/:month # Monthly summary
```

### AI Chat Assistant

```
POST   /ai/chat                # Send message to AI assistant
GET    /ai/chat/history        # Get chat history
DELETE /ai/chat/history        # Clear chat history
GET    /ai/chat/:contextId     # Get specific conversation thread
```

### Voice Commands

```
POST   /ai/voice/process       # Process voice command (upload audio)
GET    /ai/voice/history       # Get voice command history
POST   /ai/voice/text-to-speech # Convert text to speech
```

### Model Management

```
GET    /ai/models/health       # Check all AI models health
POST   /ai/models/test         # Test specific model
GET    /ai/interactions        # Get AI interaction history
GET    /ai/usage-stats         # Get AI usage statistics
```

## 6. NOTIFICATIONS

### Notifications

```
GET    /notifications          # Get user notifications
PUT    /notifications/:id/read # Mark notification as read
PUT    /notifications/read-all # Mark all as read
DELETE /notifications/:id      # Delete notification
POST   /notifications/preferences # Update notification settings
```

## 7. IMPORT/EXPORT

### Data Import

```
POST   /import/csv             # Import expenses from CSV
POST   /import/bank-statement  # Import from bank statement
POST   /import/app-data        # Import from other finance apps
GET    /import/templates       # Get CSV templates
```

### Data Export

```
POST   /export/generate        # Generate export file
GET    /export/:id/download    # Download generated export
GET    /export/history         # Get export history
```

## 8. SEARCH & FILTERING

### Search

```
GET    /search                 # Global search across expenses/income
GET    /search/expenses        # Search expenses with filters
GET    /search/income          # Search income with filters
GET    /search/suggestions     # Get search suggestions
```

## 9. ADMIN & MONITORING (Protected)

### System Health

```
GET    /admin/health           # System health check
GET    /admin/metrics          # System metrics
GET    /admin/logs             # Application logs
POST   /admin/models/restart   # Restart AI models
```

### User Management (Admin only)

```
GET    /admin/users            # Get all users
GET    /admin/users/:id        # Get specific user
PUT    /admin/users/:id/status # Update user status
GET    /admin/analytics        # Global analytics
```

## REQUEST/RESPONSE EXAMPLES

### 1. Register User

```typescript
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+91-9876543210",
  "currency": "INR",
  "timezone": "Asia/Kolkata"
}

Response:
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600
  },
  "message": "User registered successfully"
}
```

### 2. Create Expense

```typescript
POST /api/v1/expenses
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "categoryId": "uuid-here",
  "name": "Coffee at Starbucks",
  "amount": 250,
  "description": "Morning coffee",
  "merchant": "Starbucks",
  "paymentMethod": "card",
  "tags": ["coffee", "morning"],
  "expenseDate": "2024-01-15T10:30:00Z"
}

Response:
{
  "success": true,
  "data": {
    "id": "expense-uuid",
    "name": "Coffee at Starbucks",
    "amount": 250,
    "category": {
      "name": "Food & Dining",
      "color": "#EF4444"
    },
    "isAnomaly": false,
    "aiConfidence": 0.95
  }
}
```

### 3. Voice Command

```typescript
POST /api/v1/ai/voice/process
Authorization: Bearer jwt_token_here
Content-Type: multipart/form-data

Form Data:
- audioFile: [binary audio data]
- audioFormat: "wav"

Response:
{
  "success": true,
  "data": {
    "transcript": "I spent 150 on coffee",
    "intent": "add_expense",
    "parameters": {
      "amount": 150,
      "category": "food",
      "description": "coffee"
    },
    "response": "Added ₹150 expense for coffee to your Food & Dining category.",
    "audioUrl": "https://storage.example.com/tts-response.mp3"
  }
}
```

### 4. Dashboard Data

```typescript
GET /api/v1/analytics/dashboard
Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "totalIncome": 50000,
    "totalExpenses": 35000,
    "currentBalance": 15000,
    "monthlySpending": [
      { "month": "2024-01", "income": 50000, "expenses": 35000, "savings": 15000 }
    ],
    "categoryBreakdown": [
      { "categoryName": "Food & Dining", "amount": 12000, "percentage": 34.3 }
    ],
    "budgetStatus": [
      {
        "budgetName": "Monthly Food Budget",
        "budgetAmount": 15000,
        "spent": 12000,
        "remaining": 3000,
        "percentage": 80,
        "status": "warning"
      }
    ],
    "anomalies": [ /* unusual expenses */ ],
    "upcomingBills": [ /* recurring expenses due soon */ ]
  }
}
```

## PAGINATION & FILTERING

### Standard Query Parameters

```
?page=1&limit=20&sortBy=createdAt&sortOrder=desc
&startDate=2024-01-01&endDate=2024-01-31
&categoryId=uuid&search=coffee&minAmount=100&maxAmount=1000
&tags=coffee,morning
```

## AUTHENTICATION

- All endpoints except `/auth/*` require JWT token
- Token should be included in `Authorization: Bearer <token>` header
- Tokens expire in 1 hour, use refresh token to get new access token
- Rate limiting: 100 requests per minute per user

## ERROR RESPONSES

```typescript
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Amount must be greater than 0",
    "Category ID is required"
  ]
}
```

## HTTP Status Codes

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 422: Validation Error
- 429: Rate Limited
- 500: Internal Server Error

## WEBHOOKS (Optional)

```
POST /webhooks/ai-analysis-complete   # AI analysis completed
POST /webhooks/budget-alert          # Budget threshold reached
POST /webhooks/anomaly-detected      # Unusual spending detected
```
