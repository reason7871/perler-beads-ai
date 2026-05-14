import { MappedPixel, ColorSystem } from './pixelation';
import { getDisplayColorKey, getColorKeyByHex } from './colorSystemUtils';

// ── 常量 ──

/** 每粒拼豆重量参考（克），不同品牌略有差异 */
export const BEAD_WEIGHTS = {
  standard: 0.052,
  mini: 0.012,
} as const;

/** 默认冗余比例：20% 损耗（熔合损耗 + 操作损耗） */
export const DEFAULT_REDUNDANCY_RATIO = 1.2;

/** 配件建议规则 */
const ACCESSORY_RULES = {
  pegboardPerArea: 200,
  ironingPaperPerColors: 5,
  tweezersPerOrder: 1,
  ironingPaperSheetWeight: 2.5,
} as const;

// ── 类型定义 ──

export type BeadSize = 'standard' | 'mini';

export interface IngredientItem {
  /** 当前色号系统的色号（如 MARD 的 "A12"） */
  colorKey: string;
  /** Hex 颜色值 */
  hexCode: string;
  /** 实际格子数 */
  beadCount: number;
  /** 理论重量（beadCount × 单粒重） */
  beadWeight: number;
  /** 包装重量（含冗余损耗） */
  packWeight: number;
  /** 冗余系数 */
  redundancyRatio: number;
}

export interface Accessory {
  name: string;
  quantity: number;
  note?: string;
}

export interface IngredientBill {
  /** 设计唯一标识 */
  designId: string;
  /** 网格尺寸 */
  gridSize: { cols: number; rows: number };
  /** 总格子数 */
  totalBeads: number;
  /** 总重量（克，含冗余） */
  totalWeight: number;
  /** 颜色种类数 */
  colorCount: number;
  /** 拼豆规格 */
  beadSize: BeadSize;
  /** 色号系统 */
  colorSystem: ColorSystem;
  /** 冗余系数 */
  redundancyRatio: number;
  /** 按颜色明细 */
  items: IngredientItem[];
  /** 建议配件清单 */
  accessories: Accessory[];
}

export interface IngredientOptions {
  /** 颜色统计：{ hexKey: { count, color } } */
  colorCounts: Record<string, { count: number; color: string }>;
  /** 总格子数 */
  totalBeads: number;
  /** 色号系统 */
  colorSystem: ColorSystem;
  /** 拼豆规格 */
  beadSize?: BeadSize;
  /** 冗余系数，默认 1.2 */
  redundancyRatio?: number;
  /** 网格尺寸 */
  gridSize: { cols: number; rows: number };
  /** 可选，设计ID（默认自动生成） */
  designId?: string;
}

// ── 辅助函数 ──

/** 生成设计ID：日期 + 时间戳 */
function generateDesignId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `D${date}${time}`;
}

/** 计算单粒重量 */
function getBeadWeightPerUnit(beadSize: BeadSize): number {
  return BEAD_WEIGHTS[beadSize];
}

/** 生成配件清单 */
function generateAccessories(
  totalBeads: number,
  colorCount: number,
  gridSize: { cols: number; rows: number }
): Accessory[] {
  const accessories: Accessory[] = [];

  const area = gridSize.cols * gridSize.rows;
  const pegboardCount = Math.max(1, Math.ceil(area / ACCESSORY_RULES.pegboardPerArea));
  accessories.push({
    name: ' Pegboard (模板板)',
    quantity: pegboardCount,
    note: `图纸面积约 ${area} 格，建议 ${pegboardCount} 张`,
  });

  const ironingPaperCount = Math.max(1, Math.ceil(colorCount / ACCESSORY_RULES.ironingPaperPerColors));
  accessories.push({
    name: 'Ironing Paper (熨烫纸)',
    quantity: ironingPaperCount,
    note: `每 ${ACCESSORY_RULES.ironingPaperPerColors} 种颜色配 1 张`,
  });

  accessories.push({
    name: 'Tweezers (镊子)',
    quantity: ACCESSORY_RULES.ironingPaperPerColors,
    note: '每订单配 1 把',
  });

  return accessories;
}

// ── 核心函数 ──

/**
 * 根据颜色统计生成配料单 (BOM)
 */
