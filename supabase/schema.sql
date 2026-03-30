-- ============================================
-- IoT Access Control System — Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. Table: users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  rfid_tag VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on rfid_tag for fast lookups from ESP32
CREATE INDEX IF NOT EXISTS idx_users_rfid_tag ON public.users (rfid_tag);

-- ============================================
-- 3. Table: access_logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rfid_tag_used VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('GRANTED', 'DENIED', 'ANOMALY'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON public.access_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON public.access_logs (status);
CREATE INDEX IF NOT EXISTS idx_access_logs_rfid_tag ON public.access_logs (rfid_tag_used);

-- ============================================
-- 4. Table: telegram_authorized_users
-- ============================================
CREATE TABLE IF NOT EXISTS public.telegram_authorized_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_authorized_users ENABLE ROW LEVEL SECURITY;

-- Policy: Service Role has full access (used by backend API routes)
CREATE POLICY "Service role full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on access_logs" ON public.access_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on telegram_authorized_users" ON public.telegram_authorized_users FOR ALL USING (true) WITH CHECK (true);

-- Policy: Temporarily allow Anon (public) access for Dashboard UI without Auth
CREATE POLICY "Anon read users" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert users" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update users" ON public.users FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon delete users" ON public.users FOR DELETE TO anon USING (true);

CREATE POLICY "Anon read access_logs" ON public.access_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon read telegram_users" ON public.telegram_authorized_users FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert telegram_users" ON public.telegram_authorized_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update telegram_users" ON public.telegram_authorized_users FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon delete telegram_users" ON public.telegram_authorized_users FOR DELETE TO anon USING (true);

-- ============================================
-- 6. Enable Realtime for access_logs
-- ============================================
-- This allows the dashboard to receive live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs;
