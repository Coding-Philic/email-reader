-- =============================================================================
-- Email Reader AI - Default Categories Seed
-- =============================================================================
-- This seed creates default system categories for new users.
-- Run via the handle_new_user trigger or manually for existing users.

-- Function to seed default categories for a user
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.email_categories (user_id, name, slug, description, color, is_system, sort_order) VALUES
        (p_user_id, 'Job Offers', 'job-offers', 'Job opportunities and recruitment emails', '#22c55e', TRUE, 1),
        (p_user_id, 'Internships', 'internships', 'Internship opportunities and applications', '#3b82f6', TRUE, 2),
        (p_user_id, 'Important', 'important', 'High-priority emails requiring attention', '#ef4444', TRUE, 3),
        (p_user_id, 'Personal', 'personal', 'Personal correspondence from known contacts', '#f59e0b', TRUE, 4),
        (p_user_id, 'Newsletters', 'newsletters', 'Subscribed newsletters and digests', '#8b5cf6', TRUE, 5),
        (p_user_id, 'Marketing', 'marketing', 'Promotional and marketing emails', '#6b7280', TRUE, 6),
        (p_user_id, 'Social', 'social', 'Social media notifications', '#ec4899', TRUE, 7),
        (p_user_id, 'Transactional', 'transactional', 'Receipts, confirmations, and account notifications', '#14b8a6', TRUE, 8),
        (p_user_id, 'Spam', 'spam', 'Unwanted or unsolicited emails', '#64748b', TRUE, 9)
    ON CONFLICT (user_id, slug) DO NOTHING;

    -- Create default rules for each category
    INSERT INTO public.category_rules (user_id, category_id, action, notify_telegram, priority)
    SELECT
        p_user_id,
        ec.id,
        CASE ec.slug
            WHEN 'job-offers' THEN 'notify'
            WHEN 'internships' THEN 'notify'
            WHEN 'important' THEN 'notify'
            WHEN 'personal' THEN 'reply'
            WHEN 'newsletters' THEN 'categorize'
            WHEN 'marketing' THEN 'ignore'
            WHEN 'social' THEN 'categorize'
            WHEN 'transactional' THEN 'categorize'
            WHEN 'spam' THEN 'ignore'
            ELSE 'notify'
        END,
        CASE ec.slug
            WHEN 'job-offers' THEN TRUE
            WHEN 'internships' THEN TRUE
            WHEN 'important' THEN TRUE
            WHEN 'personal' THEN FALSE
            ELSE FALSE
        END,
        ec.sort_order
    FROM public.email_categories ec
    WHERE ec.user_id = p_user_id AND ec.is_system = TRUE
    ON CONFLICT (user_id, category_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the handle_new_user function to also seed categories
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

    PERFORM public.seed_default_categories(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
