-- Migration: 001_init_schema
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                        -- Google sub ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  plan TEXT NOT NULL DEFAULT 'free',          -- free | pro
  monthly_credits INTEGER NOT NULL DEFAULT 10, -- 每月额度
  used_this_month INTEGER NOT NULL DEFAULT 0,  -- 本月已用
  reset_at INTEGER NOT NULL DEFAULT (unixepoch()), -- 下次重置时间戳
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 处理历史表
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,                        -- UUID
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',        -- done | failed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引：按用户查历史
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
