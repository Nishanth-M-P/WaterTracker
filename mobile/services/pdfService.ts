import { Platform } from 'react-native';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { CASH_PDF_BASE64 } from '../assets/templates/cashPdfBase64';
import { Delivery } from '../types/database';
import {
  getBillProductMapping,
  mapDeliveryToBillRows,
  BillProductMapping,
  BillMappingResult,
} from './billMappingService';
import { numberToIndianRupeesWords } from './numberToWords';
import {
  ConsolidatedReportData,
  CustomerStatementData,
  getTodayDate,
  getYesterdayDate,
  getDayBeforeYesterdayDate,
} from './reportingService';
import { formatCustomerName } from '../utils/formatters';

export interface GeneratedPdfResult {
  uri: string;
  filename: string;
  base64?: string;
  blobUrl?: string;
  html?: string;
}

/**
 * Generates the exact CASH / CREDIT Bill PDF by overlaying text onto the master CASH.pdf template.
 * Guarantees zero layout deviation from the original business bill.
 */
export async function generateIndividualBillPdf(
  delivery: Delivery,
  customMapping?: BillProductMapping
): Promise<GeneratedPdfResult> {
  const mapping = customMapping || (await getBillProductMapping());
  const mappingResult = mapDeliveryToBillRows(delivery, mapping);

  // 1. Load original CASH.pdf master template
  const pdfDoc = await PDFDocument.load(CASH_PDF_BASE64);
  const page = pdfDoc.getPages()[0];
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textColor = rgb(0.1, 0.1, 0.1); // Charcoal black

  // 2. Bill Number
  const billNo = delivery.bill_number || `WT-${delivery.id.toString().padStart(4, '0')}`;
  page.drawText(billNo, {
    x: 75,
    y: 652.06,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  // 3. Date (formatted as DD/MM/YYYY)
  const [y, m, d] = (delivery.delivery_date || '').split('-');
  const formattedDate = y && m && d ? `${d}/${m}/${y}` : delivery.delivery_date;
  page.drawText(formattedDate, {
    x: 460,
    y: 652.06,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  // 4. Customer Name & Address (M/s)
  const customerName = formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`);
  const customerLocation = delivery.delivery_location || delivery.customer_address || '';

  // Draw customer name on line 1
  page.drawText(customerName, {
    x: 65,
    y: 611.62,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  // Draw customer location on line 2 (dotted line) if available
  if (customerLocation) {
    const locSnippet = customerLocation.length > 70
      ? customerLocation.substring(0, 67) + '...'
      : customerLocation;
    page.drawText(locSnippet, {
      x: 35,
      y: 584.83,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });
  }

  // 5. Four Product Rows
  // Exact row baselines determined from master template
  const rowBaselines: Record<number, number> = {
    1: 485.95, // 20 Ltr. Can
    2: 459.07, // ½ Ltr. Package Water
    3: 432.17, // 1 Ltr. Packaged Water
    4: 405.29, // Bisleri Water
  };

  for (const row of mappingResult.rows) {
    const rowY = rowBaselines[row.slNo];
    if (!rowY) continue;

    if (row.quantity !== null && row.quantity > 0) {
      // Qty Column: width 280.01 to 350.23 (width ~70pt)
      const qtyStr = String(row.quantity);
      const qtyWidth = fontBold.widthOfTextAtSize(qtyStr, 11);
      const qtyX = 280.01 + (70.22 - qtyWidth) / 2; // centered
      page.drawText(qtyStr, {
        x: qtyX,
        y: rowY,
        size: 11,
        font: fontBold,
        color: textColor,
      });

      // Rate Column: width 350.23 to 448.30 (width ~98pt)
      if (row.rate !== null && row.rate > 0) {
        const rateStr = row.rate.toFixed(2);
        const rateWidth = fontRegular.widthOfTextAtSize(rateStr, 11);
        const rateX = 448.3 - rateWidth - 10; // right-aligned with 10pt padding
        page.drawText(rateStr, {
          x: rateX,
          y: rowY,
          size: 11,
          font: fontRegular,
          color: textColor,
        });
      }

      // Amount Column: width 448.30 to 566.40 (width ~118pt)
      if (row.amount !== null && row.amount > 0) {
        const amtStr = row.amount.toFixed(2);
        const amtWidth = fontBold.widthOfTextAtSize(amtStr, 11);
        const amtX = 566.4 - amtWidth - 15; // right-aligned with 15pt padding
        page.drawText(amtStr, {
          x: amtX,
          y: rowY,
          size: 11,
          font: fontBold,
          color: textColor,
        });
      }
    }
  }

  // 6. Total Row (Bordered row immediately ABOVE Rupees row)
  // Calculate final total automatically from saved delivery record (Sum of all product line amounts)
  const totalBillAmount = Math.round(
    mappingResult.rows.reduce(
      (sum, r) => sum + (r.amount !== null && r.amount > 0 ? r.amount : 0),
      0
    ) * 100
  ) / 100;

  const totalRowBottomY = 163.5;
  const totalRowTopY = 186.62;
  const totalRowBaselineY = 171.2;
  const borderColor = rgb(0.212, 0.373, 0.569); // Exact template navy border color
  const borderThickness = 0.5;

  // Bottom horizontal line of Total row (immediately above Rupees row)
  page.drawLine({
    start: { x: 28.68, y: totalRowBottomY },
    end: { x: 566.4, y: totalRowBottomY },
    thickness: borderThickness,
    color: borderColor,
  });

  // Top horizontal line (at y = 186.62)
  page.drawLine({
    start: { x: 28.68, y: totalRowTopY },
    end: { x: 566.4, y: totalRowTopY },
    thickness: borderThickness,
    color: borderColor,
  });

  // Vertical divider between Total label and Amount column (at x = 448.30)
  page.drawLine({
    start: { x: 448.3, y: totalRowBottomY },
    end: { x: 448.3, y: totalRowTopY },
    thickness: borderThickness,
    color: borderColor,
  });

  // Left and right outer borders of Total row
  page.drawLine({
    start: { x: 28.68, y: totalRowBottomY },
    end: { x: 28.68, y: totalRowTopY },
    thickness: borderThickness,
    color: borderColor,
  });
  page.drawLine({
    start: { x: 566.4, y: totalRowBottomY },
    end: { x: 566.4, y: totalRowTopY },
    thickness: borderThickness,
    color: borderColor,
  });

  // Total Label (positioned neatly within bill boundaries, right-aligned before 448.30)
  const totalLabel = 'Total';
  const totalLabelWidth = fontBold.widthOfTextAtSize(totalLabel, 11);
  const totalLabelX = 448.3 - totalLabelWidth - 15;
  page.drawText(totalLabel, {
    x: totalLabelX,
    y: totalRowBaselineY,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  // Total numeric amount (right-aligned in Amount column with 15pt padding)
  const totalAmtStr = totalBillAmount.toFixed(2);
  const totalAmtWidth = fontBold.widthOfTextAtSize(totalAmtStr, 11);
  const totalAmtX = 566.4 - totalAmtWidth - 15;
  page.drawText(totalAmtStr, {
    x: totalAmtX,
    y: totalRowBaselineY,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  // 7. Amount in Words
  // Starting after "Rupees" at x = 80, y = 149.78
  const words = numberToIndianRupeesWords(totalBillAmount);

  // Measure word length; if > 52 chars, split gracefully between lines 1 and 2
  if (words.length <= 50) {
    page.drawText(words, {
      x: 80,
      y: 149.78,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });
  } else {
    // Find convenient break point near middle
    const spaceIndex = words.lastIndexOf(' ', 48);
    const splitAt = spaceIndex > 20 ? spaceIndex : 45;
    const line1 = words.substring(0, splitAt);
    const line2 = words.substring(splitAt).trim();

    page.drawText(line1, {
      x: 80,
      y: 149.78,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });

    page.drawText(line2, {
      x: 35,
      y: 120.6,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });
  }

  // 8. Save output
  const pdfBytes = await pdfDoc.save();
  const filename = `WaterTrack_Bill_${billNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  return await saveOrPreparePdf(pdfBytes, filename);
}

/**
 * Filename resolver following Section 7 specification
 */
export function getConsolidatedReportFilename(
  preset: string | undefined,
  startDate: string,
  endDate: string,
  extension: 'pdf' | 'csv' = 'pdf'
): string {
  if (preset === 'today' || (startDate === getTodayDate() && endDate === getTodayDate())) {
    return `WaterTrack_Today_${startDate}.${extension}`;
  }
  if (preset === 'yesterday' || (startDate === getYesterdayDate() && endDate === getYesterdayDate())) {
    return `WaterTrack_Yesterday_${startDate}.${extension}`;
  }
  if (
    preset === 'day_before_yesterday' ||
    (startDate === getDayBeforeYesterdayDate() && endDate === getDayBeforeYesterdayDate())
  ) {
    return `WaterTrack_DayBeforeYesterday_${startDate}.${extension}`;
  }
  if (preset === 'this_week' || preset === 'weekly') {
    return `WaterTrack_Weekly_${startDate}.${extension}`;
  }
  if (preset === 'this_month' || preset === 'monthly') {
    return `WaterTrack_Monthly_${startDate.substring(0, 7)}.${extension}`;
  }
  if (startDate === endDate) {
    return `WaterTrack_Report_${startDate}.${extension}`;
  }
  return `WaterTrack_Report_${startDate}_to_${endDate}.${extension}`;
}

/**
 * Filename resolver for Customer Account Statements
 */
export function getCustomerStatementFilename(
  customerId: number,
  preset?: string,
  startDate?: string,
  endDate?: string,
  extension: 'pdf' | 'csv' = 'pdf'
): string {
  if (preset === 'all_time' || (!startDate && !endDate)) {
    return `WaterTrack_Customer_${customerId}_AllTime.${extension}`;
  }
  if (startDate && endDate) {
    if (startDate === endDate) {
      return `WaterTrack_Customer_${customerId}_${startDate}.${extension}`;
    }
    return `WaterTrack_Customer_${customerId}_${startDate}_to_${endDate}.${extension}`;
  }
  return `WaterTrack_Customer_${customerId}_Statement.${extension}`;
}

/**
 * Generates the official multi-customer Consolidated WATER DISTRIBUTION STATEMENT PDF.
 * Layout strictly matches Section 3:
 * Header -> Customer delivery table (Sl No, Date/Time, Hotel/Shop, Product, Volume, Qty, Rate, Amount)
 * -> Customer Subtotals -> Grand Total Summary -> Signatory
 */
export async function generateConsolidatedReportPdf(
  data: ConsolidatedReportData,
  preset?: string
): Promise<GeneratedPdfResult> {
  const documentTitle = 'CONSOLIDATED WATER DISTRIBUTION REPORT';
  const filename = getConsolidatedReportFilename(preset, data.startDate, data.endDate, 'pdf');

  // Active bottle size columns to display in matrix
  const displayBottleSizes = data.bottleSizes;

  // Build matrix delivery table rows (one delivery = one row)
  let tableRowsHtml = '';
  let slNo = 1;

  if (data.deliveries.length === 0) {
    const totalCols = 5 + displayBottleSizes.length;
    tableRowsHtml = `
      <tr>
        <td colspan="${totalCols}" style="text-align: center; padding: 24px; color: #64748b; font-style: italic; font-size: 11px;">
          No deliveries recorded for the selected period (${escapeHtml(data.periodLabel)}).
        </td>
      </tr>
    `;
  } else {
    for (const del of data.deliveries) {
      const isAlt = slNo % 2 === 0;
      const rowBg = isAlt ? '#f8fafc' : '#ffffff';
      const timePart = del.deliveredAt ? del.deliveredAt.split('T')[1]?.substring(0, 5) || '' : '';
      const dateDisplay = del.deliveryDate ? del.deliveryDate.split('-').reverse().join('/') : '';

      const productCells = displayBottleSizes
        .map((b) => {
          const qty = del.quantitiesByBottleId[b.id] || 0;
          if (qty > 0) {
            return `<td style="text-align: center; font-weight: 700; color: #0f172a; font-size: 9.5px; padding: 5px 3px;">${qty}</td>`;
          }
          return `<td style="text-align: center; color: #cbd5e1; font-size: 10px; padding: 5px 3px;">&mdash;</td>`;
        })
        .join('');

      tableRowsHtml += `
        <tr style="background-color: ${rowBg}; page-break-inside: avoid;">
          <td style="text-align: center; color: #64748b; font-size: 9px; padding: 5px 3px; border-bottom: 0.5px solid #e2e8f0;">${slNo++}</td>
          <td style="font-weight: 700; color: #0f2c59; font-size: 9px; white-space: nowrap; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
            ${escapeHtml(del.billNumber)}
            <div style="font-size: 7.5px; font-weight: 500; color: #64748b; margin-top: 1px;">${escapeHtml(dateDisplay)}${timePart ? ` ${timePart}` : ''}</div>
          </td>
          <td style="padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
            <div style="font-weight: 700; color: #0f172a; font-size: 9.5px; line-height: 1.2;">${escapeHtml(del.customerName)}</div>
            ${del.deliveryLocation ? `<div style="font-size: 8px; color: #475569; margin-top: 1px;">${escapeHtml(del.deliveryLocation)}</div>` : ''}
          </td>
          ${productCells}
          <td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 9.5px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">${del.totalBottles}</td>
          <td style="text-align: right; font-weight: 800; color: #0f2c59; font-size: 9.5px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0; white-space: nowrap;">₹${del.totalAmount.toFixed(2)}</td>
        </tr>
      `;
    }
  }

  // Column totals row
  const totalsProductCells = displayBottleSizes
    .map((b) => {
      const tot = data.productTotals[b.id]?.quantity || 0;
      return `<td style="text-align: center; font-weight: 800; color: #0f172a; font-size: 9.5px; padding: 6px 3px;">${tot > 0 ? tot : '&mdash;'}</td>`;
    })
    .join('');

  const totalsRowHtml = `
    <tr class="totals-row" style="background-color: #f1f5f9; border-top: 1.5px solid #0f2c59; border-bottom: 1.5px solid #0f2c59; page-break-inside: avoid;">
      <td colspan="3" style="text-align: right; font-weight: 800; padding: 6px 6px; color: #0f172a; font-size: 9.5px;">
        TOTALS (${data.totalDeliveries} Deliveries, ${data.uniqueCustomerCount} Customers)
      </td>
      ${totalsProductCells}
      <td style="text-align: right; font-weight: 900; color: #0f172a; font-size: 10px; padding: 6px 4px;">${data.totalBottles}</td>
      <td style="text-align: right; font-weight: 900; color: #0f2c59; font-size: 10px; padding: 6px 4px; white-space: nowrap;">₹${data.grandTotalAmount.toFixed(2)}</td>
    </tr>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>${escapeHtml(documentTitle)} - ${escapeHtml(data.periodLabel)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      background-color: #f1f5f9;
      margin: 0;
      padding: 16px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page-sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 22px 26px;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    @media print {
      body {
        background-color: transparent;
        padding: 0;
        margin: 0;
      }
      .page-sheet {
        max-width: 100%;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border: none;
        border-radius: 0;
      }
      .table-container {
        overflow: visible !important;
        border: none !important;
      }
      table {
        min-width: 100% !important;
      }
    }
    @media screen and (max-width: 680px) {
      body {
        padding: 4px 2px;
        background-color: #ffffff;
      }
      .page-sheet {
        padding: 10px 8px;
        box-shadow: none;
        border: none;
        border-radius: 0;
        width: 100%;
        max-width: 100%;
      }
      .biz-name {
        font-size: 15px !important;
      }
      .biz-desc {
        font-size: 8px !important;
        letter-spacing: 1px !important;
      }
      .biz-address, .biz-phone {
        font-size: 8px !important;
      }
      .report-title-bar {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 3px !important;
        padding: 6px 8px !important;
      }
      .report-title {
        font-size: 10px !important;
      }
      .report-meta {
        font-size: 8px !important;
        text-align: left !important;
      }
      .table-container {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin-bottom: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
      }
      table {
        min-width: 580px;
        margin-bottom: 0 !important;
      }
      th {
        font-size: 8px !important;
        padding: 5px 2px !important;
      }
      .summary-grid {
        flex-wrap: wrap !important;
        gap: 8px !important;
      }
      .summary-col {
        min-width: 45% !important;
      }
      .summary-label {
        font-size: 7.5px !important;
      }
      .summary-val {
        font-size: 11px !important;
      }
      .words-box {
        font-size: 8.5px !important;
      }
    }
    .header-box {
      text-align: center;
      border-bottom: 2px solid #0f2c59;
      padding-bottom: 5px;
      margin-bottom: 7px;
    }
    .biz-name {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f2c59;
      text-transform: uppercase;
      margin: 0 0 1px 0;
    }
    .biz-desc {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #475569;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .biz-address {
      font-size: 8.5px;
      color: #334155;
      margin: 0 0 2px 0;
    }
    .biz-phone {
      font-size: 9px;
      font-weight: 800;
      color: #0f2c59;
      margin: 0;
    }
    .report-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 7px;
      padding: 4px 8px;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
    }
    .report-title {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 0.3px;
      color: #0f2c59;
      text-transform: uppercase;
    }
    .report-meta {
      font-size: 8.5px;
      font-weight: 600;
      color: #475569;
      text-align: right;
    }
    .table-container {
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-bottom: 6px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      font-size: 8px;
      padding: 5px 3px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #0f2c59;
    }
    .summary-card {
      margin-top: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 8px 10px;
      background-color: #f8fafc;
      page-break-inside: avoid;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .summary-col {
      flex: 1;
    }
    .summary-label {
      font-size: 7.5px;
      text-transform: uppercase;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.3px;
      margin-bottom: 1px;
    }
    .summary-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0f172a;
    }
    .words-box {
      border-top: 1px solid #e2e8f0;
      margin-top: 5px;
      padding-top: 4px;
      font-size: 9px;
    }
    .words-label {
      font-weight: 800;
      color: #0f172a;
      margin-right: 4px;
    }
    .words-val {
      font-weight: 700;
      color: #0f2c59;
    }
    .signatory-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 14px;
      padding-top: 4px;
      page-break-inside: avoid;
    }
    .footer-note {
      font-size: 7.5px;
      color: #94a3b8;
      line-height: 1.3;
    }
    .signatory-box {
      width: 150px;
      text-align: center;
    }
    .signatory-line {
      border-top: 1.5px solid #0f172a;
      margin-bottom: 3px;
    }
    .signatory-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="page-sheet">
    <!-- Master Business Header -->
    <div class="header-box">
      <div class="biz-name">CHANDAN GOWDA. M. K</div>
      <div class="biz-desc">MINERAL WATER DEALERS</div>
      <div class="biz-address">#12, 2ND Cross, Janatha Colony, Mysore Road, Bengaluru- 560 026</div>
      <div class="biz-phone">Phone: 9110837787</div>
    </div>

    <!-- Title & Period Bar -->
    <div class="report-title-bar">
      <div class="report-title">${escapeHtml(documentTitle)}</div>
      <div class="report-meta">
        <strong>Period:</strong> ${escapeHtml(data.periodLabel)} &bull; <strong>Ref:</strong> ${escapeHtml(data.reportReference)}
      </div>
    </div>

    <!-- Matrix Delivery Table in Responsive Container -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 24px; text-align: center;">SL</th>
            <th style="width: 66px; text-align: left;">Bill No</th>
            <th style="text-align: left;">Customer / Location</th>
            ${displayBottleSizes.map((b) => `<th style="width: 44px; text-align: center;">${escapeHtml(b.name)}</th>`).join('')}
            <th style="width: 44px; text-align: right;">Total Qty</th>
            <th style="width: 64px; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>
    </div>

    <!-- Grand Total Summary Card -->
    <div class="summary-card">
      <div class="summary-grid">
        <div class="summary-col">
          <div class="summary-label">Customers Served</div>
          <div class="summary-val">${data.uniqueCustomerCount}</div>
        </div>
        <div class="summary-col">
          <div class="summary-label">Total Deliveries</div>
          <div class="summary-val">${data.totalDeliveries}</div>
        </div>
        <div class="summary-col">
          <div class="summary-label">Bottles Distributed</div>
          <div class="summary-val">${data.totalBottles}</div>
        </div>
        <div class="summary-col">
          <div class="summary-label">Water Volume</div>
          <div class="summary-val">${data.totalVolumeLitres.toFixed(1)} Litres</div>
        </div>
        <div class="summary-col" style="text-align: right;">
          <div class="summary-label">Grand Total Amount</div>
          <div class="summary-val" style="color: #0f2c59; font-size: 13px;">₹${data.grandTotalAmount.toFixed(2)}</div>
        </div>
      </div>

      <div class="words-box">
        <span class="words-label">Amount in Words:</span>
        <span class="words-val">${escapeHtml(data.grandTotalInWords)}</span>
      </div>
    </div>

    <!-- Authorised Signatory Footer -->
    <div class="signatory-row">
      <div class="footer-note">
        Report generated: ${escapeHtml(data.generatedAt)}<br />
        WaterTrack System Offline Accounting
      </div>
      <div class="signatory-box">
        <div class="signatory-line"></div>
        <div class="signatory-title">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  if (Platform.OS === 'web') {
    return {
      uri: 'data:text/html;charset=utf-8,' + encodeURIComponent(html),
      filename,
      html,
    };
  }

  const printFile = await Print.printToFileAsync({ html });
  return {
    uri: printFile.uri,
    filename,
    base64: printFile.base64,
    html,
  };
}

/**
 * Generates the official CUSTOMER DELIVERY STATEMENT A4 PDF.
 * Layout strictly matches Requirements 3, 4, 5:
 * Business header -> Statement title -> Customer & period metadata ->
 * Delivery table with product rows and delivery subtotals ->
 * Final customer totals summary (deliveries, bottles by size, volume, grand total, words) ->
 * Authorised signatory.
 */
export async function generateCustomerStatementPdf(
  data: CustomerStatementData
): Promise<GeneratedPdfResult> {
  const documentTitle = 'CUSTOMER DELIVERY STATEMENT';
  const filename = getCustomerStatementFilename(
    data.customer.id,
    data.preset,
    data.startDate,
    data.endDate,
    'pdf'
  );

  let tableRowsHtml = '';
  let slNo = 1;

  if (data.deliveries.length === 0) {
    tableRowsHtml = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 28px; color: #64748b; font-style: italic; font-size: 11px;">
          No deliveries recorded for ${escapeHtml(data.customer.name)} during the selected period (${escapeHtml(data.periodLabel)}).
        </td>
      </tr>
    `;
  } else {
    for (const del of data.deliveries) {
      const timePart = del.deliveredAt ? del.deliveredAt.split('T')[1]?.substring(0, 5) || '' : '';
      const dateDisplay = del.deliveryDate ? del.deliveryDate.split('-').reverse().join('/') : '';
      const dateWithTime = timePart ? `${dateDisplay} ${timePart}` : dateDisplay;

      if (del.items.length === 0) {
        tableRowsHtml += `
          <tr style="background-color: #ffffff; page-break-inside: avoid;">
            <td style="text-align: center; color: #64748b; font-size: 9px; padding: 5px 3px;">${slNo++}</td>
            <td style="font-weight: 600; white-space: nowrap; font-size: 8.5px; padding: 5px 4px;">${escapeHtml(dateWithTime)}</td>
            <td style="font-weight: 700; color: #0f2c59; white-space: nowrap; font-size: 9px; padding: 5px 4px;">${escapeHtml(del.billNumber)}</td>
            <td style="font-weight: 600; font-size: 9px; padding: 5px 4px;">Delivery</td>
            <td style="text-align: center; color: #64748b; font-size: 8.5px; padding: 5px 3px;">-</td>
            <td style="text-align: center; font-weight: 700; font-size: 9px; padding: 5px 4px;">${del.deliveryBottles}</td>
            <td style="text-align: right; font-size: 8.5px; padding: 5px 4px;">-</td>
            <td style="text-align: right; font-weight: 700; color: #0f2c59; font-size: 9px; padding: 5px 4px; white-space: nowrap;">₹${del.deliveryAmount.toFixed(2)}</td>
          </tr>
        `;
      } else {
        for (let i = 0; i < del.items.length; i++) {
          const item = del.items[i];
          const isFirstItemOfDelivery = i === 0;

          tableRowsHtml += `
            <tr style="background-color: #ffffff; page-break-inside: avoid;">
              <td style="text-align: center; color: #64748b; font-size: 9px; padding: 5px 3px; border-bottom: 0.5px solid #e2e8f0;">${slNo++}</td>
              <td style="font-weight: 600; white-space: nowrap; color: #1e293b; font-size: 8.5px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
                ${isFirstItemOfDelivery ? escapeHtml(dateWithTime) : `<span style="color: #94a3b8; font-size: 8px;">&quot;</span>`}
              </td>
              <td style="font-weight: 700; color: #0f2c59; white-space: nowrap; font-size: 9px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
                ${isFirstItemOfDelivery ? escapeHtml(del.billNumber) : `<span style="color: #94a3b8; font-size: 8px;">&quot;</span>`}
              </td>
              <td style="font-weight: 600; color: #0f172a; font-size: 9px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
                ${escapeHtml(item.productName)}
              </td>
              <td style="text-align: center; color: #475569; font-size: 8.5px; padding: 5px 3px; border-bottom: 0.5px solid #e2e8f0;">
                ${escapeHtml(item.volumeDisplay)}
              </td>
              <td style="text-align: center; font-weight: 700; color: #0f172a; font-size: 9.5px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0;">
                ${item.quantity}
              </td>
              <td style="text-align: right; color: #334155; font-size: 9px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0; white-space: nowrap;">
                ₹${item.unitPrice.toFixed(2)}
              </td>
              <td style="text-align: right; font-weight: 700; color: #0f2c59; font-size: 9.5px; padding: 5px 4px; border-bottom: 0.5px solid #e2e8f0; white-space: nowrap;">
                ₹${item.lineTotal.toFixed(2)}
              </td>
            </tr>
          `;
        }
      }

      // Delivery Subtotal Row after this delivery's lines
      tableRowsHtml += `
        <tr class="subtotal-row" style="background-color: #f8fafc; border-bottom: 1.5px solid #cbd5e1; page-break-inside: avoid;">
          <td colspan="5" style="text-align: right; font-weight: 700; color: #334155; font-size: 8.5px; padding: 5px 6px;">
            Delivery Subtotal (${escapeHtml(del.billNumber)} &bull; ${escapeHtml(dateDisplay)}):
          </td>
          <td style="text-align: center; font-weight: 800; color: #0f172a; font-size: 9.5px; padding: 5px 4px;">
            ${del.deliveryBottles}
          </td>
          <td style="text-align: right; color: #64748b; font-size: 8px; font-style: italic; padding: 5px 4px;">
            subtotal
          </td>
          <td style="text-align: right; font-weight: 800; color: #0f2c59; font-size: 10px; white-space: nowrap; padding: 5px 4px;">
            ₹${del.deliveryAmount.toFixed(2)}
          </td>
        </tr>
      `;
    }
  }

  // Bottle size breakdown HTML for summary card
  const bottleBreakdownHtml = data.bottleTotals
    .map(
      (b) =>
        `<div class="bottle-breakdown-item"><strong>${escapeHtml(b.name)}:</strong> ${b.quantity} bottles &bull; ₹${b.amount.toFixed(2)}</div>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>${escapeHtml(documentTitle)} - ${escapeHtml(data.customer.name)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      background-color: #f1f5f9;
      margin: 0;
      padding: 16px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page-sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 22px 26px;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    @media print {
      body {
        background-color: transparent;
        padding: 0;
        margin: 0;
      }
      .page-sheet {
        max-width: 100%;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border: none;
        border-radius: 0;
      }
      .table-container {
        overflow: visible !important;
        border: none !important;
      }
      table {
        min-width: 100% !important;
      }
    }
    @media screen and (max-width: 680px) {
      body {
        padding: 4px 2px;
        background-color: #ffffff;
      }
      .page-sheet {
        padding: 10px 8px;
        box-shadow: none;
        border: none;
        border-radius: 0;
        width: 100%;
        max-width: 100%;
      }
      .biz-name {
        font-size: 15px !important;
      }
      .biz-desc {
        font-size: 8px !important;
      }
      .customer-statement-meta-box {
        flex-direction: column !important;
        gap: 8px !important;
      }
      .doc-meta-col {
        text-align: left !important;
      }
      .table-container {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin-bottom: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
      }
      table {
        min-width: 600px;
        margin-bottom: 0 !important;
      }
      .summary-grid {
        flex-wrap: wrap !important;
        gap: 8px !important;
      }
      .summary-col {
        min-width: 45% !important;
      }
    }
    .header-box {
      text-align: center;
      border-bottom: 2px solid #0f2c59;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .biz-name {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f2c59;
      text-transform: uppercase;
      margin: 0 0 1px 0;
    }
    .biz-desc {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #475569;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .biz-address {
      font-size: 8.5px;
      color: #334155;
      margin: 0 0 2px 0;
    }
    .biz-phone {
      font-size: 9px;
      font-weight: 800;
      color: #0f2c59;
      margin: 0;
    }
    .statement-title-bar {
      text-align: center;
      background-color: #0f2c59;
      color: #ffffff;
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .statement-title {
      font-size: 11.5px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .customer-statement-meta-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .cust-info-col {
      flex: 1.2;
    }
    .cust-name {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .cust-meta {
      font-size: 8.5px;
      color: #475569;
      line-height: 1.35;
    }
    .doc-meta-col {
      flex: 0.9;
      text-align: right;
    }
    .doc-meta-line {
      font-size: 8.5px;
      color: #334155;
      margin-bottom: 2px;
    }
    .doc-meta-line strong {
      color: #0f2c59;
    }
    .table-container {
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-bottom: 8px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      font-size: 8px;
      padding: 6px 4px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #0f2c59;
    }
    td {
      font-size: 9px;
      padding: 5px 4px;
      border-bottom: 0.5px solid #e2e8f0;
    }
    .summary-card {
      margin-top: 8px;
      border: 1.5px solid #0f2c59;
      border-radius: 6px;
      padding: 10px 12px;
      background-color: #f8fafc;
      page-break-inside: avoid;
    }
    .summary-title {
      font-size: 10px;
      font-weight: 900;
      color: #0f2c59;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .summary-col {
      flex: 1;
    }
    .summary-label {
      font-size: 7.5px;
      text-transform: uppercase;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.3px;
      margin-bottom: 1px;
    }
    .summary-val {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
    }
    .bottle-breakdown-box {
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 5px 0;
      margin-bottom: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .bottle-breakdown-item {
      font-size: 8.5px;
      color: #334155;
    }
    .words-box {
      font-size: 9px;
      margin-top: 4px;
    }
    .words-label {
      font-weight: 800;
      color: #0f172a;
      margin-right: 4px;
    }
    .words-val {
      font-weight: 700;
      color: #0f2c59;
    }
    .signatory-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 16px;
      padding-top: 4px;
      page-break-inside: avoid;
    }
    .footer-note {
      font-size: 7.5px;
      color: #94a3b8;
      line-height: 1.3;
    }
    .signatory-box {
      width: 160px;
      text-align: center;
    }
    .signatory-line {
      border-top: 1.5px solid #0f172a;
      margin-bottom: 3px;
    }
    .signatory-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="page-sheet">
    <!-- Master Business Header -->
    <div class="header-box">
      <div class="biz-name">CHANDAN GOWDA. M. K</div>
      <div class="biz-desc">MINERAL WATER DEALERS</div>
      <div class="biz-address">#12, 2ND Cross, Janatha Colony, Mysore Road, Bengaluru- 560 026</div>
      <div class="biz-phone">Phone: 9110837787</div>
    </div>

    <!-- Statement Title Bar -->
    <div class="statement-title-bar">
      <div class="statement-title">${escapeHtml(documentTitle)}</div>
    </div>

    <!-- Customer & Statement Meta Box -->
    <div class="customer-statement-meta-box">
      <div class="cust-info-col">
        <div class="cust-name">M/s. ${escapeHtml(data.customer.name)}</div>
        <div class="cust-meta">
          <strong>Type:</strong> ${escapeHtml(data.customer.customerType)}<br />
          <strong>Address:</strong> ${escapeHtml(data.customer.address || 'Address not specified')}<br />
          ${data.customer.phone ? `<strong>Phone:</strong> ${escapeHtml(data.customer.phone)}` : ''}
        </div>
      </div>
      <div class="doc-meta-col">
        <div class="doc-meta-line"><strong>Statement Ref:</strong> ${escapeHtml(data.statementReference)}</div>
        <div class="doc-meta-line"><strong>Statement Period:</strong> ${escapeHtml(data.periodLabel)}</div>
        <div class="doc-meta-line"><strong>Statement Date:</strong> ${escapeHtml(data.generatedAt)}</div>
      </div>
    </div>

    <!-- Delivery Table in Responsive Container -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 26px; text-align: center;">SL</th>
            <th style="width: 80px; text-align: left;">Delivery Date</th>
            <th style="width: 65px; text-align: left;">Ref No</th>
            <th style="text-align: left;">Product</th>
            <th style="width: 44px; text-align: center;">Volume</th>
            <th style="width: 40px; text-align: center;">Qty</th>
            <th style="width: 58px; text-align: right;">Rate</th>
            <th style="width: 68px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <!-- Grand Total Row -->
          <tr style="background-color: #f1f5f9; border-top: 2px solid #0f2c59; border-bottom: 2px solid #0f2c59; page-break-inside: avoid;">
            <td colspan="5" style="text-align: right; font-weight: 800; font-size: 9.5px; padding: 7px 6px; color: #0f172a;">
              STATEMENT GRAND TOTAL (${data.totalDeliveries} Deliveries):
            </td>
            <td style="text-align: center; font-weight: 900; font-size: 10px; color: #0f172a; padding: 7px 4px;">
              ${data.totalBottles}
            </td>
            <td></td>
            <td style="text-align: right; font-weight: 900; font-size: 10.5px; color: #0f2c59; white-space: nowrap; padding: 7px 4px;">
              ₹${data.grandTotalAmount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Final Customer Totals Summary Card -->
    <div class="summary-card">
      <div class="summary-title">Customer Account Statement Summary</div>
      <div class="summary-grid">
        <div class="summary-col">
          <div class="summary-label">Deliveries Completed</div>
          <div class="summary-val">${data.totalDeliveries}</div>
        </div>
        <div class="summary-col">
          <div class="summary-label">Total Bottles</div>
          <div class="summary-val">${data.totalBottles}</div>
        </div>
        <div class="summary-col">
          <div class="summary-label">Water Volume</div>
          <div class="summary-val">${data.totalVolumeLitres.toFixed(1)} L</div>
        </div>
        <div class="summary-col" style="text-align: right;">
          <div class="summary-label">Grand Total Amount</div>
          <div class="summary-val" style="color: #0f2c59; font-size: 13.5px;">₹${data.grandTotalAmount.toFixed(2)}</div>
        </div>
      </div>

      ${data.bottleTotals.length > 0 ? `<div class="bottle-breakdown-box">${bottleBreakdownHtml}</div>` : ''}

      <div class="words-box">
        <span class="words-label">Amount in Words:</span>
        <span class="words-val">${escapeHtml(data.grandTotalInWords)}</span>
      </div>
    </div>

    <!-- Authorised Signatory Footer -->
    <div class="signatory-row">
      <div class="footer-note">
        Statement generated: ${escapeHtml(data.generatedAt)}<br />
        WaterTrack System &bull; Single-Customer Accounting Statement
      </div>
      <div class="signatory-box">
        <div class="signatory-line"></div>
        <div class="signatory-title">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  if (Platform.OS === 'web') {
    return {
      uri: 'data:text/html;charset=utf-8,' + encodeURIComponent(html),
      filename,
      html,
    };
  }

  const printFile = await Print.printToFileAsync({ html });
  return {
    uri: printFile.uri,
    filename,
    base64: printFile.base64,
    html,
  };
}

/**
 * Saves or prepares a generated Uint8Array PDF file for cross-platform preview,
 * printing, or sharing.
 */
async function saveOrPreparePdf(
  pdfBytes: Uint8Array,
  filename: string
): Promise<GeneratedPdfResult> {
  if (Platform.OS === 'web') {
    // Web: Convert Uint8Array to Blob URL
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    return {
      uri: blobUrl,
      filename,
      blobUrl,
    };
  }

  // Native (Android / iOS): Save to FileSystem documentDirectory
  const base64 = uint8ArrayToBase64(pdfBytes);
  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    uri: fileUri,
    filename,
    base64,
  };
}

/**
 * Native and Web Print handler for generated bills or reports
 */
export async function printPdfDocument(pdfResult: GeneratedPdfResult): Promise<void> {
  if (Platform.OS === 'web') {
    if (pdfResult.blobUrl) {
      let iframe = document.getElementById('watertrack-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'watertrack-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      iframe.src = pdfResult.blobUrl;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
          } catch {
            window.open(pdfResult.blobUrl, '_blank');
          }
        }, 150);
      };
      return;
    }
    if (pdfResult.uri.startsWith('data:text/html')) {
      let iframe = document.getElementById('watertrack-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'watertrack-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      const decodedHtml = decodeURIComponent(pdfResult.uri.replace('data:text/html;charset=utf-8,', ''));
      iframe.srcdoc = decodedHtml;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
          } catch {
            window.print();
          }
        }, 150);
      };
      return;
    }
  }

  await Print.printAsync({ uri: pdfResult.uri });
}

/**
 * Native and Web Share handler for generated bills or reports
 */
export async function sharePdfDocument(pdfResult: GeneratedPdfResult): Promise<void> {
  if (Platform.OS === 'web') {
    // If Web Share API is available and supports files
    if (pdfResult.blobUrl) {
      exportPdfDocument(pdfResult);
      return;
    }
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(pdfResult.uri, {
      mimeType: 'application/pdf',
      dialogTitle: pdfResult.filename,
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Fallback to print dialog if sharing is unavailable
    await printPdfDocument(pdfResult);
  }
}

/**
 * Native and Web Export (Download) handler for generated bills or reports
 */
export function exportPdfDocument(pdfResult: GeneratedPdfResult): void {
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    if (pdfResult.blobUrl) {
      link.href = pdfResult.blobUrl;
    } else if (pdfResult.uri.startsWith('data:text/html')) {
      const decodedHtml = decodeURIComponent(pdfResult.uri.replace('data:text/html;charset=utf-8,', ''));
      const blob = new Blob([decodedHtml], { type: 'text/html' });
      link.href = URL.createObjectURL(blob);
      link.download = pdfResult.filename.replace('.pdf', '.html');
      link.click();
      return;
    } else {
      link.href = pdfResult.uri;
    }
    link.download = pdfResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // On Native, sharing provides the "Save to Files" / "Download" system action
  sharePdfDocument(pdfResult);
}

/**
 * View PDF handler
 */
export function viewPdfDocument(pdfResult: GeneratedPdfResult): void {
  if (Platform.OS === 'web') {
    if (pdfResult.blobUrl) {
      const win = window.open(pdfResult.blobUrl, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = pdfResult.blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    }
    if (pdfResult.uri.startsWith('data:text/html')) {
      const decodedHtml = decodeURIComponent(pdfResult.uri.replace('data:text/html;charset=utf-8,', ''));
      const blob = new Blob([decodedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    }
  }

  // On native, share / open intent
  sharePdfDocument(pdfResult);
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
