import { jsPDF } from 'jspdf';
import { IngredientBill } from './ingredientEngine';

// ── 常量 ──

const A4_W = 210;
const A4_H = 297;
const M = 10; // minimal margin for print template

// ── 类型 ──

export interface BrandStyle {
  /** 品牌名称 */
  name: string;
  /** 标语 */
  tagline: string;
  /** 品牌色（主色） */
  primaryColor: [number, number, number];
  /** 品牌色（强调色） */
  accentColor: [number, number, number];
}

const DEFAULT_BRAND: BrandStyle = {
  name: 'LDB',
  tagline: 'Perler Beads AI — Your Image, Pixelated',
  primaryColor: [99, 102, 241],  // indigo
  accentColor: [168, 85, 247],   // purple
};

// ── 导出入口 ──

export async function exportPackagingPDF(
  bill: IngredientBill,
  brand: Partial<BrandStyle> = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const style = { ...DEFAULT_BRAND, ...brand } as BrandStyle;

  // Page 1: 包装盒正面（裁切+折叠线+品牌视觉）
  drawBoxFront(doc, bill, style);

  // Page 2: 包装盒侧面/标签
  drawBoxSidePanel(doc, bill, style);

  // Page 3: 盒子展开图（裁切+折叠线）
  drawBoxUnfoldPattern(doc, bill, style);

  // Page 4: 封底（使用说明+二维码）
  drawBoxBackPanel(doc, bill, style);

  doc.save(`packaging-${bill.designId}.pdf`);
}

// ── 第1页：包装盒正面 ──

function drawBoxFront(doc: jsPDF, bill: IngredientBill, style: BrandStyle): void {
  const cx = A4_W / 2;
  const bx = cx - 70; // box left x = 35
  const by = 30;
  const bw = 140;
  const bh = 220;

  // 背景
  doc.setFillColor(249, 250, 251);
  doc.rect(0, 0, A4_W, A4_H, 'F');

  // 标题
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...style.primaryColor);
  doc.text('包装盒正面 · Front Panel', cx, 20, { align: 'center' });

  // 盒子外框（裁切虚线）
  doc.setDrawColor(...style.primaryColor);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 1], 0);
  doc.rect(bx, by, bw, bh);

  doc.setLineWidth(0.3);
  doc.setLineDashPattern([], 0);

  // 品牌区域（顶部）
  const brandH = 40;
  const brandY = by + 5;
  doc.setFillColor(...style.primaryColor);
  doc.rect(bx + 1, brandY, bw - 2, brandH, 'F');

  // 品牌名（大字体）
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.text(style.name, bx + bw / 2, brandY + 17, { align: 'center' });

  // 标语
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(224, 231, 255);
  doc.text(style.tagline, bx + bw / 2, brandY + 28, { align: 'center' });

  // 分割线
  doc.setDrawColor(224, 231, 255);
  doc.setLineWidth(0.3);
  doc.line(bx + 20, brandY + 33, bx + bw - 20, brandY + 33);

  // 设计信息
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text('DIY Perler Beads Kit', bx + bw / 2, brandY + 46, { align: 'center' });

  // 装饰像素风图案（用色块模拟）
  const pixelSize = 4;
  const startX = bx + (bw - 7 * pixelSize) / 2;
  const startY = brandY + 52;

  const sampleColors = bill.items.slice(0, 7).map(item => {
    const hex = item.hexCode.replace('#', '');
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ] as [number, number, number];
  });

  // 如果颜色不够，用品牌色填充
  while (sampleColors.length < 7) {
    sampleColors.push(style.accentColor);
  }

  sampleColors.forEach((color, idx) => {
    doc.setFillColor(...color);
    doc.rect(startX + idx * pixelSize, startY, pixelSize, pixelSize, 'F');
  });

  // 参数
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  const paramY = startY + pixelSize + 8;
  [
    `Grid: ${bill.gridSize.cols} × ${bill.gridSize.rows}`,
    `Beads: ${bill.totalBeads.toLocaleString()} 粒`,
    `Colors: ${bill.colorCount} 种  |  Weight: ${bill.totalWeight}g`,
    `System: ${bill.colorSystem}`,
  ].forEach((line, idx) => {
    doc.text(line, bx + bw / 2, paramY + idx * 6, { align: 'center' });
  });

  // 底部装饰线
  doc.setDrawColor(...style.accentColor);
  doc.setLineWidth(0.4);
  doc.line(bx + 15, paramY + 30, bx + bw - 15, paramY + 30);

  // 二维码区域占位
  const qrY = paramY + 34;
  const qrSize = 25;
  doc.setFillColor(243, 244, 246);
  doc.rect(bx + bw / 2 - qrSize / 2, qrY, qrSize, qrSize, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(bx + bw / 2 - qrSize / 2, qrY, qrSize, qrSize);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(5);
  doc.setTextColor(156, 163, 175);
  doc.text('QR Code', bx + bw / 2, qrY + qrSize / 2, { align: 'center' });

  // 底部说明
  doc.setFontSize(6);
  doc.setTextColor(209, 213, 219);
  doc.text(`© ${new Date().getFullYear()} ${style.name} · AI-Generated Perler Patterns`, cx, A4_H - 10, { align: 'center' });
}

