import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type ParsedOrderUploadRow = {
  rowNumber: number;
  raw: Record<string, string>;
  selected: boolean;
};

export type OrderUploadTemplate = 'generic' | 'nimson-order-v1';
export type OrderUnitMode = 'dozen' | 'piece' | 'jar';

export type OrderUploadMappedRow = {
  rowNumber: number;
  skuId: string;
  quantity: number;
  unitMode: OrderUnitMode;
  customPrice?: number;
  name?: string;
  skuSize?: string;
};

type ColumnMapping = {
  skuId: string;
  name: string;
  skuSize: string;
  quantity: string;
  unitMode: string;
  customPrice: string;
};

const EMPTY_COLUMN = '__NONE__';
const VIRTUAL_SKU = '__order_sku';
const VIRTUAL_SKU_SIZE = '__order_sku_size';
const VIRTUAL_QTY = '__order_qty';
const VIRTUAL_UNIT_MODE = '__order_unit_mode';
const VIRTUAL_PRICE = '__order_custom_price';

const NIMSON_REQUIRED_HEADERS = ['code no', 'name of product', 'sku', 'order'];

const MAPPING_KEYS: Array<keyof ColumnMapping> = [
  'skuId',
  'name',
  'skuSize',
  'quantity',
  'unitMode',
  'customPrice',
];

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueHeaderName(base: string, used: Set<string>): string {
  const clean = base.trim() || 'Unnamed Column';
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  let count = 2;
  while (used.has(`${clean}_${count}`)) {
    count += 1;
  }
  const candidate = `${clean}_${count}`;
  used.add(candidate);
  return candidate;
}

