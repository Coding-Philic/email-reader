-- =============================================================================
-- Email Reader AI - Initial Database Schema
-- =============================================================================
-- Run this migration against your Supabase PostgreSQL database.
-- All tables use Row-Level Security (RLS) for multi-tenant isolation.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. Users Table (extends Supabase auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    gmail_connected BOOLEAN DEFAULT FALSE,
    gmail_watch_expiry TIMESTAMPTZ,
    gmail_history_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================================================
-- 2. User Tokens (Encrypted Gmail OAuth Tokens)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expiry TIMESTAMPTZ,
    scopes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_tokens_user_id ON public.user_tokens(user_id);

ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tokens_select_own" ON public.user_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_tokens_insert_own" ON public.user_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_tokens_update_own" ON public.user_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_tokens_delete_own" ON public.user_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. User Preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    auto_reply_enabled BOOLEAN DEFAULT FALSE,
    telegram_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    notification_frequency TEXT DEFAULT 'instant' CHECK (notification_frequency IN ('instant', 'hourly', 'daily')),
    default_action TEXT DEFAULT 'notify' CHECK (default_action IN ('reply', 'ignore', 'notify', 'categorize')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 4. Email Categories (Dynamic, Auto-Discovered)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#7c3aed',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, slug)
);

CREATE INDEX idx_email_categories_user_id ON public.email_categories(user_id);

ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_categories_select_own" ON public.email_categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "email_categories_insert_own" ON public.email_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_categories_update_own" ON public.email_categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "email_categories_delete_own" ON public.email_categories
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 5. Category Rules (Per-Category Action Settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.category_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.email_categories(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT 'notify' CHECK (action IN ('reply', 'ignore', 'notify', 'categorize')),
    auto_reply_template TEXT,
    notify_telegram BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

CREATE INDEX idx_category_rules_user_id ON public.category_rules(user_id);
CREATE INDEX idx_category_rules_category_id ON public.category_rules(category_id);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_rules_select_own" ON public.category_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "category_rules_insert_own" ON public.category_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "category_rules_update_own" ON public.category_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "category_rules_delete_own" ON public.category_rules
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 6. Email Records (Processed Email Metadata)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    thread_id TEXT,
    category_id UUID REFERENCES public.email_categories(id) ON DELETE SET NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT,
    snippet TEXT,
    action_taken TEXT CHECK (action_taken IN ('replied', 'ignored', 'notified', 'categorized', 'pending')),
    ai_confidence DECIMAL(3,2),
    is_read BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);

CREATE INDEX idx_email_records_user_id ON public.email_records(user_id);
CREATE INDEX idx_email_records_category_id ON public.email_records(category_id);
CREATE INDEX idx_email_records_received_at ON public.email_records(user_id, received_at DESC);
CREATE INDEX idx_email_records_action ON public.email_records(user_id, action_taken);

ALTER TABLE public.email_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_records_select_own" ON public.email_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "email_records_insert_own" ON public.email_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_records_update_own" ON public.email_records
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 7. Telegram Connections
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.telegram_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,
    verification_code TEXT,
    verification_expires_at TIMESTAMPTZ,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(telegram_chat_id)
);

CREATE INDEX idx_telegram_connections_user_id ON public.telegram_connections(user_id);
CREATE INDEX idx_telegram_connections_chat_id ON public.telegram_connections(telegram_chat_id);

ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_connections_select_own" ON public.telegram_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "telegram_connections_insert_own" ON public.telegram_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "telegram_connections_update_own" ON public.telegram_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "telegram_connections_delete_own" ON public.telegram_connections
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 8. Daily Digests (Pre-computed Analytics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    digest_date DATE NOT NULL,
    total_emails INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_ignored INTEGER DEFAULT 0,
    total_notified INTEGER DEFAULT 0,
    total_categorized INTEGER DEFAULT 0,
    category_breakdown JSONB DEFAULT '{}',
    top_senders JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, digest_date)
);

CREATE INDEX idx_daily_digests_user_date ON public.daily_digests(user_id, digest_date DESC);

ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_digests_select_own" ON public.daily_digests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_digests_insert_own" ON public.daily_digests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_digests_update_own" ON public.daily_digests
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 9. Agent Actions (Audit Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agent_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email_record_id UUID REFERENCES public.email_records(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('classify', 'reply', 'ignore', 'notify', 'categorize', 'create_category')),
    details JSONB DEFAULT '{}',
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_actions_user_id ON public.agent_actions(user_id);
CREATE INDEX idx_agent_actions_executed_at ON public.agent_actions(user_id, executed_at DESC);
CREATE INDEX idx_agent_actions_type ON public.agent_actions(user_id, action_type);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_actions_select_own" ON public.agent_actions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "agent_actions_insert_own" ON public.agent_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Trigger: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_user_tokens_updated_at BEFORE UPDATE ON public.user_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_email_categories_updated_at BEFORE UPDATE ON public.email_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_category_rules_updated_at BEFORE UPDATE ON public.category_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_telegram_connections_updated_at BEFORE UPDATE ON public.telegram_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_daily_digests_updated_at BEFORE UPDATE ON public.daily_digests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Function: Auto-create user profile on signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
