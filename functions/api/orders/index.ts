interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first(colName?: string): Promise<unknown>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: Record<string, unknown>;
}

// ── CORS ──

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── ID 生成 ──

function generateId(prefix: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ── POST /api/orders — 创建订单 ──

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const body = await request.json();

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
      return Response.json(
        { error: 'Missing design_id or grid_data' },
        { status: 400, headers: corsHeaders() }
      );
    }

    let finalDesignId = design_id;

    // 如果没有 design_id，先创建设计记录
    if (!finalDesignId) {
      finalDesignId = generateId('LDB');
      const insertDesign = env.DB.prepare(`
        INSERT INTO designs (id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, grid_data, color_counts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        finalDesignId,
        grid_cols, grid_rows, color_system, bead_size,
        total_beads, color_count,
        JSON.stringify(grid_data), JSON.stringify(color_counts)
      );
      await insertDesign.run();
    }

    // 如果有配料数据，创建配料记录
    let finalKitId = kit_id;
    if (!finalKitId && kit_items) {
      finalKitId = generateId('KIT');
      const insertKit = env.DB.prepare(`
        INSERT INTO ingredient_kits (id, design_id, bead_size, redundancy_ratio, total_weight, items, accessories)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        finalKitId, finalDesignId,
        bead_size || 'standard',
        kit_redundancy_ratio || 1.2,
        kit_total_weight || 0,
        JSON.stringify(kit_items),
        JSON.stringify(kit_accessories || [])
      );
      await insertKit.run();
    }

    // 创建订单
    const orderId = generateId('ORD');
    const insertOrder = env.DB.prepare(`
      INSERT INTO orders (id, design_id, kit_id, status, customer_name, customer_email, customer_notes, total_price, quantity)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      finalDesignId,
      finalKitId || null,
      customer_name || null,
      customer_email || null,
      customer_notes || null,
      total_price || 0,
      quantity || 1
    );
    await insertOrder.run();

    return Response.json({
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
    }, { status: 201, headers: corsHeaders() });

  } catch (error) {
    console.error('Create order error:', error);
    return Response.json(
      {
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders() }
    );
  }
};

// ── GET /api/orders — 列出订单 ──

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = 'SELECT o.*, d.grid_cols, d.grid_rows, d.color_system FROM orders o LEFT JOIN designs d ON o.design_id = d.id';
    const args: unknown[] = [];

    if (status) {
      query += ' WHERE o.status = ?';
      args.push(status);
    }

    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...args).all();

    return Response.json({
      success: true,
      orders: result.results || [],
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('List orders error:', error);
    return Response.json(
      {
        error: 'Failed to list orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders() }
    );
  }
};

// OPTIONS for CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};
