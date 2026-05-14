interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
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

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── GET /api/orders/:id — 获取单个订单 ──

// ── PUT /api/orders/:id — 更新订单状态 ──

// ── DELETE /api/orders/:id — 取消订单 ──

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, params } = context;
    const orderId = params.id as string;

    const order = await env.DB.prepare(
      'SELECT o.*, d.grid_cols, d.grid_rows, d.color_system, d.bead_size AS design_bead_size FROM orders o LEFT JOIN designs d ON o.design_id = d.id WHERE o.id = ?'
    ).bind(orderId).first();

    if (!order) {
      return Response.json(
        { error: 'Order not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 如果有 kit_id，获取配料数据
    const orderObj = order as Record<string, unknown>;
    let kitData = null;
    if (orderObj.kit_id) {
      kitData = await env.DB.prepare(
        'SELECT * FROM ingredient_kits WHERE id = ?'
      ).bind(orderObj.kit_id as string).first();
    }

    return Response.json({
      success: true,
      order: { ...orderObj, kit: kitData },
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('Get order error:', error);
    return Response.json(
      { error: 'Failed to get order', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { env, params, request } = context;
    const orderId = params.id as string;
    const body = await request.json();

    // 验证订单存在
    const existing = await env.DB.prepare(
      'SELECT id, status FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!existing) {
      return Response.json(
        { error: 'Order not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 构建更新字段
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return Response.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400, headers: corsHeaders() }
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
    values.push(orderId);

    await env.DB.prepare(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return Response.json({
      success: true,
      message: 'Order updated',
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('Update order error:', error);
    return Response.json(
      { error: 'Failed to update order', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { env, params } = context;
    const orderId = params.id as string;

    const existing = await env.DB.prepare(
      'SELECT id, status FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!existing) {
      return Response.json(
        { error: 'Order not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const order = existing as Record<string, unknown>;
    if (order.status === 'completed' || order.status === 'shipped') {
      return Response.json(
        { error: 'Cannot delete order that is shipped or completed. Use status=cancelled instead.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run();

    return Response.json({
      success: true,
      message: 'Order cancelled and deleted',
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('Delete order error:', error);
    return Response.json(
      { error: 'Failed to delete order', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};