function chooseHeaderRow(matrix: string[][]): number {
  let bestIndex = -1;
  let bestScore = -1;

  matrix.forEach((row, index) => {
    const nonEmpty = row.filter((cell) => cell.trim() !== '').length;
    if (nonEmpty === 0) return;

    const textCells = row.filter((cell) => /[a-zA-Z]/.test(cell)).length;
    const score = nonEmpty * 10 + textCells;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function chooseNimsonHeaderRow(matrix: string[][]): number {
  for (let index = 0; index < matrix.length; index += 1) {
    const normalizedCells = matrix[index].map((cell) => normalizeHeader(cell));
    const cellSet = new Set(normalizedCells.filter(Boolean));
    const hasAllRequired = NIMSON_REQUIRED_HEADERS.every((required) => cellSet.has(required));
    if (hasAllRequired) {
      return index;
    }
  }
  return -1;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  const intValue = Math.trunc(parsed);
  if (!Number.isInteger(intValue) || intValue <= 0) return null;
  return intValue;
}

function isLikelySkuCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^#+$/.test(trimmed)) return false;
  return /[a-z0-9]/i.test(trimmed);
}

function buildInitialMapping(headers: string[], template: OrderUploadTemplate): ColumnMapping {
  const lower = headers.map((h) => normalizeHeader(h));
  const used = new Set<string>();
  const pick = (candidates: string[]) => {
    const index = lower.findIndex(
      (h, idx) => !used.has(headers[idx]) && candidates.some((c) => h.includes(c))
    );
    if (index >= 0) {
      used.add(headers[index]);
      return headers[index];
    }
    return EMPTY_COLUMN;
  };

  if (template === 'nimson-order-v1') {
    return {
      skuId: pick(['code no']),
      name: pick(['name of product']),
      skuSize: pick(['sku']),
      quantity: pick(['order']),
      unitMode: EMPTY_COLUMN,
      customPrice: EMPTY_COLUMN,
    };
  }

  return {
    skuId: pick([
      'sku id',
      'skuid',
      'sku code',
      'mastersku',
      'master sku',
      'code no',
      'item code',
      'code',
    ]),
    name: pick(['name of product', 'product name', 'product', 'sku name', 'item name', 'name']),
    skuSize: pick(['sku', 'size']),
    quantity: pick(['order qty', 'order quantity', 'order', 'qty', 'quantity', 'boxes', 'dozen', 'billed qty']),
    unitMode: pick(['unit mode', 'mode', 'uom', 'unit', 'master pkg', 'master pkg.', 'master pack', 'pack']),
    customPrice: pick(['custom price', 'amount per', 'n.rate', 'n rate', 'rate', 'price']),
  };
}

export interface SpreadsheetParsedResult {
  fileName: string;
  headers: string[];
  rows: ParsedOrderUploadRow[];
}

export async function parseOrderSpreadsheetFile(
  fileUri: string,
  fileName: string,
  options?: { template?: OrderUploadTemplate }
): Promise<SpreadsheetParsedResult> {
  const template = options?.template ?? 'generic';
  
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: 'base64' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Uploaded file has no sheet');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as string[][];

  if (!matrix.length) {
    throw new Error('Uploaded file is empty');
  }

  const normalizedMatrix = matrix.map((row) =>
    row.map((cell) => String(cell ?? '').trim())
  );
  const headerRowIndex =
    template === 'nimson-order-v1'
      ? chooseNimsonHeaderRow(normalizedMatrix)
      : chooseHeaderRow(normalizedMatrix);
  if (headerRowIndex < 0) {
    throw new Error('Could not detect header row in uploaded file');
  }

  const rawHeaders = normalizedMatrix[headerRowIndex] ?? [];
  const usedHeaderNames = new Set<string>();
  const headers = rawHeaders.map((header, index) => {
    const defaultName = `Column_${index + 1}`;
    const label = !header || /^__EMPTY/i.test(header) ? defaultName : header;
    return uniqueHeaderName(label, usedHeaderNames);
  });

  if (!headers.length) {
    throw new Error('Could not detect columns in uploaded file');
  }

  if (template === 'nimson-order-v1') {
    const headerSet = new Set(headers.map((h) => normalizeHeader(h)));
    const missingHeaders = NIMSON_REQUIRED_HEADERS.filter((required) => !headerSet.has(required));
    if (missingHeaders.length > 0) {
      throw new Error(
        `Invalid order template. Missing required column(s): ${missingHeaders.join(', ')}.`
      );
    }
  }

  const normalizedHeaderMap = new Map<string, string>();
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (!normalizedHeaderMap.has(normalized)) {
      normalizedHeaderMap.set(normalized, header);
    }
  });

  const nimsonCodeHeader = normalizedHeaderMap.get('code no');
  const nimsonNameHeader = normalizedHeaderMap.get('name of product');
  const nimsonSkuSizeHeader = normalizedHeaderMap.get('sku');
  const nimsonOrderHeader = normalizedHeaderMap.get('order');

  const parsedRows: ParsedOrderUploadRow[] = normalizedMatrix
    .slice(headerRowIndex + 1)
    .map((cells, index) => {
      const hasAnyValue = cells.some((cell) => cell.trim() !== '');
      if (!hasAnyValue) {
        return null;
      }

      const normalized: Record<string, string> = {
        [VIRTUAL_SKU]: '',
        [VIRTUAL_SKU_SIZE]: '',
        [VIRTUAL_QTY]: '',
        [VIRTUAL_UNIT_MODE]: '',
        [VIRTUAL_PRICE]: '',
      };
      headers.forEach((header, colIndex) => {
        normalized[header] = String(cells[colIndex] ?? '').trim();
      });

      if (template === 'nimson-order-v1') {
        const skuId = nimsonCodeHeader ? (normalized[nimsonCodeHeader] ?? '').trim() : '';
        const name = nimsonNameHeader ? (normalized[nimsonNameHeader] ?? '').trim() : '';
        const skuSize = nimsonSkuSizeHeader ? (normalized[nimsonSkuSizeHeader] ?? '').trim() : '';
        const quantityRaw = nimsonOrderHeader ? (normalized[nimsonOrderHeader] ?? '').trim() : '';
        const quantity = parsePositiveInteger(quantityRaw);

        if (!isLikelySkuCode(skuId) || quantity === null) {
          return null;
        }

        normalized[VIRTUAL_SKU] = skuId;
        normalized[VIRTUAL_QTY] = String(quantity);
        normalized[VIRTUAL_SKU_SIZE] = skuSize;
        if (nimsonNameHeader && name) {
          normalized[nimsonNameHeader] = name;
        }
      }

      return {
        rowNumber: headerRowIndex + index + 2,
        raw: normalized,
        selected: true,
      } as ParsedOrderUploadRow;
    })
    .filter((row): row is ParsedOrderUploadRow => row !== null);

  if (!parsedRows.length) {
    if (template === 'nimson-order-v1') {
      throw new Error('No valid order rows found. Fill ORDER column with quantity greater than 0.');
    }
    throw new Error('No data rows found below header row');
  }

  return {
    fileName,
    headers,
    rows: parsedRows,
  };
}