// ── 第2页：包装盒侧面 ──

function drawBoxSidePanel(doc: jsPDF, bill: IngredientBill, style: BrandStyle): void {
  const cx = A4_W / 2;
  const sx = cx - 30;
  const sy = 30;
  const sw = 60;
  const sh = 220;

  doc.setFillColor(249, 250, 251);
  doc.rect(0, 0, A4_W, A4_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...style.primaryColor);
  doc.text('包装盒侧面 · Side Panel', cx, 20, { align: 'center' });

  // 盒子框
  doc.setDrawColor(...style.primaryColor);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 1], 0);
  doc.rect(sx, sy, sw, sh);
  doc.setLineDashPattern([], 0);

  // 品牌顶部
  doc.setFillColor(...style.primaryColor);
  doc.rect(sx, sy, sw, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(style.name, cx, sy + 10, { align: 'center' });

  // 设计编号
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(55, 65, 81);
  doc.text(bill.designId, cx, sy + 26, { align: 'center' });

  // 分隔线
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(sx + 5, sy + 30, sx + sw - 5, sy + 30);

  // 颜色小标签
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(107, 114, 128);
  doc.text('COLORS', cx, sy + 35, { align: 'center' });

  let colorY = sy + 40;
  bill.items.slice(0, 15).forEach((item) => {
    const rgb = hexToRgb(item.hexCode);
    if (rgb) {
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(sx + 5, colorY, 6, 6, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`${item.colorKey} ${item.beadCount}粒`, sx + 14, colorY + 4);
    colorY += 7;
  });

  if (bill.items.length > 15) {
    doc.setFontSize(4);
    doc.setTextColor(156, 163, 175);
    doc.text(`+${bill.items.length - 15} more`, cx, colorY + 3, { align: 'center' });
  }

  // 分隔线
  colorY += 8;
  doc.setDrawColor(229, 231, 235);
  doc.line(sx + 5, colorY, sx + sw - 5, colorY);

  // 配件
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(107, 114, 128);
  colorY += 5;
  doc.text('ACCESSORIES', cx, colorY, { align: 'center' });
  colorY += 5;

  bill.accessories.forEach((acc) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`${acc.name.replace(/\(.*\)/, '').trim()} ×${acc.quantity}`, cx, colorY, { align: 'center' });
    colorY += 6;
  });

  // 底部
  colorY += 5;
  doc.setDrawColor(...style.accentColor);
  doc.setLineWidth(0.3);
  doc.line(sx + 5, colorY, sx + sw - 5, colorY);
  colorY += 5;

  doc.setFontSize(4);
  doc.setTextColor(209, 213, 219);
  doc.text('Scan QR to get', cx, colorY, { align: 'center' });
  doc.text('your own patterns!', cx, colorY + 4, { align: 'center' });
}

// ── 第3页：盒子展开图（裁切+折叠线） ──

