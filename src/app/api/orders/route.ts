// Next.js API Route - 订单管理 API
// 使用 better-sqlite3 (同步)

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// ── 数据库初始化 ──

let db: any = null;

function getDb() {
  if (db) return db;

  // 动态导入 better-sqlite3 (仅在生产环境 Linux 使用)
  const Database = require('better-sqlite3');
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'perler-beads.db');

  // 确保目录存在
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // 初始化表结构
  initSchema(db);

  return db;
}

function initSchema(database: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      grid_cols INTEGER NOT NULL,
      grid_rows INTEGER NOT NULL,
      color_system TEXT NOT NULL,
      bead_size TEXT NOT NULL DEFAULT 'standard',
      total_beads INTEGER NOT NULL,
      color_count INTEGER NOT NULL,
      grid_data TEXT NOT NULL,
      color_counts TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at DESC);

    CREATE TABLE IF NOT EXISTS ingredient_kits (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL REFERENCES designs(id),
      bead_size TEXT NOT NULL,
      redundancy_ratio REAL NOT NULL DEFAULT 1.2,
      total_weight INTEGER NOT NULL,
      items TEXT NOT NULL,
      accessories TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kits_design ON ingredient_kits(design_id);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL REFERENCES designs(id),
      kit_id TEXT REFERENCES ingredient_kits(id),
      status TEXT NOT NULL DEFAULT 'pending',
      customer_name TEXT,
      customer_email TEXT,
      customer_notes TEXT,
      total_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      quantity INTEGER NOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  `;

  database.exec(sql);
}

// ── ID 生成 ──

function generateId(prefix: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ── POST /api/orders — 创建订单 ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const database = getDb();

    const {
      design_id,
      kit_id,
      customer_name,
      customer_email,
      customer_notes,
      total_price,
      quantity,
      grid_data,
      color_counts,
      grid_cols,
      grid_rows,
      color_system,
      bead_size,
      total_beads,
      color_count,
      kit_items,
      kit_accessories,
      kit_total_weight,
      kit_redundancy_ratio,
    } = body;

    if (!design_id && !grid_data) {
      return NextResponse.json(
        { error: 'Missing design_id or grid_data' },
        { status: 400 }
      );
    }

    let finalDesignId = design_id;

    // 如果没有 design_id，先创建设计记录
    if (!finalDesignId) {
      finalDesignId = generateId('LDB');
      const insertDesign = database.prepare(`
        INSERT INTO designs (id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, grid_data, color_counts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertDesign.run(
        finalDesignId,
        grid_cols, grid_rows, color_system, bead_size,
        total_beads, color_count,
        JSON.stringify(grid_data), JSON.stringify(color_counts)
      );
    }

    // 如果有配料数据，创建配料记录
    let finalKitId = kit_id;
    if (!finalKitId && kit_items) {
      finalKitId = generateId('KIT');
      const insertKit = database.prepare(`
        INSERT INTO ingredient_kits (id, design_id, bead_size, redundancy_ratio, total_weight, items, accessories)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertKit.run(
        finalKitId, finalDesignId,
        bead_size || 'standard',
        kit_redundancy_ratio || 1.2,
        kit_total_weight || 0,
        JSON.stringify(kit_items),
        JSON.stringify(kit_accessories || [])
      );
    }

    // 创建订单
    const orderId = generateId('ORD');
    const insertOrder = database.prepare(`
      INSERT INTO orders (id, design_id, kit_id, status, customer_name, customer_email, customer_notes, total_price, quantity)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `);
    insertOrder.run(
      orderId,
      finalDesignId,
      finalKitId || null,
      customer_name || null,
      customer_email || null,
      customer_notes || null,
      total_price || 0,
      quantity || 1
    );

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        design_id: finalDesignId,
        kit_id: finalKitId || null,
        status: 'pending',
        total_price: total_price || 0,
        quantity: quantity || 1,
        created_at: new Date().toISOString(),
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── GET /api/orders — 列出订单 ──

export async function GET(request: NextRequest) {
  try {
    const database = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = 'SELECT o.*, d.grid_cols, d.grid_rows, d.color_system FROM orders o LEFT JOIN designs d ON o.design_id = d.id';
    const params: any[] = [];

    if (status) {
      query += ' WHERE o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = database.prepare(query);
    const results = stmt.all(...params);

    return NextResponse.json({
      success: true,
      orders: results,
    });

  } catch (error: any) {
    console.error('List orders error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list orders',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