export default function OrderBulkUploadModal({
  open,
  fileName,
  headers,
  rows,
  onRowsChange,
  onApply,
  onClose,
  supportsUnitMode,
  supportsCustomPrice,
  template,
}: {
  open: boolean;
  fileName: string;
  headers: string[];
  rows: ParsedOrderUploadRow[];
  onRowsChange: (rows: ParsedOrderUploadRow[]) => void;
  onApply: (rows: OrderUploadMappedRow[]) => void;
  onClose: () => void;
  supportsUnitMode: boolean;
  supportsCustomPrice: boolean;
  template?: OrderUploadTemplate;
}) {
  const selectedTemplate = template ?? 'generic';
  const isStrictNimsonTemplate = selectedTemplate === 'nimson-order-v1';
  const [mapping, setMapping] = useState<ColumnMapping>(() => buildInitialMapping(headers, selectedTemplate));
  const [error, setError] = useState('');

  // Dropdown states for column selectors on mobile UI
  const [activeDropdownKey, setActiveDropdownKey] = useState<keyof ColumnMapping | null>(null);

  useEffect(() => {
    setMapping(buildInitialMapping(headers, selectedTemplate));
  }, [headers, selectedTemplate]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);

  const resolveColumnKey = useCallback(
    (row: ParsedOrderUploadRow, key: keyof ColumnMapping): string => {
      const mapped = mapping[key];
      if (mapped && mapped !== EMPTY_COLUMN) {
        return mapped;
      }
      if (key === 'skuId') return VIRTUAL_SKU;
      if (key === 'skuSize') return VIRTUAL_SKU_SIZE;
      if (key === 'quantity') return VIRTUAL_QTY;
      if (key === 'unitMode') return VIRTUAL_UNIT_MODE;
      if (key === 'customPrice') return VIRTUAL_PRICE;
      return EMPTY_COLUMN;
    },
    [mapping]
  );

  const getCell = useCallback(
    (row: ParsedOrderUploadRow, key: keyof ColumnMapping) => {
      const col = resolveColumnKey(row, key);
      if (!col || col === EMPTY_COLUMN) return '';
      return row.raw[col] ?? '';
    },
    [resolveColumnKey]
  );

  const updateCell = (rowNumber: number, key: keyof ColumnMapping, value: string) => {
    onRowsChange(
      rows.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const columnKey = resolveColumnKey(row, key);
        if (!columnKey || columnKey === EMPTY_COLUMN) return row;
        return {
          ...row,
          raw: {
            ...row.raw,
            [columnKey]: value,
          },
        };
      })
    );
  };

  const toggleRow = (rowNumber: number) => {
    onRowsChange(
      rows.map((row) =>
        row.rowNumber === rowNumber ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const setAllRows = (selected: boolean) => {
    onRowsChange(rows.map((row) => ({ ...row, selected })));
  };

  const removeRow = (rowNumber: number) => {
    onRowsChange(rows.filter((row) => row.rowNumber !== rowNumber));
  };

  const handleApply = () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one row to apply.');
      return;
    }

    const mappedRows: OrderUploadMappedRow[] = [];
    const invalidRows: number[] = [];

    for (const row of selectedRows) {
      const skuId = getCell(row, 'skuId').trim();
      const name = getCell(row, 'name').trim();
      const skuSize = getCell(row, 'skuSize').trim();
      const quantityRaw = getCell(row, 'quantity').trim();
      const quantityNum = Number.parseFloat(quantityRaw.replace(/[^0-9.-]/g, ''));
      const quantity = Number.isFinite(quantityNum) ? Math.trunc(quantityNum) : Number.NaN;
      const unitModeRaw = getCell(row, 'unitMode').trim().toLowerCase();
      const customPriceRaw = getCell(row, 'customPrice').trim();
      const customPriceNum = customPriceRaw
        ? Number.parseFloat(customPriceRaw.replace(/[^0-9.-]/g, ''))
        : undefined;

      const unitMode: OrderUnitMode =
        supportsUnitMode && (unitModeRaw.includes('jar') || unitModeRaw.includes('20'))
          ? 'jar'
          : supportsUnitMode && (unitModeRaw.includes('piece') || unitModeRaw.includes('pc'))
            ? 'piece'
            : 'dozen';

      if (!skuId || !Number.isInteger(quantity) || quantity <= 0) {
        invalidRows.push(row.rowNumber);
        continue;
      }

      mappedRows.push({
        rowNumber: row.rowNumber,
        skuId,
        name: name || undefined,
        skuSize: skuSize || undefined,
        quantity,
        unitMode,
        customPrice:
          supportsCustomPrice && customPriceNum && Number.isFinite(customPriceNum) && customPriceNum > 0
            ? Math.round(customPriceNum * 100) / 100
            : undefined,
      });
    }

    if (mappedRows.length === 0) {
      setError('No valid rows found. Please provide SKU and quantity for selected rows.');
      return;
    }

    if (invalidRows.length > 0) {
      setError(`Skipped invalid row(s): ${invalidRows.join(', ')}.`);
    } else {
      setError('');
    }

    onApply(mappedRows);
  };

  const renderColumnSelector = (label: string, key: keyof ColumnMapping, required = false) => {
    const isDropdownOpen = activeDropdownKey === key;
    const selectedInOther = new Set(
      MAPPING_KEYS.filter((k) => k !== key)
        .map((k) => mapping[k])
        .filter((value) => value && value !== EMPTY_COLUMN)
    );

    const availableHeaders = headers.filter(
      (header) => !selectedInOther.has(header) || mapping[key] === header
    );

    return (
      <View className="mb-3 flex-1 min-w-[120px]" key={key}>
        <Text className="text-xs font-bold text-gray-500 mb-1">
          {label} {required ? '*' : ''}
        </Text>
        <TouchableOpacity
          onPress={() => setActiveDropdownKey(isDropdownOpen ? null : key)}
          className="border border-gray-250 bg-white rounded-lg px-3 py-2 flex-row justify-between items-center"
        >
          <Text className="text-xs text-gray-800 font-semibold truncate" numberOfLines={1}>
            {mapping[key] === EMPTY_COLUMN ? '— Not Mapped —' : mapping[key]}
          </Text>
          <Ionicons name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#6b7280" />
        </TouchableOpacity>

        {isDropdownOpen && (
          <View className="border border-gray-200 bg-white rounded-lg overflow-hidden mt-1 absolute z-55 w-full shadow-md">
            <TouchableOpacity
              onPress={() => {
                setMapping((prev) => ({ ...prev, [key]: EMPTY_COLUMN }));
                setActiveDropdownKey(null);
              }}
              className={`px-3 py-2.5 border-b border-gray-150 ${
                mapping[key] === EMPTY_COLUMN ? 'bg-orange-50' : 'active:bg-gray-50'
              }`}
            >
              <Text className={`text-xs ${mapping[key] === EMPTY_COLUMN ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                — Not Mapped —
              </Text>
            </TouchableOpacity>
            {availableHeaders.map((header) => (
              <TouchableOpacity
                key={header}
                onPress={() => {
                  setMapping((prev) => ({ ...prev, [key]: header }));
                  setActiveDropdownKey(null);
                }}
                className={`px-3 py-2.5 border-b border-gray-150 ${
                  mapping[key] === header ? 'bg-orange-50' : 'active:bg-gray-50'
                }`}
              >
                <Text className={`text-xs ${mapping[key] === header ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                  {header}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" transparent={false}>
      <SafeAreaView className="flex-grow bg-gray-50">
        
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row justify-between items-center">
          <View className="flex-1 mr-4">
            <Text className="text-base font-bold text-gray-900">Upload Order Rows</Text>
            <Text className="text-[10px] text-gray-400 font-semibold truncate mt-0.5" numberOfLines={1}>
              File: {fileName} · Rows: {rows.length}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-3" contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-center gap-2 mb-4">
              <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
              <Text className="flex-1 text-xs text-red-700 font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Column Mappers */}
          {!isStrictNimsonTemplate && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {renderColumnSelector('Product', 'skuId', true)}
              {renderColumnSelector('Name', 'name')}
              {renderColumnSelector('Quantity', 'quantity', true)}
              {supportsUnitMode && renderColumnSelector('Unit Mode', 'unitMode')}
              {supportsCustomPrice && renderColumnSelector('Custom Price', 'customPrice')}
            </View>
          )}

          {/* Quick Selection Buttons */}
          <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl p-3 mb-4 shadow-sm">
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setAllRows(true)}
                className="bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <Text className="text-[11px] font-bold text-gray-700 uppercase">Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAllRows(false)}
                className="bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <Text className="text-[11px] font-bold text-gray-700 uppercase">Deselect All</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500 font-semibold">
              Selected: {selectedRows.length}/{rows.length}
            </Text>
          </View>

          {/* Editable List of Rows */}
          <View className="gap-3">
            {rows.map((row) => {
              const skuId = getCell(row, 'skuId');
              const name = getCell(row, 'name');
              const skuSize = getCell(row, 'skuSize');
              const quantity = getCell(row, 'quantity');
              const customPrice = getCell(row, 'customPrice');
              const rawMode = getCell(row, 'unitMode').toLowerCase();
              const mode = rawMode.includes('jar') || rawMode.includes('20')
                ? 'jar'
                : rawMode.includes('piece') || rawMode.includes('pc')
                  ? 'piece'
                  : 'dozen';

              return (
                <View
                  key={row.rowNumber}
                  className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${
                    row.selected ? 'border-orange-200 bg-orange-50/10' : ''
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => toggleRow(row.rowNumber)}
                        className="p-1"
                      >
                        <Ionicons
                          name={row.selected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={row.selected ? '#f97316' : '#9ca3af'}
                        />
                      </TouchableOpacity>
                      <Text className="text-xs font-bold text-gray-500">Row {row.rowNumber}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeRow(row.rowNumber)}
                      className="flex-row items-center gap-1 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1 active:bg-red-100"
                    >
                      <Ionicons name="trash-outline" size={12} color="#dc2626" />
                      <Text className="text-[10px] font-bold text-red-700 uppercase">Remove</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="gap-2.5">
                    {/* Sku ID Input */}
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-xs text-gray-400 font-bold w-16">Product ID</Text>
                      <TextInput
                        value={skuId}
                        onChangeText={(val) => updateCell(row.rowNumber, 'skuId', val)}
                        placeholder="Product Code"
                        placeholderTextColor="#9ca3af"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800"
                      />
                    </View>

                    {/* Product Name Input */}
                    {!isStrictNimsonTemplate && (
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-xs text-gray-400 font-bold w-16">Name</Text>
                        <TextInput
                          value={name}
                          onChangeText={(val) => updateCell(row.rowNumber, 'name', val)}
                          placeholder="Product Name"
                          placeholderTextColor="#9ca3af"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800"
                        />
                      </View>
                    )}

                    {/* Sku Size Input */}
                    {!isStrictNimsonTemplate && (
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-xs text-gray-400 font-bold w-16">SKU Size</Text>
                        <TextInput
                          value={skuSize}
                          onChangeText={(val) => updateCell(row.rowNumber, 'skuSize', val)}
                          placeholder="Size (e.g. 50g)"
                          placeholderTextColor="#9ca3af"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800"
                        />
                      </View>
                    )}

                    {/* Quantity Input */}
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-xs text-gray-400 font-bold w-16">Quantity</Text>
                      <TextInput
                        value={quantity}
                        onChangeText={(val) => updateCell(row.rowNumber, 'quantity', val)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9ca3af"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800"
                      />
                    </View>

                    {/* Unit Mode Selector */}
                    {supportsUnitMode && (
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-xs text-gray-400 font-bold w-16">Unit</Text>
                        <View className="flex-row gap-2 flex-1">
                          {['piece', 'dozen', 'jar'].map((unit) => {
                            const isSel = mode === unit;
                            return (
                              <TouchableOpacity
                                key={unit}
                                onPress={() => updateCell(row.rowNumber, 'unitMode', unit)}
                                className={`flex-1 border rounded-lg py-1.5 items-center justify-center ${
                                  isSel ? 'border-orange-500 bg-orange-50/10' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <Text className={`text-[10px] font-bold uppercase ${isSel ? 'text-orange-600' : 'text-gray-500'}`}>
                                  {unit === 'dozen' ? 'Doz (12)' : unit === 'jar' ? 'Jar (20)' : 'Pc'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Custom Price Input */}
                    {supportsCustomPrice && (
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-xs text-gray-400 font-bold w-16">Price (INR)</Text>
                        <TextInput
                          value={customPrice}
                          onChangeText={(val) => updateCell(row.rowNumber, 'customPrice', val)}
                          keyboardType="numeric"
                          placeholder="INR/dozen"
                          placeholderTextColor="#9ca3af"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800"
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {rows.length === 0 && (
              <View className="bg-white border border-gray-200 rounded-xl p-8 items-center justify-center">
                <Ionicons name="document-text-outline" size={32} color="#9ca3af" className="opacity-45 mb-2" />
                <Text className="text-xs text-gray-400 font-semibold">No spreadsheet rows loaded</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-150 p-4 flex-row gap-3">
          <TouchableOpacity
            onPress={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl items-center justify-center active:bg-gray-50"
          >
            <Text className="text-sm font-bold text-gray-700">Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleApply}
            className="flex-1 py-3 bg-orange-500 active:bg-orange-600 rounded-xl items-center justify-center"
          >
            <Text className="text-white font-bold text-sm">Apply to Order</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
}
