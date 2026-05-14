import React, { useState, useMemo } from 'react';
import { ColorSystem, MappedPixel } from '../utils/pixelation';
import {
  IngredientBill,
  BeadSize,
  generateIngredientBill,
  exportIngredientJSON,
  exportIngredientCSV,
  exportPackagingLabels,
} from '../utils/ingredientEngine';
import { exportPDF } from '../utils/pdfExporter';
import { exportPackagingPDF } from '../utils/packagingTemplate';

interface IngredientBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  colorCounts: Record<string, { count: number; color: string }> | null;
  totalBeads: number;
  colorSystem: ColorSystem;
  gridSize: { cols: number; rows: number };
  mappedPixelData: MappedPixel[][] | null;
}

const beadSizeOptions: { key: BeadSize; label: string; desc: string }[] = [
  { key: 'standard', label: '标准 (5mm)', desc: '直径约 5mm，每粒 0.052g' },
  { key: 'mini', label: '迷你 (2.5mm)', desc: '直径约 2.5mm，每粒 0.012g' },
];

const redundancyOptions = [
  { label: '无损耗 (0%)', value: 1.0 },
  { label: '少量 (10%)', value: 1.1 },
  { label: '标准 (20%)', value: 1.2 },
  { label: '保守 (30%)', value: 1.3 },
];

const IngredientBillModal: React.FC<IngredientBillModalProps> = ({
  isOpen,
  onClose,
  colorCounts,
  totalBeads,
  colorSystem,
  gridSize,
  mappedPixelData,
}) => {
  const [beadSize, setBeadSize] = useState<BeadSize>('standard');
  const [redundancyIdx, setRedundancyIdx] = useState(2);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isPackagingExporting, setIsPackagingExporting] = useState(false);

  const bill = useMemo<IngredientBill | null>(() => {
    if (!colorCounts || totalBeads === 0) return null;
    return generateIngredientBill({
      colorCounts,
      totalBeads,
      colorSystem,
      beadSize,
      redundancyRatio: redundancyOptions[redundancyIdx].value,
      gridSize,
    });
  }, [colorCounts, totalBeads, colorSystem, beadSize, redundancyIdx, gridSize]);

  const handleExportJSON = () => {
    if (!bill) return;
    exportIngredientJSON(bill);
  };

  const handleExportCSV = () => {
    if (!bill) return;
    exportIngredientCSV(bill);
  };

  const handleExportLabels = () => {
    if (!bill) return;
    exportPackagingLabels(bill);
  };

  const handleExportAll = () => {
    if (!bill) return;
    exportIngredientJSON(bill);
    setTimeout(() => exportIngredientCSV(bill), 300);
    setTimeout(() => exportPackagingLabels(bill), 600);
  };

  const handleExportPDF = async () => {
    if (!bill || !mappedPixelData) return;
    setIsPdfExporting(true);
    try {
      await exportPDF({
        bill,
        mappedPixelData,
        gridDimensions: { N: gridSize.cols, M: gridSize.rows },
        colorSystem,
      });
    } catch (err) {
      console.error('PDF 导出失败:', err);
      alert('PDF 导出失败，请重试。');
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleExportPackaging = async () => {
    if (!bill) return;
    setIsPackagingExporting(true);
    try {
      await exportPackagingPDF(bill);
    } catch (err) {
      console.error('包装模板导出失败:', err);
      alert('包装模板导出失败，请重试。');
    } finally {
      setIsPackagingExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">配料单导出</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-shrink-0">
          {/* 设计概要 */}
          {bill && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">设计编号</span>
                  <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">{bill.designId}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">网格尺寸</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.gridSize.cols} × {bill.gridSize.rows}</p>
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
                  <span className="text-gray-500 dark:text-gray-400">色号系统</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.colorSystem}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">颜色数</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{bill.colorCount} 种</p>
                </div>
              </div>
            </div>
          )}

          {/* 拼豆规格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">拼豆规格</label>
            <div className="grid grid-cols-2 gap-3">
              {beadSizeOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setBeadSize(opt.key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    beadSize === opt.key
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 冗余系数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              损耗冗余
              <span className="ml-1 text-xs text-gray-400">（熔合 + 操作损耗）</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {redundancyOptions.map((opt, idx) => (
                <button
                  key={opt.label}
                  onClick={() => setRedundancyIdx(idx)}
                  className={`py-2 px-2 rounded-lg border text-center text-xs font-medium transition-all ${
                    redundancyIdx === idx
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 颜色明细 */}
          {bill && bill.items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                颜色明细
              </label>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">色号</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">颜色</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">用量</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">包装重量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-1.5 font-mono text-gray-900 dark:text-gray-100">{item.colorKey}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: item.hexCode }}></span>
                            <span className="text-gray-500 dark:text-gray-400">{item.hexCode}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-900 dark:text-gray-100">{item.beadCount} 粒</td>
                        <td className="px-3 py-1.5 text-right text-gray-900 dark:text-gray-100">{item.packWeight}g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 配件建议 */}
          {bill && bill.accessories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">配件建议</label>
              <div className="space-y-2">
                {bill.accessories.map((acc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.name}</p>
                      {acc.note && <p className="text-xs text-gray-500 dark:text-gray-400">{acc.note}</p>}
                    </div>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">×{acc.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t dark:border-gray-700 flex flex-col gap-3 flex-shrink-0">
          <div className="grid grid-cols-6 gap-2">
            <button onClick={handleExportJSON} className="px-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors">
              JSON
            </button>
            <button onClick={handleExportCSV} className="px-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors">
              CSV
            </button>
            <button onClick={handleExportLabels} className="px-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors">
              标签
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!bill || !mappedPixelData || isPdfExporting}
              className="px-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPdfExporting ? '导出中...' : 'PDF'}
            </button>
            <button
              onClick={handleExportPackaging}
              disabled={!bill || isPackagingExporting}
              className="px-2 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPackagingExporting ? '导出中...' : '包装'}
            </button>
            <button onClick={handleExportAll} className="px-2 py-2.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs font-medium transition-colors">
              全导
            </button>
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default IngredientBillModal;
