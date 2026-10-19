import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ConsolidatedReportData } from './reportingService';
import { getConsolidatedReportFilename } from './pdfService';

function escapeCsvCell(val: any): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds standard RFC 4180 CSV content for consolidated delivery reports.
 */
export function generateConsolidatedReportCsvContent(data: ConsolidatedReportData): string {
  const rows: string[] = [];

  // Metadata headers
  rows.push(`"WATER DISTRIBUTION STATEMENT - CHANDAN GOWDA. M. K"`);
  rows.push(`"MINERAL WATER DEALERS - Phone: 9110837787"`);
  rows.push(`"Period: ${data.periodLabel}"`);
  rows.push(`"Report Ref: ${data.reportReference}"`);
  rows.push(`"Generated At: ${data.generatedAt}"`);
  rows.push('');

  // Table Column Headers
  const headers = [
    'Sl No',
    'Date',
    'Time',
    'Bill Ref',
    'Customer / Hotel Name',
    'Customer Type',
    'Address / Location',
    'Phone',
    'Product',
    'Volume',
    'Quantity',
    'Unit Rate (Rs)',
    'Line Total (Rs)',
    'Customer Subtotal (Rs)',
  ];
  rows.push(headers.map(escapeCsvCell).join(','));

  let slNo = 1;

  for (const group of data.customerGroups) {
    let customerLinesWritten = 0;
    const totalLinesInGroup = group.deliveries.reduce((sum, d) => sum + (d.items.length || 1), 0);

    for (const del of group.deliveries) {
      const timeStr = del.deliveredAt ? del.deliveredAt.split('T')[1]?.substring(0, 5) || '' : '';
      const items = del.items.length > 0 ? del.items : [];

      if (items.length === 0) {
        // Empty items delivery fallback
        customerLinesWritten++;
        const isLastInGroup = customerLinesWritten === totalLinesInGroup;
        rows.push(
          [
            slNo++,
            del.deliveryDate,
            timeStr,
            del.billNumber,
            group.customerName,
            group.customerType,
            del.deliveryLocation || group.address || '',
            group.phone || '',
            'N/A',
            '-',
            del.totalBottles,
            0,
            del.totalAmount,
            isLastInGroup ? group.subtotalAmount : '',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      } else {
        for (const item of items) {
          customerLinesWritten++;
          const isLastInGroup = customerLinesWritten === totalLinesInGroup;
          rows.push(
            [
              slNo++,
              del.deliveryDate,
              timeStr,
              del.billNumber,
              group.customerName,
              group.customerType,
              del.deliveryLocation || group.address || '',
              group.phone || '',
              item.productName,
              item.volumeDisplay,
              item.quantity,
              item.unitPrice.toFixed(2),
              item.lineTotal.toFixed(2),
              isLastInGroup ? group.subtotalAmount.toFixed(2) : '',
            ]
              .map(escapeCsvCell)
              .join(',')
          );
        }
      }
    }
  }

  // Summary Rows
  rows.push('');
  rows.push('"--- GRAND TOTAL SUMMARY ---"');
  rows.push(`"Total Customers Served",${data.uniqueCustomerCount}`);
  rows.push(`"Total Deliveries",${data.totalDeliveries}`);
  rows.push(`"Total Containers Distributed",${data.totalBottles}`);
  rows.push(`"Total Water Volume (Litres)",${data.totalVolumeLitres}`);
  rows.push(`"Grand Total Amount (Rs)",${data.grandTotalAmount.toFixed(2)}`);
  rows.push(`"Amount in Words","${data.grandTotalInWords}"`);

  return rows.join('\r\n');
}

/**
 * Exports CSV file across Web and Native platforms.
 */
export async function exportConsolidatedReportCsv(
  data: ConsolidatedReportData,
  preset?: string
): Promise<void> {
  const csvContent = generateConsolidatedReportCsvContent(data);
  const filename = getConsolidatedReportFilename(preset, data.startDate, data.endDate, 'csv');

  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Native (Android/iOS)
  const dir = `${FileSystem.cacheDirectory}reports/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const filePath = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}
