-- ============================================================================
-- 拼豆图纸 AI — 订单管理系统数据库 Schema
-- Cloudflare D1 (SQLite)
-- ============================================================================

-- 设计表：存储用户生成的像素化图纸数据
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,              -- 设计 ID，如 LDB-260514-A3F1
  grid_cols INTEGER NOT NULL,
  grid_rows INTEGER NOT NULL,
  color_system TEXT NOT NULL,       -- 色号系统：MARD/COCO/漫漫/盼盼/咪小窝
  bead_size TEXT NOT NULL DEFAULT 'standard',
  total_beads INTEGER NOT NULL,
  color_count INTEGER NOT NULL,
  grid_data TEXT NOT NULL,          -- JSON: MappedPixel[][] 序列化
  color_counts TEXT NOT NULL,       -- JSON: Record<string, { count, color }>
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at DESC);

-- 配料表：每个设计对应的配料清单
CREATE TABLE IF NOT EXISTS ingredient_kits (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id),
  bead_size TEXT NOT NULL,
  redundancy_ratio REAL NOT NULL DEFAULT 1.2,
  total_weight INTEGER NOT NULL,
  items TEXT NOT NULL,              -- JSON: IngredientItem[]
  accessories TEXT NOT NULL,        -- JSON: Accessory[]
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kits_design ON ingredient_kits(design_id);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,              -- 订单 ID，如 ORD-260514-XXXX
  design_id TEXT NOT NULL REFERENCES designs(id),
  kit_id TEXT REFERENCES ingredient_kits(id),
  status TEXT NOT NULL DEFAULT 'pending',
  -- 状态流转: pending → confirmed → preparing → shipped → completed → cancelled
  customer_name TEXT,
  customer_email TEXT,
  customer_notes TEXT,              -- 买家备注
  total_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity INTEGER NOT NULL DEFAULT 1,
  shipping_address TEXT,            -- JSON: { name, address, city, state, zip, country }
  tracking_number TEXT,
  carrier TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_design ON orders(design_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
