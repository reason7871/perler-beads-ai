import React, { useState, useCallback } from 'react';
import { IngredientBill } from '../utils/ingredientEngine';
import {
  createOrder,
  saveDesign,
  listOrders,
  cancelOrder,
} from '../lib/orderApi';

interface OrderManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: IngredientBill | null;
  gridData: unknown;
  colorCounts: Record<string, { count: number; color: string }> | null;
}

interface OrderRecord {
  id: string;
  design_id: string;
  status: string;
  total_price: number;
  quantity: number;
  customer_name?: string;
  customer_email?: string;
  created_at: string;
}

type Tab = 'create' | 'list';

const OrderManagementModal: React.FC<OrderManagementModalProps> = ({
  isOpen,
  onClose,
  bill,
  gridData,
  colorCounts,
}) => {
  const [tab, setTab] = useState<Tab>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(0);

  // Order list
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isListing, setIsListing] = useState(false);

  const handleCreateOrder = useCallback(async () => {
    if (!bill || !colorCounts || !gridData) return;
    setIsSubmitting(true);
    setError(null);
    setSubmitResult(null);

    try {
      // Step 1: save design
      const designRes = await saveDesign({
        grid_cols: bill.gridSize.cols,
        grid_rows: bill.gridSize.rows,
        color_system: bill.colorSystem,
        bead_size: bill.beadSize,
        total_beads: bill.totalBeads,
        color_count: bill.colorCount,
        grid_data: gridData,
        color_counts: colorCounts,
      });
      const designId = (designRes.design as Record<string, unknown>)?.id as string;

      // Step 2: create order with kit
      const orderRes = await createOrder({
        design_id: designId,
        kit_items: bill.items,
        kit_accessories: bill.accessories,
        kit_total_weight: bill.totalWeight,
        kit_redundancy_ratio: bill.redundancyRatio,
        customer_name: customerName || undefined,
        customer_email: customerEmail || undefined,
        customer_notes: customerNotes || undefined,
        total_price: totalPrice,
        quantity,
      });

      const orderId = (orderRes.order as Record<string, unknown>)?.id as string;
      setSubmitResult(`Order ${orderId} created successfully!`);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerNotes('');
      setQuantity(1);
      setTotalPrice(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }, [bill, colorCounts, gridData, customerName, customerEmail, customerNotes, quantity, totalPrice]);

  const handleListOrders = useCallback(async () => {
    setIsListing(true);
    try {
      const res = await listOrders({ limit: 20, offset: 0 });
      setOrders((res.orders as OrderRecord[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list orders');
    } finally {
      setIsListing(false);
    }
  }, []);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await cancelOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }, []);

  const handleTabSwitch = (newTab: Tab) => {
    setTab(newTab);
    setError(null);
    setSubmitResult(null);
    if (newTab === 'list') {
      handleListOrders();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">订单管理</h3>
            <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => handleTabSwitch('create')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'create'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                新建订单
              </button>
              <button
                onClick={() => handleTabSwitch('list')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'list'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                订单列表
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-shrink-0">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {submitResult && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
              {submitResult}
            </div>
          )}

          {tab === 'create' && bill && (
            <>
              {/* 配料摘要 */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">配料清单摘要</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">设计编号</span>
                    <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">{bill.designId}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">总用量</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.totalBeads.toLocaleString()} 粒</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">总重量</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.totalWeight}g</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">颜色数</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.colorCount} 种</p>
                  </div>
                </div>
              </div>

              {/* 客户信息 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">客户姓名</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="选填"
                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">客户邮箱</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="选填"
                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">备注</label>
                  <textarea
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    placeholder="选填"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* 数量和价格 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">数量</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">总价 (USD)</label>
                  <input
                    type="number"
                    value={totalPrice}
                    onChange={e => setTotalPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={!bill || isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isSubmitting ? '提交中...' : '创建订单'}
              </button>
            </>
          )}

          {tab === 'list' && (
            <>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  {isListing ? '加载中...' : '暂无订单'}
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map(order => (
                    <div key={order.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{order.id}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(order.created_at).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          order.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>×{order.quantity} · ${order.total_price}</span>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                          >
                            取消
                          </button>
                        )}
                      </div>
                      {order.customer_name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{order.customer_name}{order.customer_email ? ` · ${order.customer_email}` : ''}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderManagementModal;
