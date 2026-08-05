# Email Reader AI -- Progress Memory

This file tracks all completed and remaining work for the Email Reader AI project. Use this file to resume work if switching models or context is lost.

## Project Overview
- **Name**: Email Reader AI
- **Purpose**: Multi-tenant email automation platform with AI classification, auto-reply, Telegram notifications
- **Tech Stack**: Next.js (frontend), NestJS (backend), Supabase (auth + PostgreSQL), Redis + BullMQ (queues), LangGraph + Groq (AI agent, free tier, llama-3.3-70b-versatile), grammY (Telegram bot)
- **Cost**: Entire project uses free tiers only (Groq free, Supabase free, local Redis)
- **Design**: Dark theme, black (#0a0a0f) + purple (#7c3aed), solid colors, Inter font, no gradients/transparency/emojis
- **Workspace**: /Users/air/Documents/coding/email reader

---

## Phase Status

### Phase 1: Foundation (Backend + Auth + Database)
- [ ] Initialize NestJS project with TypeScript strict mode
- [ ] Set up database schema (PostgreSQL via Supabase) -- 9 tables with RLS
- [ ] Implement Supabase JWT auth guard
- [ ] Token encryption service (AES-256-GCM for Gmail tokens)
- [ ] Set up Redis connection + BullMQ queue infrastructure (3 queues)
- [ ] Config module with env validation (class-validator)
- [ ] docker-compose.yml for Redis
- [ ] .env.example with all required variables

### Phase 2: Gmail Integration
- [ ] Gmail OAuth token management (store/refresh/encrypt)
- [ ] Gmail webhook controller (receives Pub/Sub push notifications)
- [ ] Gmail watch service (register watches + 6-day CRON renewal)
- [ ] Gmail service (read emails, send replies via API)
- [ ] History sync (users.history.list for incremental sync)

### Phase 3: AI Agent (LangGraph)
- [ ] State graph definition (email-classifier.graph.ts)
- [ ] Classify node -- LLM-based email classification
- [ ] Draft reply node -- context-aware reply generation
- [ ] Notify node -- Telegram notification trigger
- [ ] Categorize node -- dynamic category creation/update
- [ ] User preference integration in classification
- [ ] Tools: gmail-read, gmail-reply, telegram-notify

### Phase 4: Telegram Bot
- [ ] grammY bot setup with NestJS integration
- [ ] /start command handler
- [ ] Verification code flow (link Telegram to user account)
- [ ] Notification message formatting
- [ ] Connection/disconnection management

### Phase 5: Frontend (Next.js)
- [ ] Initialize Next.js project with App Router
- [ ] Design system in globals.css (CSS custom properties)
- [ ] Supabase client configuration
- [ ] Landing page (hero, features, CTA)
- [ ] Login page (Google OAuth via Supabase)
- [ ] Auth callback handler
- [ ] Dashboard layout (sidebar + main content)
- [ ] Dashboard page (stats cards, category chart, activity feed)
- [ ] Categories page (list, per-category rules, auto-discovery)
- [ ] Settings page (Telegram toggle, auto-reply config, quiet hours)
- [ ] Analytics page (volume chart, distribution, top senders)
- [ ] SSE client for real-time updates
- [ ] API client module for backend communication

### Phase 6: Polish + Security
- [ ] Rate limiting (NestJS throttler)
- [ ] CORS whitelist configuration
- [ ] Helmet security headers
- [ ] Input validation DTOs on all endpoints
- [ ] Global exception filter
- [ ] Request logging interceptor
- [ ] Unit tests for critical services
- [ ] E2E tests for auth and email flow

---

## Key Architecture Decisions
1. **Gmail Push via Pub/Sub**: Gmail does not support direct webhooks. We use Google Cloud Pub/Sub as intermediary.
2. **BullMQ over direct processing**: Decouples email arrival from processing. Enables rate limiting, retries, and horizontal scaling.
3. **RLS over application-level filtering**: Database-level security ensures no cross-tenant data leaks even if app code has bugs.
4. **Draft-first replies**: AI drafts replies but does not auto-send by default. Users can opt-in to auto-send per category.
5. **Dynamic categories**: AI discovers new email types automatically and creates categories without user intervention.
6. **Token encryption at rest**: Gmail refresh tokens are AES-256-GCM encrypted in the database.

---

## External Dependencies Required
- Google Cloud Project (Gmail API + Pub/Sub API enabled)
- Supabase project (Auth + PostgreSQL)
- LLM API key (OpenAI/Anthropic/Google)
- Telegram Bot Token (from @BotFather)
- Redis instance (local via Docker or managed)

---

## Last Updated
- Date: Not started yet
- Current Phase: Awaiting user approval of implementation plan
- Notes: Implementation plan created and awaiting review
