-- PostgreSQL Database Schema for AI Finance Assistant
-- This schema supports user authentication, expense tracking, AI interactions, and analytics

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE - JWT Authentication & User Management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'INR',
    monthly_budget DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 2. EXPENSE CATEGORIES - Predefined + Custom Categories
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color for UI
    icon VARCHAR(50) DEFAULT 'other', -- Icon name for frontend
    is_default BOOLEAN DEFAULT FALSE, -- System defaults vs user custom
    budget_limit DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INCOME SOURCES - Track different income streams
CREATE TABLE income_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) DEFAULT 'salary', -- salary, freelance, business, investment, other
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_day INTEGER, -- Day of month for recurring income
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. EXPENSES - Main expense tracking
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES expense_categories(id),
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    receipt_url TEXT, -- S3/CloudFlare R2 URL for receipt images
    receipt_data JSONB, -- OCR extracted data
    location VARCHAR(255),
    merchant VARCHAR(255),
    payment_method VARCHAR(50), -- cash, card, upi, wallet
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20), -- daily, weekly, monthly, yearly
    tags TEXT[], -- Array of tags for better categorization
    ai_confidence DECIMAL(3,2), -- Confidence score from AI categorization
    is_anomaly BOOLEAN DEFAULT FALSE, -- Flagged by anomaly detection
    expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. INCOME - Income tracking
CREATE TABLE income (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID REFERENCES income_sources(id),
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    income_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AI INTERACTIONS - Track all AI model usage and responses
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- chat, voice, receipt_ocr, analysis, prediction
    model_used VARCHAR(100) NOT NULL, -- gpt-4o, deepseek-v3, whisper-1, etc.
    input_data JSONB, -- User input (text, audio metadata, image metadata)
    output_data JSONB, -- AI response
    tokens_used INTEGER,
    response_time_ms INTEGER,
    cost_usd DECIMAL(8,4), -- Track API costs
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. VOICE COMMANDS - Store voice interaction history
CREATE TABLE voice_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    intent VARCHAR(100), -- add_expense, check_balance, analyze_spending, chat
    confidence DECIMAL(3,2),
    parameters JSONB, -- Extracted parameters (amount, category, etc.)
    response TEXT,
    audio_url TEXT, -- Original audio file URL
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. BUDGETS - Monthly/Custom period budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES expense_categories(id),
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly', -- weekly, monthly, yearly, custom
    start_date DATE NOT NULL,
    end_date DATE,
    alert_threshold DECIMAL(3,2) DEFAULT 0.80, -- Alert at 80% of budget
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. FINANCIAL GOALS - Savings and financial targets
CREATE TABLE financial_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    target_date DATE,
    goal_type VARCHAR(50) DEFAULT 'savings', -- savings, debt_payoff, investment
    priority INTEGER DEFAULT 1, -- 1 = high, 2 = medium, 3 = low
    is_achieved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. NOTIFICATIONS - System notifications and alerts
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, warning, alert, success
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- Deep link for mobile/web app
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. USER SESSIONS - JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- Hashed JWT for security
    device_info JSONB, -- Device type, OS, browser, etc.
    ip_address INET,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. ANALYTICS CACHE - Pre-computed analytics for performance
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_type VARCHAR(100) NOT NULL, -- monthly_spending, category_trends, predictions
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL, -- Cached analytics data
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- 13. CHAT HISTORY - Persistent conversation storage
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT,
    apis_used TEXT[] DEFAULT '{}', -- Array of APIs used for this response
    context JSONB DEFAULT '{}', -- Conversation context and metadata
    intent VARCHAR(100), -- expense, income, budget, goal, analytics, chat
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES for better performance
CREATE INDEX idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_income_user_date ON income(user_id, income_date DESC);
CREATE INDEX idx_ai_interactions_user ON ai_interactions(user_id, created_at DESC);
CREATE INDEX idx_voice_commands_user ON voice_commands(user_id, processed_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_analytics_cache_lookup ON analytics_cache(user_id, metric_type, period_start, period_end);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_intent ON chat_messages(intent);
CREATE INDEX idx_chat_messages_user_date ON chat_messages(user_id, created_at DESC);

-- TRIGGERS for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default expense categories
INSERT INTO expense_categories (name, color, icon, is_default) VALUES
('Food & Dining', '#EF4444', 'restaurant', TRUE),
('Transportation', '#3B82F6', 'car', TRUE),
('Shopping', '#8B5CF6', 'shopping-bag', TRUE),
('Entertainment', '#F59E0B', 'film', TRUE),
('Bills & Utilities', '#10B981', 'receipt', TRUE),
('Healthcare', '#EC4899', 'heart', TRUE),
('Education', '#6366F1', 'academic-cap', TRUE),
('Travel', '#14B8A6', 'airplane', TRUE),
('Investment', '#84CC16', 'chart-line', TRUE),
('Other', '#6B7280', 'dots-horizontal', TRUE);
