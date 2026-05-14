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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function generateId(prefix: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ── POST /api/designs — 保存设计 ──

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const body = await request.json();

    const {
      grid_cols, grid_rows, color_system, bead_size,
      total_beads, color_count, grid_data, color_counts,
    } = body;

    if (!grid_data || !grid_cols || !grid_rows) {
      return Response.json(
        { error: 'Missing required fields: grid_data, grid_cols, grid_rows' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const designId = generateId('LDB');
    const insert = env.DB.prepare(`
      INSERT INTO designs (id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, grid_data, color_counts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      designId,
      grid_cols, grid_rows,
      color_system || 'MARD',
      bead_size || 'standard',
      total_beads || 0,
      color_count || 0,
      JSON.stringify(grid_data),
      JSON.stringify(color_counts || {})
    );
    await insert.run();

    return Response.json({
      success: true,
      design: {
        id: designId,
        grid_cols, grid_rows, color_system, bead_size,
        total_beads, color_count,
        created_at: new Date().toISOString(),
      }
    }, { status: 201, headers: corsHeaders() });

  } catch (error) {
    console.error('Create design error:', error);
    return Response.json(
      { error: 'Failed to create design', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
};

// ── GET /api/designs — 列出设计 ──

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const result = await env.DB.prepare(`
      SELECT id, grid_cols, grid_rows, color_system, bead_size, total_beads, color_count, created_at, updated_at
      FROM designs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return Response.json({
      success: true,
      designs: result.results || [],
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('List designs error:', error);
    return Response.json(
      { error: 'Failed to list designs', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};