function drawBoxUnfoldPattern(doc: jsPDF, bill: IngredientBill, style: BrandStyle): void {
  const cx = A4_W / 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, A4_W, A4_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...style.primaryColor);
  doc.text('展开图 · Unfold Pattern (Cut & Fold)', cx, 18, { align: 'center' });

  // 盒子尺寸参数（毫米）
  const fw = 80; // front width
  const fh = 50; // front height
  const d = 45;  // depth
  const t = 10;  // tab height

  const startX = cx - fw / 2;
  const y = 30;

  // 排版：从上到下
  // [  Top Flap  ]          y
  // [Left][Front][Right]    y+t
  // [  Bottom  ]            y+fh+t
  // [  Bottom Flap]         y+fh+d+t

  const panelPositions: {
    x: number; y: number; w: number; h: number;
    label: string; type: 'cut' | 'fold';
  }[] = [];

  // Top flap
  const topY = y;
  panelPositions.push({ x: startX, y: topY, w: fw, h: t, label: 'Top Tab', type: 'fold' });

  // Left, Front, Right
  const midY = y + t;
  const lw = (A4_W - 2 * M - fw) / 2;
  const leftX = M;
  const rightX = M + M + lw;
  panelPositions.push({ x: leftX, y: midY, w: lw, h: fh, label: 'Left', type: 'cut' });
  panelPositions.push({ x: startX, y: midY, w: fw, h: fh, label: 'Front', type: 'cut' });
  panelPositions.push({ x: rightX, y: midY, w: lw, h: fh, label: 'Right', type: 'cut' });

  // Bottom panel
  const bottomY = midY + fh;
  panelPositions.push({ x: startX, y: bottomY, w: fw, h: d, label: 'Bottom', type: 'fold' });

  // Bottom flap
  const flapY = bottomY + d;
  panelPositions.push({ x: startX, y: flapY, w: fw, h: t, label: 'Bottom Tab', type: 'fold' });

  // 绘制面板
  panelPositions.forEach((p) => {
    // 线条类型
    if (p.type === 'cut') {
      doc.setDrawColor(239, 68, 68); // red = cut
    } else {
      doc.setDrawColor(34, 197, 94); // green = fold
    }
    doc.setLineWidth(0.4);
    doc.setLineDashPattern(p.type === 'cut' ? [3, 1] : [1, 1], 0);
    doc.rect(p.x, p.y, p.w, p.h);
    doc.setLineDashPattern([], 0);

    // 标签
    doc.setFillColor(243, 244, 246);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);
    const tW = doc.getTextWidth(p.label);
    doc.text(p.label, p.x + p.w / 2 - tW / 2, p.y + p.h / 2 + 2.5);

    // 方向箭头
    if (p.type === 'fold') {
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.3);
      const arrowDir = p.label === 'Left' || p.label === 'Right' ? '→' : '↓';
      doc.setFontSize(5);
      doc.setTextColor(34, 197, 94);
      doc.text(`⤵ fold ${arrowDir}`, p.x + p.w / 2 - 10, p.y + p.h / 2 + 8);
    }
  });

  // 图例
  const legendY = flapY + t + 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('图例 / Legend:', M, legendY);

  doc.setLineWidth(0.4);
  // Cut line
  doc.setDrawColor(239, 68, 68);
  doc.setLineDashPattern([3, 1], 0);
  doc.line(M + 5, legendY + 6, M + 25, legendY + 6);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  doc.text('— 裁切线 (Cut)', M + 30, legendY + 6);

  // Fold line
  doc.setDrawColor(34, 197, 94);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M + 5, legendY + 14, M + 25, legendY + 14);
  doc.setLineDashPattern([], 0);
  doc.text('— 折叠线 (Fold)', M + 30, legendY + 14);

  // 使用说明
  const noteY = legendY + 24;
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  const instructions = [
    '1. 沿红色虚线裁切外轮廓',
    '2. 沿绿色虚线折叠所有面板',
    '3. 将左右面板向内折叠 90°',
    '4. 将底部面板向下折叠 90°',
    '5. 将前后插舌插入对应槽位固定',
    '6. 将打印的正面贴纸粘贴在前面板',
  ];
  instructions.forEach((line, idx) => {
    doc.text(line, M, noteY + idx * 6);
  });

  // 尺寸标注
  const dimY = noteY + instructions.length * 6 + 5;
  doc.setFontSize(6);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `成品尺寸: ${fw}mm(W) × ${fh}mm(H) × ${d}mm(D)  |  适用纸张: A4 (210×297mm)  |  推荐克重: 200-250g 铜版纸`,
    cx, dimY, { align: 'center' }
  );
}