export function generateIngredientBill(options: IngredientOptions): IngredientBill {
  const {
    colorCounts,
    totalBeads,
    colorSystem,
    beadSize = 'standard',
    redundancyRatio = DEFAULT_REDUNDANCY_RATIO,
    gridSize,
    designId,
  } = options;

  const items: IngredientItem[] = [];
  let totalWeight = 0;

  const beadWeightPerUnit = getBeadWeightPerUnit(beadSize);

  // 按色号排序
  const sortedHexKeys = Object.keys(colorCounts).sort((a, b) => {
    const keyA = getColorKeyByHex(a, colorSystem);
    const keyB = getColorKeyByHex(b, colorSystem);
    return keyA.localeCompare(keyB);
  });

  for (const hexKey of sortedHexKeys) {
    const { count, color } = colorCounts[hexKey];
    const colorKey = getDisplayColorKey(color, colorSystem);
    const beadWeight = count * beadWeightPerUnit;
    const packWeight = Math.ceil(beadWeight * redundancyRatio * 100) / 100;

    totalWeight += packWeight;

    items.push({
      colorKey,
      hexCode: color.toUpperCase(),
      beadCount: count,
      beadWeight: Math.round(beadWeight * 100) / 100,
      packWeight,
      redundancyRatio,
    });
  }

  const accessories = generateAccessories(totalBeads, items.length, gridSize);

  return {
    designId: designId || generateDesignId(),
    gridSize,
    totalBeads,
    totalWeight: Math.round(totalWeight * 100) / 100,
    colorCount: items.length,
    beadSize,
    colorSystem,
    redundancyRatio,
    items,
    accessories,
  };
}

/**
 * 从网格数据直接生成配料单（便捷封装）
 */
export function generateBillFromGrid(
  grid: MappedPixel[][],
  colorSystem: ColorSystem,
  gridSize: { cols: number; rows: number },
  options?: {
    beadSize?: BeadSize;
    redundancyRatio?: number;
    designId?: string;
  }
): IngredientBill {
  // 统计非外部单元格的颜色
  const colorCounts: Record<string, { count: number; color: string }> = {};
  let totalBeads = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell && !cell.isExternal) {
        const hexKey = cell.color.toUpperCase();
        if (colorCounts[hexKey]) {
          colorCounts[hexKey].count++;
        } else {
          colorCounts[hexKey] = { count: 1, color: cell.color };
        }
        totalBeads++;
      }
    }
  }

  return generateIngredientBill({
    colorCounts,
    totalBeads,
    colorSystem,
    beadSize: options?.beadSize || 'standard',
    redundancyRatio: options?.redundancyRatio || DEFAULT_REDUNDANCY_RATIO,
    gridSize,
    designId: options?.designId,
  });
}

// ── 导出函数 ──

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出配料单为 JSON
 */
export function exportIngredientJSON(bill: IngredientBill): void {
  const json = JSON.stringify(bill, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `ingredient-bill-${bill.designId}.json`);}

/**
 * 导出配料单为 CSV（包装车间可用）
 */
export function exportIngredientCSV(bill: IngredientBill): void {
  const lines: string[] = [];

  // 头部信息
  lines.push(`Design ID,${bill.designId}`);
  lines.push(`Grid Size,${bill.gridSize.cols}x${bill.gridSize.rows}`);
  lines.push(`Total Beads,${bill.totalBeads}`);
  lines.push(`Total Weight (g),${bill.totalWeight}`);
  lines.push(`Bead Size,${bill.beadSize}`);
  lines.push(`Color System,${bill.colorSystem}`);
  lines.push(`Redundancy Ratio,${bill.redundancyRatio}`);
  lines.push('');

  // 颜色明细
  lines.push('Color Key,Hex Code,Bead Count,Bead Weight (g),Pack Weight (g)');
  for (const item of bill.items) {
    lines.push(
      `${item.colorKey},${item.hexCode},${item.beadCount},${item.beadWeight},${item.packWeight}`
    );
  }
  lines.push('');

  // 配件
  lines.push('Accessory,Quantity,Note');
  for (const acc of bill.accessories) {
    lines.push(`${acc.name},${acc.quantity},${acc.note || ''}`);
  }

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `ingredient-bill-${bill.designId}.csv`);
}

// ── 包装标签生成 ──

/**
 * 为单个颜色袋生成标签文本
 */
export function generatePackagingLabel(item: IngredientItem, designId: string): string {
  const lines = [
    `━━━━ ${designId} ━━━━`,
    `色号: ${item.colorKey}`,
    `颜色: ${item.hexCode}`,
    `用量: ${item.beadCount} 粒`,
    `重量: ${item.packWeight}g (含损耗)`,
    `━━━━━━━━━━━━━━`,
  ];
  return lines.join('\n');
}

/**
 * 生成全部颜色的包装标签（合并为一个文本文件供打印裁剪）
 */
export function exportPackagingLabels(bill: IngredientBill): void {
  const sections: string[] = [];

  for (const item of bill.items) {
    sections.push(generatePackagingLabel(item, bill.designId));
  }

  // 加一个封面
  const cover = [
    `╔══════════════════════╗`,
    `║  ${bill.designId}                    ║`,
    `║  拼豆规格: ${bill.beadSize}               ║`,
    `║  色号系统: ${bill.colorSystem}          ║`,
    `║  颜色数: ${bill.colorCount}                      ║`,
    `║  总用量: ${bill.totalBeads} 粒          ║`,
    `║  总重量: ${bill.totalWeight}g       ║`,
    `╚══════════════════════╝`,
    ``,
  ].join('\n');

  const labelsContent = cover + sections.join('\n\n--- 裁剪线 ---\n\n');
  const blob = new Blob([labelsContent], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `packaging-labels-${bill.designId}.txt`);
}
