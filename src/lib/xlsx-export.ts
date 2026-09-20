import { Platform, Alert } from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

type ExportRow = Record<string, string | number | boolean | null | undefined>;

interface ExportOptions {
  fileName: string;
  sheetName?: string;
}

// Global lock to prevent concurrent export operations from rapid double-taps
let isExportInProgress = false;

async function saveAndShareFile(
  contentBase64: string,
  fileName: string,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): Promise<void> {
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, contentBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: 'Export Report',
      UTI: 'com.microsoft.excel.xlsx',
    });
  } else {
    Alert.alert('File Saved', `Report saved to: ${fileName}`);
  }
}

async function downloadAndShareFile(
  urlString: string,
  fileName: string,
  token: string | null
): Promise<void> {
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const downloadResult = await FileSystem.downloadAsync(urlString, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloadResult.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export Report',
      UTI: 'com.microsoft.excel.xlsx',
    });
  } else {
    Alert.alert('File Saved', `Report saved to: ${fileName}`);
  }
}

export async function downloadXlsxReport(
  rows: ExportRow[],
  options: ExportOptions,
  skipLockCheck = false
): Promise<void> {
  if (rows.length === 0) {
    Alert.alert('No Data', 'There is no data to export.');
    return;
  }

  if (!skipLockCheck && isExportInProgress) {
    Alert.alert('Export In Progress', 'Please wait for the current export to complete.');
    return;
  }

  if (!skipLockCheck) {
    isExportInProgress = true;
  }

  const sheetName = (options.sheetName || 'Report').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31);
  const fileName = options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`;
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    if (Platform.OS === 'web') {
      XLSX.writeFile(workbook, fileName);
    } else {
      // Write workbook to a base64 string
      const wbout = XLSX.write(workbook, {
        type: 'base64',
        bookType: 'xlsx',
      });

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            // Retain full fileName with extension so Android creates a valid .xlsx file
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );
            await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, wbout, {
              encoding: FileSystem.EncodingType.Base64,
            });

            if (await Sharing.isAvailableAsync()) {
              Alert.alert('Export Successful', `Report saved successfully: ${fileName}`, [
                { text: 'OK' },
                {
                  text: 'Open / Share',
                  onPress: () => saveAndShareFile(wbout, fileName, mimeType),
                },
              ]);
            } else {
              Alert.alert('Export Successful', `Report saved successfully to: ${fileName}`);
            }
          } else {
            await saveAndShareFile(wbout, fileName, mimeType);
          }
        } catch (safErr) {
          console.warn('SAF save failed, using sharing fallback:', safErr);
          await saveAndShareFile(wbout, fileName, mimeType);
        }
      } else {
        // iOS
        await saveAndShareFile(wbout, fileName, mimeType);
      }
    }
  } catch (err: any) {
    console.error('XLSX export error:', err);
    Alert.alert('Export Error', err.message || 'Failed to export report as XLSX.');
  } finally {
    if (!skipLockCheck) {
      isExportInProgress = false;
    }
  }
}

/**
 * Fast direct streaming export for Orders using backend endpoint /orders/export (matching frontend web)
 */
export async function downloadOrdersXlsxReport(params: Record<string, any>): Promise<void> {
  if (isExportInProgress) {
    Alert.alert('Export In Progress', 'Please wait for the current export to complete.');
    return;
  }
  isExportInProgress = true;

  const token = useAuthStore.getState().token;
  const baseUrl = apiClient.defaults.baseURL;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, String(val));
    }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `orders-report-${timestamp}.xlsx`;
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    if (Platform.OS === 'web') {
      const res = await apiClient.get('/orders/export', {
        params: Object.fromEntries(query.entries()),
        responseType: 'blob',
      });
      const contentType = (res.headers && res.headers['content-type']) || '';
      const isCsv = contentType.includes('csv') || contentType.includes('text');
      const ext = isCsv ? 'csv' : 'xlsx';
      const actualFileName = `orders-report-${timestamp}.${ext}`;
      const actualMimeType = isCsv ? 'text/csv' : mimeType;

      const blob = new Blob([res.data], { type: actualMimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', actualFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } else {
      const urlString = `${baseUrl}/orders/export?${query.toString()}`;

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );

            const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;
            const downloadResult = await FileSystem.downloadAsync(urlString, tempFileUri, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const fileContent = await FileSystem.readAsStringAsync(downloadResult.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, fileContent, {
              encoding: FileSystem.EncodingType.Base64,
            });

            if (await Sharing.isAvailableAsync()) {
              Alert.alert('Export Successful', `Orders report saved: ${fileName}`, [
                { text: 'OK' },
                {
                  text: 'Open / Share',
                  onPress: async () => {
                    await Sharing.shareAsync(tempFileUri, {
                      mimeType,
                      dialogTitle: 'Open Orders Report',
                      UTI: 'com.microsoft.excel.xlsx',
                    });
                  },
                },
              ]);
            } else {
              Alert.alert('Export Successful', `Orders report saved to: ${fileName}`);
            }
          } else {
            await downloadAndShareFile(urlString, fileName, token);
          }
        } catch (safErr) {
          console.warn('SAF orders export failed, using sharing fallback:', safErr);
          await downloadAndShareFile(urlString, fileName, token);
        }
      } else {
        // iOS
        await downloadAndShareFile(urlString, fileName, token);
      }
    }
  } catch (err: any) {
    console.error('Orders export error, falling back to paginated export:', err);
    try {
      const { orderService } = require('@/services/order.service');
      const rowMapper = (order: any) => ({
        'Order ID': order.orderId,
        'Status': order.status,
        'From': order.fromEntityName,
        'To': order.toEntityName,
        'Type': order.type,
        'Total Amount (INR)': order.totalAmount,
        'Date': order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : '',
      });
      await exportPaginatedData(orderService.list, params, rowMapper, { fileName, sheetName: 'Orders' });
    } catch (fallbackErr: any) {
      Alert.alert('Export Error', fallbackErr.message || 'Failed to export orders report.');
    }
  } finally {
    isExportInProgress = false;
  }
}

/**
 * Helper to fetch all data for a paginated endpoint and export it as XLSX.
 */
export async function exportPaginatedData<T>(
  fetchFn: (params: any) => Promise<{ data: T[]; total?: number } | T[]>,
  baseParams: Record<string, any>,
  rowMapper: (item: T) => ExportRow,
  options: { fileName: string; sheetName?: string }
): Promise<void> {
  if (isExportInProgress) {
    Alert.alert('Export In Progress', 'Please wait for the current export to complete.');
    return;
  }
  isExportInProgress = true;
  const CHUNK_SIZE = 1000;
  let allData: T[] = [];
  let page = 1;

  try {
    while (true) {
      const params = { ...baseParams, page, limit: CHUNK_SIZE };
      const result = (await fetchFn(params)) as any;

      const dataArray = Array.isArray(result)
        ? result
        : result?.data ?? result?.entries ?? [];

      allData = allData.concat(dataArray);

      if (result && typeof result.total === 'number') {
        if (allData.length >= result.total || dataArray.length === 0) {
          break;
        }
      } else {
        if (dataArray.length < CHUNK_SIZE) {
          break;
        }
      }
      
      page++;
    }

    const rows = allData.map(rowMapper);
    await downloadXlsxReport(rows, options, true);
  } catch (err: any) {
    console.error('Export paginated data error:', err);
    Alert.alert('Export Error', err.message || 'Failed to export paginated data.');
  } finally {
    isExportInProgress = false;
  }
}

export async function downloadAdminPerformanceReport(params: {
  soEntityIds: string[];
  period: string;
  fromDate?: string;
  toDate?: string;
  state?: string;
  selectAll?: boolean;
}): Promise<void> {
  if (isExportInProgress) {
    Alert.alert('Export In Progress', 'Please wait for the current export to complete.');
    return;
  }
  isExportInProgress = true;

  const token = useAuthStore.getState().token;
  const baseUrl = apiClient.defaults.baseURL;

  const query = new URLSearchParams();
  query.set('period', params.period);
  query.set('selectAll', params.selectAll ? 'true' : 'false');
  if (params.soEntityIds.length > 0) {
    query.set('soEntityIds', params.soEntityIds.join(','));
  }
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  if (params.state && params.state !== 'ALL') {
    query.set('state', params.state);
  }

  const fileName = `performance-${params.state || 'all'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    if (Platform.OS === 'web') {
      const res = await apiClient.get('/retailer-visits/admin/export', {
        params: Object.fromEntries(query.entries()),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } else {
      const urlString = `${baseUrl}/retailer-visits/admin/export?${query.toString()}`;

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            // Retain full fileName with extension so Android creates a valid .xlsx file
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );

            // Download to temporary app cache first
            const tempFileUri = `${FileSystem.cacheDirectory}${fileName}`;
            const downloadResult = await FileSystem.downloadAsync(urlString, tempFileUri, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            // Read temporary file as base64 and write to SAF file
            const fileContent = await FileSystem.readAsStringAsync(downloadResult.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, fileContent, {
              encoding: FileSystem.EncodingType.Base64,
            });

            if (await Sharing.isAvailableAsync()) {
              Alert.alert('Export Successful', `Report saved successfully: ${fileName}`, [
                { text: 'OK' },
                {
                  text: 'Open / Share',
                  onPress: async () => {
                    await Sharing.shareAsync(tempFileUri, {
                      mimeType,
                      dialogTitle: 'Open Performance Report',
                      UTI: 'com.microsoft.excel.xlsx',
                    });
                  },
                },
              ]);
            } else {
              Alert.alert('Export Successful', `Report saved successfully to: ${fileName}`);
            }
          } else {
            await downloadAndShareFile(urlString, fileName, token);
          }
        } catch (safErr) {
          console.warn('SAF performance export failed, using sharing fallback:', safErr);
          await downloadAndShareFile(urlString, fileName, token);
        }
      } else {
        // iOS
        await downloadAndShareFile(urlString, fileName, token);
      }
    }
  } catch (err: any) {
    console.error('Performance export error:', err);
    Alert.alert('Export Error', err.message || 'Failed to export performance report.');
  } finally {
    isExportInProgress = false;
  }
}

