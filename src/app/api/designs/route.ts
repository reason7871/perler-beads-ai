// Next.js API Route - 设计管理

import { NextRequest, NextResponse } from 'next/server';

let db: any = null;

function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'perler-beads.db');
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

function generateId(prefix: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ── POST /api/designs — 保存设计 ──

export async function POST(request: NextRequest) {
  try {
    const database = getDb();
    const body = await request.json();

    const {
      grid_cols, grid_rows, color_system, bead_size,
      total_beads, color_count, grid_data, color_counts,
    } = body;

    if (!grid_data || !grid_cols || !grid_rows) {
      return NextResponse.json(
        { error: 'Missing required fields: grid_data, grid_cols, grid_rows' },
        { status: 400 }
      );
    }

    const designId = generateId('LDB');
    const insert = database.prepare(`
      INSERT INTO designs (id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, grid_data, color_counts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      designId,
      grid_cols, grid_rows,
      color_system || 'MARD',
      bead_size || 'standard',
      total_beads || 0,
      color_count || 0,
      JSON.stringify(grid_data),
      JSON.stringify(color_counts || {})
    );

    return NextResponse.json({
      success: true,
      design: {
        id: designId,
        grid_cols, grid_rows, color_system, bead_size,
        total_beads, color_count,
        created_at: new Date().toISOString(),
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create design error:', error);
    return NextResponse.json(
      { error: 'Failed to create design', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// ── GET /api/designs — 列出设计 ──

export async function GET(request: NextRequest) {
  try {
    const database = getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const results = database.prepare(`
      SELECT id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, created_at, updated_at
      FROM designs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return NextResponse.json({
      success: true,
      designs: results,
    });

  } catch (error: any) {
    console.error('List designs error:', error);
    return NextResponse.json(
      { error: 'Failed to list designs', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
