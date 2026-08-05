-- Add custom AI instructions column to user preferences table
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS custom_ai_instructions TEXT DEFAULT '';