// ── 第4页：封底 ──

function drawBoxBackPanel(doc: jsPDF, bill: IngredientBill, style: BrandStyle): void {
  const cx = A4_W / 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, A4_W, A4_H, 'F');

  // 顶部装饰条
  doc.setFillColor(...style.accentColor);
  doc.rect(0, 0, A4_W, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...style.primaryColor);
  doc.text('使用说明 · How to Use', cx, 22, { align: 'center' });

  // 分隔线
  doc.setDrawColor(...style.primaryColor);
  doc.setLineWidth(0.4);
  doc.line(M, 28, A4_W - M, 28);

  // 步骤
  const steps = [
    {
      title: 'Step 1: 打印 & 裁切',
      desc: '将包装盒展开图打印在 200-250g 铜版纸上。沿红色虚线裁切外轮廓。',
    },
    {
      title: 'Step 2: 折叠 & 组装',
      desc: '沿绿色虚线折叠所有面板。按展开图中的说明将盒子组装成型。',
    },
    {
      title: 'Step 3: 装入配料',
      desc: '根据颜色标签，将分装好的珠子按色号装入对应的包装小袋中。',
    },
    {
      title: 'Step 4: 封盒',
      desc: '将珠子袋、图纸 PDF 打印件、配件（模板板/熨烫纸/镊子）装入盒中。',
    },
  ];

  let stepY = 36;
  steps.forEach((step) => {
    // 步骤编号圆
    doc.setFillColor(...style.primaryColor);
    doc.circle(M + 5, stepY - 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(step.title.replace('Step ', '').slice(0, 1), M + 5, stepY + 0.5, { align: 'center' });

    // 步骤标题
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(step.title, M + 16, stepY);

    // 步骤描述
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    const lines = doc.splitTextToSize(step.desc, A4_W - M * 2 - 20);
    doc.text(lines, M + 16, stepY + 5);

    stepY += 18 + lines.length * 4;
  });

  // 分隔
  stepY += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(M, stepY, A4_W - M, stepY);

  // 设计信息汇总
  stepY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...style.primaryColor);
  doc.text('设计信息', M, stepY);
  stepY += 8;

  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  const infoLines = [
    `设计编号: ${bill.designId}`,
    `网格尺寸: ${bill.gridSize.cols} × ${bill.gridSize.rows}`,
    `总用量: ${bill.totalBeads.toLocaleString()} 粒`,
    `颜色数: ${bill.colorCount} 种 (${bill.colorSystem})`,
    `总重量: ${bill.totalWeight}g`,
    `拼豆规格: ${bill.beadSize === 'standard' ? '标准 5mm' : '迷你 2.5mm'}`,
    `损耗冗余: ${((bill.redundancyRatio - 1) * 100).toFixed(0)}%`,
  ];
  infoLines.forEach((line) => {
    doc.text(line, M + 5, stepY);
    stepY += 5;
  });

  // 底部
  stepY += 5;
  doc.setDrawColor(...style.accentColor);
  doc.setLineWidth(0.4);
  doc.line(M, stepY, A4_W - M, stepY);

  stepY += 8;
  doc.setFontSize(6);
  doc.setTextColor(209, 213, 219);
  doc.text(
    `${style.name} © ${new Date().getFullYear()}  ·  AI-Generated Perler Beads Patterns`,
    cx, stepY, { align: 'center' }
  );
  doc.text(
    'Generated by Perler Beads AI — Scan QR for your own patterns',
    cx, stepY + 4, { align: 'center' }
  );
}

// ── 辅助 ──

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}
