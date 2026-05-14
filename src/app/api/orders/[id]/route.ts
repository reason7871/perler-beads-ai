// Next.js API Route - 单个订单管理

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

// ── GET /api/orders/:id — 获取单个订单 ──
// ── PUT /api/orders/:id — 更新订单状态 ──
// ── DELETE /api/orders/:id — 取消订单 ──

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const database = getDb();
    const { id } = await params;

    const order = database.prepare(
      'SELECT o.*, d.grid_cols, d.grid_rows, d.color_system, d.bead_size AS design_bead_size FROM orders o LEFT JOIN designs d ON o.design_id = d.id WHERE o.id = ?'
    ).get(id);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    let kitData = null;
    if (order.kit_id) {
      kitData = database.prepare(
        'SELECT * FROM ingredient_kits WHERE id = ?'
      ).get(order.kit_id);
    }

    return NextResponse.json({
      success: true,
      order: { ...order, kit: kitData },
    });

  } catch (error: any) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to get order', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const database = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = database.prepare(
      'SELECT id, status FROM orders WHERE id = ?'
    ).get(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = existing as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.push('status = ?');
      values.push(body.status);

      if (body.status === 'shipped') {
        updates.push('shipped_at = ?');
        values.push(new Date().toISOString());
      }
      if (body.status === 'completed') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
    }
    if (body.customer_name !== undefined) { updates.push('customer_name = ?'); values.push(body.customer_name); }
    if (body.customer_email !== undefined) { updates.push('customer_email = ?'); values.push(body.customer_email); }
    if (body.customer_notes !== undefined) { updates.push('customer_notes = ?'); values.push(body.customer_notes); }
    if (body.tracking_number !== undefined) { updates.push('tracking_number = ?'); values.push(body.tracking_number); }
    if (body.carrier !== undefined) { updates.push('carrier = ?'); values.push(body.carrier); }
    if (body.shipping_address !== undefined) { updates.push('shipping_address = ?'); values.push(JSON.stringify(body.shipping_address)); }
    if (body.total_price !== undefined) { updates.push('total_price = ?'); values.push(body.total_price); }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    database.prepare(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    return NextResponse.json({
      success: true,
      message: 'Order updated',
    });

  } catch (error: any) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { error: 'Failed to update order', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const database = getDb();
    const { id } = await params;

    const existing = database.prepare(
      'SELECT id, status FROM orders WHERE id = ?'
    ).get(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = existing as Record<string, unknown>;
    if (order.status === 'completed' || order.status === 'shipped') {
      return NextResponse.json(
        { error: 'Cannot delete order that is shipped or completed. Use status=cancelled instead.' },
        { status: 400 }
      );
    }

    database.prepare('DELETE FROM orders WHERE id = ?').run(id);

    return NextResponse.json({
      success: true,
      message: 'Order cancelled and deleted',
    });

  } catch (error: any) {
    console.error('Delete order error:', error);
    return NextResponse.json(
      { error: 'Failed to delete order', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
