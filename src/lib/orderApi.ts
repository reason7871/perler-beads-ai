// ── 订单管理客户端 SDK ──
// 纯前端调用 Cloudflare Pages Functions 的工具函数

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '')
  : '';

// ── 类型定义 ──

export interface CreateOrderPayload {
  // 设计数据（如果不需要创建设计，传 design_id 即可）
  design_id?: string;
  grid_data?: unknown;
  grid_cols?: number;
  grid_rows?: number;
  color_system?: string;
  bead_size?: string;
  total_beads?: number;
  color_count?: number;
  color_counts?: Record<string, unknown>;

  // 配料数据
  kit_id?: string;
  kit_items?: unknown;
  kit_accessories?: unknown;
  kit_total_weight?: number;
  kit_redundancy_ratio?: number;

  // 客户信息
  customer_name?: string;
  customer_email?: string;
  customer_notes?: string;

  // 订单信息
  total_price?: number;
  quantity?: number;
}

export interface UpdateOrderPayload {
  status?: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'completed' | 'cancelled';
  customer_name?: string;
  customer_email?: string;
  customer_notes?: string;
  tracking_number?: string;
  carrier?: string;
  shipping_address?: Record<string, string>;
  total_price?: number;
}

export interface SaveDesignPayload {
  grid_cols: number;
  grid_rows: number;
  color_system?: string;
  bead_size?: string;
  total_beads?: number;
  color_count?: number;
  grid_data: unknown;
  color_counts?: Record<string, unknown>;
}

interface ApiResponse<T> {
  success: boolean;
  order?: T;
  design?: T;
  orders?: T[];
  designs?: T[];
  message?: string;
  error?: string;
}

// ── 订单 API ──

export async function createOrder(payload: CreateOrderPayload): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create order');
  }
  return data;
}

export async function getOrder(orderId: string): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/orders/${orderId}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to get order');
  }
  return data;
}

export async function updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order');
  }
  return data;
}

export async function cancelOrder(orderId: string): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel order');
  }
  return data;
}

export async function listOrders(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<unknown>> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const res = await fetch(`${API_BASE}/api/orders?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to list orders');
  }
  return data;
}

// ── 设计 API ──

export async function saveDesign(payload: SaveDesignPayload): Promise<ApiResponse<unknown>> {
  const res = await fetch(`${API_BASE}/api/designs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save design');
  }
  return data;
}

export async function listDesigns(options?: {
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<unknown>> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const res = await fetch(`${API_BASE}/api/designs?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to list designs');
  }
  return data;
}
