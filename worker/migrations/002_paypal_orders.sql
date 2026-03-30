-- Migration: 002_paypal_orders
-- PayPal 订单记录表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                        -- PayPal order ID / subscription ID
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,                      -- starter / popular / pro-pack / basic / pro
  billing_type TEXT NOT NULL,                 -- one_time | subscription
  amount TEXT NOT NULL,                       -- 金额，如 "12.99"
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | completed | failed
  paypal_subscription_id TEXT,               -- 订阅ID（月订阅时用）
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 给 users 表增加购买积分和订阅字段
ALTER TABLE users ADD COLUMN purchased_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN subscription_plan TEXT;            -- basic | pro | null
ALTER TABLE users ADD COLUMN subscription_expires_at INTEGER;   -- 到期时间戳（unixepoch）
