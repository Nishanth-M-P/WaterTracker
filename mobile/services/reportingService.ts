import { getDatabase } from '../database/database';
import { numberToIndianRupeesWords } from './numberToWords';
import {
  BottleSizeSummary,
  CustomerSummary,
  DailyDistribution,
  DashboardMetrics,
  Delivery,
  DeliveryItem,
  SummaryReport,
} from '../types/database';
import { formatCustomerName } from '../utils/formatters';

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayDate(): string {
  return formatLocalDate(new Date());
}

export function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

export function getDayBeforeYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return formatLocalDate(d);
}

export function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getWeekRangeForDate(
  baseDate: Date,
  weekStart: 'monday' | 'sunday' = 'monday'
): { start: string; end: string } {
  const day = baseDate.getDay();
  let diffToStart = 0;
  if (weekStart === 'monday') {
    diffToStart = day === 0 ? -6 : 1 - day;
  } else {
    diffToStart = -day;
  }
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() + diffToStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

export function getMonthRangeForYearMonth(year: number, monthIndex: number): { start: string; end: string } {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

export function getThisWeekRange(weekStart: 'monday' | 'sunday' = 'monday'): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday ...
  let diffToStart = 0;

  if (weekStart === 'monday') {
    diffToStart = day === 0 ? -6 : 1 - day;
  } else {
    diffToStart = -day;
  }

  const start = new Date(now);
  start.setDate(now.getDate() + diffToStart);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

export function getLastWeekRange(weekStart: 'monday' | 'sunday' = 'monday'): { start: string; end: string } {
  const thisWeek = getThisWeekRange(weekStart);
  const startD = parseLocalDate(thisWeek.start);
  startD.setDate(startD.getDate() - 7);

  const endD = parseLocalDate(thisWeek.end);
  endD.setDate(endD.getDate() - 7);

  return {
    start: formatLocalDate(startD),
    end: formatLocalDate(endD),
  };
}

export function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

export function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const db = getDatabase();
  const todayStr = getTodayDate();
  const weekRange = getThisWeekRange('monday');
  const monthRange = getThisMonthRange();

  // Today totals
  const todayRow = await db.getFirstAsync<{
    today_deliveries: number;
    today_bottles: number;
    today_volume_litres: number;
    today_amount: number;
    today_customers: number;
  }>(
    `SELECT
       COUNT(DISTINCT d.id) as today_deliveries,
       COALESCE(SUM(di.quantity), 0) as today_bottles,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as today_volume_litres,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0), 2) as today_amount,
       COUNT(DISTINCT d.customer_id) as today_customers
     FROM deliveries d
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date = ?`,
    [todayStr]
  );

  // Week bottles
  const weekRow = await db.getFirstAsync<{ week_bottles: number }>(
    `SELECT COALESCE(SUM(di.quantity), 0) as week_bottles
     FROM deliveries d
     JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?`,
    [weekRange.start, weekRange.end]
  );

  // Month bottles
  const monthRow = await db.getFirstAsync<{ month_bottles: number }>(
    `SELECT COALESCE(SUM(di.quantity), 0) as month_bottles
     FROM deliveries d
     JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?`,
    [monthRange.start, monthRange.end]
  );

  // Today bottle-size breakdown
  const todayBottleSizes = await db.getAllAsync<BottleSizeSummary>(
    `SELECT
       di.bottle_size_id,
       di.bottle_size_name_snapshot as bottle_size_name,
       COALESCE(di.volume_ml_snapshot, bs.volume_ml, 1000) as volume_ml,
       SUM(di.quantity) as total_quantity,
       ROUND(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, bs.volume_ml, 1000)) / 1000.0, 1) as total_volume_litres,
       SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)) as total_amount
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     LEFT JOIN bottle_sizes bs ON bs.id = di.bottle_size_id
     WHERE d.delivery_date = ?
     GROUP BY di.bottle_size_id, di.bottle_size_name_snapshot
     ORDER BY total_quantity DESC`,
    [todayStr]
  );

  // Recent 5 deliveries
  const recentDeliveries = await db.getAllAsync<Delivery>(
    `SELECT d.*, c.name as customer_name, c.customer_type, c.address as customer_address,
            COALESCE(SUM(di.quantity), 0) as total_bottles,
            ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
            COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_amount
     FROM deliveries d
     LEFT JOIN customers c ON c.id = d.customer_id
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     GROUP BY d.id
     ORDER BY d.delivery_date DESC, d.delivered_at DESC
     LIMIT 5`
  );

  for (const d of recentDeliveries) {
    d.customer_name = formatCustomerName(d.customer_name, `Customer #${d.customer_id}`);
    d.items = await db.getAllAsync<DeliveryItem>(
      'SELECT * FROM delivery_items WHERE delivery_id = ? ORDER BY id ASC',
      [d.id]
    );
  }

  // 7-day daily distribution (Monday through Sunday) for dashboard bar graph
  const weekStartD = parseLocalDate(weekRange.start);
  const weekDaysRaw = await db.getAllAsync<{
    date: string;
    total_bottles: number;
    delivery_count: number;
  }>(
    `SELECT
       d.delivery_date as date,
       COALESCE(SUM(di.quantity), 0) as total_bottles,
       COUNT(DISTINCT d.id) as delivery_count
     FROM deliveries d
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     GROUP BY d.delivery_date
     ORDER BY d.delivery_date ASC`,
    [weekRange.start, weekRange.end]
  );

  const weekMap = new Map(weekDaysRaw.map((r) => [r.date, r]));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekly_distribution: DailyDistribution[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(weekStartD);
    cur.setDate(weekStartD.getDate() + i);
    const dateStr = formatLocalDate(cur);
    const found = weekMap.get(dateStr);
    const dayLabel = `${dayNames[cur.getDay()]} ${cur.getDate()}`;
    weekly_distribution.push({
      date: dateStr,
      day_label: dayLabel,
      total_bottles: found ? found.total_bottles : 0,
      delivery_count: found ? found.delivery_count : 0,
    });
  }

  return {
    today_bottles: todayRow?.today_bottles ?? 0,
    today_deliveries: todayRow?.today_deliveries ?? 0,
    today_unique_customers: todayRow?.today_customers ?? 0,
    today_volume_litres: todayRow?.today_volume_litres ?? 0,
    today_amount: todayRow?.today_amount ?? 0,
    week_bottles: weekRow?.week_bottles ?? 0,
    month_bottles: monthRow?.month_bottles ?? 0,
    today_bottle_sizes: todayBottleSizes,
    recent_deliveries: recentDeliveries,
    weekly_distribution,
  };
}

export async function getSummaryReport(startDate: string, endDate: string): Promise<SummaryReport> {
  const db = getDatabase();

  if (endDate < startDate) {
    throw new Error('End date cannot be earlier than start date');
  }

  // Summary aggregation
  const summaryRow = await db.getFirstAsync<{
    total_deliveries: number;
    total_bottles: number;
    total_volume_litres: number;
    total_amount: number;
    unique_customers: number;
  }>(
    `SELECT
       COUNT(DISTINCT d.id) as total_deliveries,
       COALESCE(SUM(di.quantity), 0) as total_bottles,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0), 2) as total_amount,
       COUNT(DISTINCT d.customer_id) as unique_customers
     FROM deliveries d
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?`,
    [startDate, endDate]
  );

  const total_deliveries = summaryRow?.total_deliveries ?? 0;
  const total_bottles = summaryRow?.total_bottles ?? 0;
  const total_volume_litres = summaryRow?.total_volume_litres ?? 0;
  const total_amount = summaryRow?.total_amount ?? 0;
  const unique_customers = summaryRow?.unique_customers ?? 0;
  const avg_bottles_per_delivery = total_deliveries > 0
    ? Number((total_bottles / total_deliveries).toFixed(2))
    : 0.0;

  // Bottle size breakdown
  const bottle_size_breakdown = await db.getAllAsync<BottleSizeSummary>(
    `SELECT
       di.bottle_size_id,
       di.bottle_size_name_snapshot as bottle_size_name,
       COALESCE(di.volume_ml_snapshot, bs.volume_ml, 1000) as volume_ml,
       SUM(di.quantity) as total_quantity,
       ROUND(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, bs.volume_ml, 1000)) / 1000.0, 1) as total_volume_litres,
       SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)) as total_amount
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     LEFT JOIN bottle_sizes bs ON bs.id = di.bottle_size_id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     GROUP BY di.bottle_size_id, di.bottle_size_name_snapshot
     ORDER BY total_quantity DESC`,
    [startDate, endDate]
  );

  // Daily breakdown
  const daily_breakdown_raw = await db.getAllAsync<{
    date: string;
    total_bottles: number;
    total_volume_litres: number;
    total_amount: number;
    delivery_count: number;
  }>(
    `SELECT
       d.delivery_date as date,
       COALESCE(SUM(di.quantity), 0) as total_bottles,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0), 2) as total_amount,
       COUNT(DISTINCT d.id) as delivery_count
     FROM deliveries d
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     GROUP BY d.delivery_date
     ORDER BY d.delivery_date ASC`,
    [startDate, endDate]
  );

  const rawMap = new Map(daily_breakdown_raw.map((r) => [r.date, r]));
  const startD = parseLocalDate(startDate);
  const endD = parseLocalDate(endDate);
  const diffDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let daily_breakdown: DailyDistribution[] = [];

  if (diffDays >= 1 && diffDays <= 31) {
    // Fill in every single date in the range so the bar chart represents continuous days accurately
    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(startD);
      cur.setDate(startD.getDate() + i);
      const dateStr = formatLocalDate(cur);
      const found = rawMap.get(dateStr);
      const dayLabel = `${dayNames[cur.getDay()]} ${cur.getDate()}`;
      daily_breakdown.push({
        date: dateStr,
        day_label: dayLabel,
        total_bottles: found ? found.total_bottles : 0,
        total_volume_litres: found ? found.total_volume_litres : 0,
        total_amount: found ? found.total_amount : 0,
        delivery_count: found ? found.delivery_count : 0,
      });
    }
  } else {
    // For larger date ranges (>31 days), use non-zero activity days
    daily_breakdown = daily_breakdown_raw.map((item) => {
      const d = parseLocalDate(item.date);
      const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}`;
      return {
        date: item.date,
        day_label: dayLabel,
        total_bottles: item.total_bottles,
        total_volume_litres: item.total_volume_litres,
        total_amount: item.total_amount,
        delivery_count: item.delivery_count,
      };
    });
  }

  // Customer breakdown
  const customer_breakdown_raw = await db.getAllAsync<CustomerSummary>(
    `SELECT
       COALESCE(c.id, d.customer_id) as customer_id,
       c.name as customer_name,
       COALESCE(c.customer_type, 'Other') as customer_type,
       COUNT(DISTINCT d.id) as total_deliveries,
       COALESCE(SUM(di.quantity), 0) as total_bottles,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
       ROUND(COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0), 2) as total_amount
     FROM deliveries d
     LEFT JOIN customers c ON c.id = d.customer_id
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     GROUP BY d.customer_id
     ORDER BY total_bottles DESC, total_deliveries DESC`,
    [startDate, endDate]
  );

  const customer_breakdown: CustomerSummary[] = customer_breakdown_raw.map((c) => ({
    ...c,
    customer_name: formatCustomerName(c.customer_name, `Customer #${c.customer_id}`),
  }));

  return {
    start_date: startDate,
    end_date: endDate,
    total_bottles,
    total_deliveries,
    unique_customers,
    total_volume_litres,
    total_amount,
    avg_bottles_per_delivery,
    bottle_size_breakdown,
    daily_breakdown,
    customer_breakdown,
  };
}

export function generateReportCSV(report: SummaryReport): string {
  const lines: string[] = [];
  lines.push(`WaterTrack Distribution Report (${report.start_date} to ${report.end_date})`);
  lines.push(`Total Bottles,${report.total_bottles}`);
  lines.push(`Total Volume (Litres),${report.total_volume_litres || 0}`);
  lines.push(`Total Deliveries,${report.total_deliveries}`);
  lines.push(`Unique Customers,${report.unique_customers}`);
  lines.push(`Avg Bottles / Delivery,${report.avg_bottles_per_delivery}`);
  lines.push(`Total Delivery Value (Rs),${report.total_amount || 0}`);
  lines.push('');

  lines.push('--- BOTTLE SIZE BREAKDOWN ---');
  lines.push('Product,Quantity,Volume (L),Value (Rs)');
  for (const b of report.bottle_size_breakdown) {
    lines.push(`"${b.bottle_size_name}",${b.total_quantity},${b.total_volume_litres || 0},${b.total_amount || 0}`);
  }
  lines.push('');

  lines.push('--- CUSTOMER DISTRIBUTION ---');
  lines.push('Customer,Type,Deliveries,Total Bottles,Volume (L),Value (Rs)');
  for (const c of report.customer_breakdown) {
    lines.push(`"${c.customer_name}",${c.customer_type},${c.total_deliveries},${c.total_bottles},${c.total_volume_litres || 0},${c.total_amount || 0}`);
  }

  return lines.join('\n');
}

export function generateReportSummaryText(report: SummaryReport): string {
  let text = `📦 WaterTrack Distribution Summary\n`;
  text += `📅 Period: ${report.start_date} to ${report.end_date}\n`;
  text += `--------------------------------\n`;
  text += `• Total Bottles: ${report.total_bottles}\n`;
  text += `• Total Water Volume: ${report.total_volume_litres || 0} Litres\n`;
  text += `• Total Deliveries: ${report.total_deliveries}\n`;
  text += `• Unique Clients Served: ${report.unique_customers}\n`;
  text += `• Total Delivery Value: ₹${(report.total_amount || 0).toFixed(2)}\n\n`;

  if (report.bottle_size_breakdown.length > 0) {
    text += `Sizes Breakdown:\n`;
    for (const b of report.bottle_size_breakdown) {
      text += `  - ${b.bottle_size_name}: ${b.total_quantity} bottles (${b.total_volume_litres || 0} L)\n`;
    }
  }

  return text;
}

export interface ConsolidatedDeliveryItem {
  id: number;
  bottleSizeId: number;
  productName: string;
  volumeMl: number | null;
  volumeDisplay: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ConsolidatedDeliveryRow {
  deliveryId: number;
  billNumber: string;
  deliveryDate: string;
  deliveredAt: string;
  customerId: number;
  customerName: string;
  customerType: string;
  customerAddress: string | null;
  customerPhone: string | null;
  deliveryLocation: string;
  totalBottles: number;
  totalVolumeLitres: number;
  totalAmount: number;
  quantitiesByBottleId: Record<number, number>;
  amountsByBottleId: Record<number, number>;
  items: ConsolidatedDeliveryItem[];
}

export interface CustomerReportGroup {
  customerId: number;
  customerName: string;
  customerType: string;
  customerAddress: string | null;
  customerPhone: string | null;
  address: string | null;
  phone: string | null;
  deliveries: ConsolidatedDeliveryRow[];
  subtotalDeliveries: number;
  subtotalBottles: number;
  subtotalVolumeLitres: number;
  subtotalAmount: number;
  productQuantities: Record<number, { name: string; quantity: number }>;
}

export interface ConsolidatedReportData {
  startDate: string;
  endDate: string;
  periodLabel: string;
  generatedAt: string;
  reportReference: string;
  deliveries: ConsolidatedDeliveryRow[];
  customerGroups: CustomerReportGroup[];
  bottleSizes: { id: number; name: string; volumeMl: number | null }[];
  productTotals: Record<
    number,
    { name: string; volumeMl: number | null; quantity: number; amount: number; volumeLitres: number }
  >;
  totalDeliveries: number;
  uniqueCustomerCount: number;
  totalBottles: number;
  totalVolumeLitres: number;
  grandTotalAmount: number;
  grandTotalInWords: string;
}

export async function getConsolidatedDistributionData(
  startDate: string,
  endDate: string,
  preset?: string
): Promise<ConsolidatedReportData> {
  const db = getDatabase();
  const { numberToIndianRupeesWords } = await import('./numberToWords');

  if (endDate < startDate) {
    throw new Error('End date cannot be earlier than start date');
  }

  // 1. Fetch all deliveries in range with customer phone and address
  const rawDeliveries = await db.getAllAsync<{
    id: number;
    bill_number: string | null;
    delivery_date: string;
    delivered_at: string;
    customer_id: number;
    customer_name: string;
    customer_type: string;
    customer_address: string | null;
    customer_phone: string | null;
    delivery_location: string;
  }>(
    `SELECT d.id, d.bill_number, d.delivery_date, d.delivered_at,
            d.customer_id, c.name as customer_name, c.customer_type,
            c.address as customer_address, c.phone as customer_phone,
            d.delivery_location
     FROM deliveries d
     LEFT JOIN customers c ON c.id = d.customer_id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     ORDER BY c.name COLLATE NOCASE ASC, d.delivery_date ASC, d.delivered_at ASC, d.id ASC`,
    [startDate, endDate]
  );

  // 2. Fetch all line items in range
  const rawItems = await db.getAllAsync<{
    id: number;
    delivery_id: number;
    bottle_size_id: number;
    bottle_size_name_snapshot: string;
    volume_ml_snapshot: number | null;
    quantity: number;
    unit_price_snapshot: number | null;
    line_total: number | null;
  }>(
    `SELECT di.id, di.delivery_id, di.bottle_size_id, di.bottle_size_name_snapshot,
            di.volume_ml_snapshot, di.quantity, di.unit_price_snapshot, di.line_total
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     WHERE d.delivery_date >= ? AND d.delivery_date <= ?
     ORDER BY di.delivery_id ASC, di.id ASC`,
    [startDate, endDate]
  );

  // 3. Identify all distinct bottle sizes
  const bottleSizeMap = new Map<number, { id: number; name: string; volumeMl: number | null }>();
  const activeSizes = await db.getAllAsync<{ id: number; name: string; volume_ml: number | null }>(
    'SELECT id, name, volume_ml FROM bottle_sizes ORDER BY id ASC'
  );
  activeSizes.forEach((bs) => {
    bottleSizeMap.set(bs.id, { id: bs.id, name: bs.name, volumeMl: bs.volume_ml });
  });

  const itemsByDelivery = new Map<number, typeof rawItems>();
  for (const item of rawItems) {
    if (!itemsByDelivery.has(item.delivery_id)) {
      itemsByDelivery.set(item.delivery_id, []);
    }
    itemsByDelivery.get(item.delivery_id)!.push(item);

    if (!bottleSizeMap.has(item.bottle_size_id)) {
      bottleSizeMap.set(item.bottle_size_id, {
        id: item.bottle_size_id,
        name: item.bottle_size_name_snapshot,
        volumeMl: item.volume_ml_snapshot,
      });
    }
  }

  const productTotals: Record<
    number,
    { name: string; volumeMl: number | null; quantity: number; amount: number; volumeLitres: number }
  > = {};
  for (const [id, bs] of bottleSizeMap.entries()) {
    productTotals[id] = { name: bs.name, volumeMl: bs.volumeMl, quantity: 0, amount: 0, volumeLitres: 0 };
  }

  let grandTotalBottles = 0;
  let grandTotalVolumeLitres = 0;
  let grandTotalAmount = 0;
  const uniqueCustomers = new Set<number>();

  const deliveries: ConsolidatedDeliveryRow[] = [];
  const customerGroupMap = new Map<number, CustomerReportGroup>();

  for (const d of rawDeliveries) {
    uniqueCustomers.add(d.customer_id);
    const dItems = itemsByDelivery.get(d.id) || [];

    const quantitiesByBottleId: Record<number, number> = {};
    const amountsByBottleId: Record<number, number> = {};
    const itemsList: ConsolidatedDeliveryItem[] = [];

    let rowBottles = 0;
    let rowVolumeLitres = 0;
    let rowAmount = 0;

    for (const it of dItems) {
      const q = it.quantity || 0;
      const rate = it.unit_price_snapshot ?? 0;
      const amt = it.line_total ?? Math.round(q * rate * 100) / 100;
      const volMl = it.volume_ml_snapshot ?? null;
      const volL = volMl ? (q * volMl) / 1000.0 : 0;

      let volDisplay = '-';
      if (volMl != null && volMl > 0) {
        if (volMl >= 1000) {
          const l = volMl / 1000;
          volDisplay = Number.isInteger(l) ? `${l} L` : `${l.toFixed(1)} L`;
        } else {
          volDisplay = `${volMl} mL`;
        }
      }

      quantitiesByBottleId[it.bottle_size_id] = (quantitiesByBottleId[it.bottle_size_id] || 0) + q;
      amountsByBottleId[it.bottle_size_id] = (amountsByBottleId[it.bottle_size_id] || 0) + amt;

      itemsList.push({
        id: it.id,
        bottleSizeId: it.bottle_size_id,
        productName: it.bottle_size_name_snapshot,
        volumeMl: volMl,
        volumeDisplay: volDisplay,
        quantity: q,
        unitPrice: rate,
        lineTotal: amt,
      });

      rowBottles += q;
      rowVolumeLitres += volL;
      rowAmount += amt;

      if (!productTotals[it.bottle_size_id]) {
        productTotals[it.bottle_size_id] = {
          name: it.bottle_size_name_snapshot,
          volumeMl: volMl,
          quantity: 0,
          amount: 0,
          volumeLitres: 0,
        };
      }
      productTotals[it.bottle_size_id].quantity += q;
      productTotals[it.bottle_size_id].amount += amt;
      productTotals[it.bottle_size_id].volumeLitres += volL;
    }

    grandTotalBottles += rowBottles;
    grandTotalVolumeLitres += rowVolumeLitres;
    grandTotalAmount += rowAmount;

    const billNumber = d.bill_number || `WT-${d.id.toString().padStart(4, '0')}`;
    const sanitizedCustomerName = formatCustomerName(d.customer_name, `Customer #${d.customer_id}`);

    const deliveryRow: ConsolidatedDeliveryRow = {
      deliveryId: d.id,
      billNumber,
      deliveryDate: d.delivery_date,
      deliveredAt: d.delivered_at,
      customerId: d.customer_id,
      customerName: sanitizedCustomerName,
      customerType: d.customer_type || 'Customer',
      customerAddress: d.customer_address,
      customerPhone: d.customer_phone,
      deliveryLocation: d.delivery_location || '',
      totalBottles: rowBottles,
      totalVolumeLitres: Math.round(rowVolumeLitres * 10) / 10,
      totalAmount: Math.round(rowAmount * 100) / 100,
      quantitiesByBottleId,
      amountsByBottleId,
      items: itemsList,
    };

    deliveries.push(deliveryRow);

    // Group by customer
    if (!customerGroupMap.has(d.customer_id)) {
      customerGroupMap.set(d.customer_id, {
        customerId: d.customer_id,
        customerName: sanitizedCustomerName,
        customerType: d.customer_type || 'Customer',
        customerAddress: d.customer_address,
        customerPhone: d.customer_phone,
        address: d.customer_address,
        phone: d.customer_phone,
        deliveries: [],
        subtotalDeliveries: 0,
        subtotalBottles: 0,
        subtotalVolumeLitres: 0,
        subtotalAmount: 0,
        productQuantities: {},
      });
    }

    const grp = customerGroupMap.get(d.customer_id)!;
    grp.deliveries.push(deliveryRow);
    grp.subtotalDeliveries += 1;
    grp.subtotalBottles += rowBottles;
    grp.subtotalVolumeLitres = Math.round((grp.subtotalVolumeLitres + rowVolumeLitres) * 10) / 10;
    grp.subtotalAmount = Math.round((grp.subtotalAmount + rowAmount) * 100) / 100;

    for (const it of itemsList) {
      if (!grp.productQuantities[it.bottleSizeId]) {
        grp.productQuantities[it.bottleSizeId] = {
          name: it.productName,
          quantity: 0,
        };
      }
      grp.productQuantities[it.bottleSizeId].quantity += it.quantity;
    }
  }

  const roundedGrandAmount = Math.round(grandTotalAmount * 100) / 100;

  // Build report reference & timestamp
  const now = new Date();
  const refCode = `WDS-${startDate.replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  const generatedAt = now.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Build human readable period label
  let periodLabel = '';
  if (startDate === endDate) {
    if (startDate === getTodayDate()) {
      periodLabel = `Today (${formatDisplayDate(startDate)})`;
    } else if (startDate === getYesterdayDate()) {
      periodLabel = `Yesterday (${formatDisplayDate(startDate)})`;
    } else if (startDate === getDayBeforeYesterdayDate()) {
      periodLabel = `Day Before Yesterday (${formatDisplayDate(startDate)})`;
    } else {
      periodLabel = `Date: ${formatDisplayDate(startDate)}`;
    }
  } else if (preset === 'this_week' || preset === 'last_week' || preset === 'weekly') {
    periodLabel = `Week of ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
  } else if (preset === 'this_month' || preset === 'last_month' || preset === 'monthly') {
    const d = parseLocalDate(startDate);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    periodLabel = `Month of ${monthNames[d.getMonth()]} ${d.getFullYear()} (${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)})`;
  } else {
    periodLabel = `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
  }

  return {
    startDate,
    endDate,
    periodLabel,
    generatedAt,
    reportReference: refCode,
    deliveries,
    customerGroups: Array.from(customerGroupMap.values()),
    bottleSizes: Array.from(bottleSizeMap.values()),
    productTotals,
    totalDeliveries: deliveries.length,
    uniqueCustomerCount: uniqueCustomers.size,
    totalBottles: grandTotalBottles,
    totalVolumeLitres: Math.round(grandTotalVolumeLitres * 10) / 10,
    grandTotalAmount: roundedGrandAmount,
    grandTotalInWords: numberToIndianRupeesWords(roundedGrandAmount),
  };
}

export const getConsolidatedReportData = getConsolidatedDistributionData;

// ----------------------------------------------------
// Customer Account Statement Data & Reporting
// ----------------------------------------------------

export interface CustomerStatementDeliveryItem {
  id: number;
  bottleSizeId: number;
  productName: string;
  volumeDisplay: string;
  volumeLitres: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerStatementDelivery {
  deliveryId: number;
  deliveryDate: string;
  deliveredAt: string;
  billNumber: string;
  deliveryLocation: string;
  items: CustomerStatementDeliveryItem[];
  deliveryBottles: number;
  deliveryVolumeLitres: number;
  deliveryAmount: number;
}

export interface CustomerStatementBottleTotal {
  bottleSizeId: number;
  name: string;
  volumeDisplay: string;
  quantity: number;
  amount: number;
}

export interface CustomerStatementData {
  customer: {
    id: number;
    name: string;
    customerType: string;
    address: string | null;
    phone: string | null;
  };
  preset?: string;
  startDate?: string;
  endDate?: string;
  periodLabel: string;
  statementReference: string;
  generatedAt: string;
  deliveries: CustomerStatementDelivery[];
  bottleTotals: CustomerStatementBottleTotal[];
  totalDeliveries: number;
  totalBottles: number;
  totalVolumeLitres: number;
  grandTotalAmount: number;
  grandTotalInWords: string;
}

/**
 * Fetches all delivery records, line items, and product totals for a single customer
 * in the requested period (or all time), returning structured accounting data.
 */
export async function getCustomerStatementData(
  customerId: number,
  preset: string = 'all_time',
  customStartDate?: string,
  customEndDate?: string
): Promise<CustomerStatementData> {
  const db = getDatabase();

  // 1. Fetch customer details
  const customer = await db.getFirstAsync<{
    id: number;
    name: string;
    customer_type: string;
    address: string | null;
    phone: string | null;
  }>('SELECT id, name, customer_type, address, phone FROM customers WHERE id = ?', [customerId]);

  if (!customer) {
    throw new Error(`Customer #${customerId} not found`);
  }

  // 2. Resolve date range & period label
  let startDate = customStartDate;
  let endDate = customEndDate;
  let periodLabel = 'All Time';

  if (preset === 'today') {
    startDate = getTodayDate();
    endDate = startDate;
    periodLabel = `Today (${formatDisplayDate(startDate)})`;
  } else if (preset === 'yesterday') {
    startDate = getYesterdayDate();
    endDate = startDate;
    periodLabel = `Yesterday (${formatDisplayDate(startDate)})`;
  } else if (preset === 'day_before_yesterday') {
    startDate = getDayBeforeYesterdayDate();
    endDate = startDate;
    periodLabel = `Day Before Yesterday (${formatDisplayDate(startDate)})`;
  } else if (preset === 'this_week' || preset === 'weekly') {
    const w = getThisWeekRange('monday');
    startDate = w.start;
    endDate = w.end;
    periodLabel = `This Week (${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)})`;
  } else if (preset === 'this_month' || preset === 'monthly') {
    const m = getThisMonthRange();
    startDate = m.start;
    endDate = m.end;
    const d = parseLocalDate(startDate);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    periodLabel = `Month of ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  } else if (preset === 'custom' && startDate && endDate) {
    periodLabel = startDate === endDate ? formatDisplayDate(startDate) : `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
  } else {
    // all_time default
    periodLabel = 'All Time (Full Delivery History)';
  }

  // 3. Fetch customer deliveries in date range, chronological order
  const whereParts: string[] = ['d.customer_id = ?'];
  const params: any[] = [customerId];

  if (preset !== 'all_time' && startDate && endDate) {
    whereParts.push('d.delivery_date >= ? AND d.delivery_date <= ?');
    params.push(startDate, endDate);
  }

  const rawDeliveries = await db.getAllAsync<{
    id: number;
    bill_number: string | null;
    delivery_date: string;
    delivered_at: string;
    delivery_location: string;
  }>(
    `SELECT d.id, d.bill_number, d.delivery_date, d.delivered_at, d.delivery_location
     FROM deliveries d
     WHERE ${whereParts.join(' AND ')}
     ORDER BY d.delivery_date ASC, d.delivered_at ASC, d.id ASC`,
    params
  );

  // 4. Fetch line items for these deliveries
  const deliveryIds = rawDeliveries.map((d) => d.id);
  let rawItems: {
    id: number;
    delivery_id: number;
    bottle_size_id: number;
    bottle_size_name_snapshot: string;
    volume_ml_snapshot: number | null;
    quantity: number;
    unit_price_snapshot: number | null;
    line_total: number | null;
  }[] = [];

  if (deliveryIds.length > 0) {
    const placeholders = deliveryIds.map(() => '?').join(',');
    rawItems = await db.getAllAsync(
      `SELECT di.id, di.delivery_id, di.bottle_size_id, di.bottle_size_name_snapshot,
              di.volume_ml_snapshot, di.quantity, di.unit_price_snapshot, di.line_total
       FROM delivery_items di
       WHERE di.delivery_id IN (${placeholders})
       ORDER BY di.delivery_id ASC, di.id ASC`,
      deliveryIds
    );
  }

  const itemsByDelivery = new Map<number, typeof rawItems>();
  for (const it of rawItems) {
    if (!itemsByDelivery.has(it.delivery_id)) {
      itemsByDelivery.set(it.delivery_id, []);
    }
    itemsByDelivery.get(it.delivery_id)!.push(it);
  }

  // 5. Build structured delivery objects with line items and subtotals
  const deliveries: CustomerStatementDelivery[] = [];
  const bottleTotalsMap = new Map<number, { bottleSizeId: number; name: string; volumeDisplay: string; quantity: number; amount: number }>();

  let grandTotalBottles = 0;
  let grandTotalVolumeLitres = 0;
  let grandTotalAmountMinor = 0;

  for (const d of rawDeliveries) {
    const dItems = itemsByDelivery.get(d.id) || [];
    const itemsList: CustomerStatementDeliveryItem[] = [];

    let deliveryBottles = 0;
    let deliveryVolumeLitres = 0;
    let deliveryAmountMinor = 0;

    for (const it of dItems) {
      const q = it.quantity || 0;
      const rate = it.unit_price_snapshot ?? 0;
      const lineTotalMinor = Math.round(q * rate * 100);
      const lineTotal = lineTotalMinor / 100;
      const volMl = it.volume_ml_snapshot ?? null;
      const volL = volMl ? (q * volMl) / 1000.0 : 0;

      let volDisplay = '-';
      if (volMl != null && volMl > 0) {
        if (volMl >= 1000) {
          const l = volMl / 1000;
          volDisplay = Number.isInteger(l) ? `${l} L` : `${l.toFixed(1)} L`;
        } else {
          volDisplay = `${volMl} mL`;
        }
      }

      itemsList.push({
        id: it.id,
        bottleSizeId: it.bottle_size_id,
        productName: it.bottle_size_name_snapshot,
        volumeDisplay: volDisplay,
        volumeLitres: volL,
        quantity: q,
        unitPrice: rate,
        lineTotal,
      });

      deliveryBottles += q;
      deliveryVolumeLitres += volL;
      deliveryAmountMinor += lineTotalMinor;

      if (!bottleTotalsMap.has(it.bottle_size_id)) {
        bottleTotalsMap.set(it.bottle_size_id, {
          bottleSizeId: it.bottle_size_id,
          name: it.bottle_size_name_snapshot,
          volumeDisplay: volDisplay,
          quantity: 0,
          amount: 0,
        });
      }
      const bTot = bottleTotalsMap.get(it.bottle_size_id)!;
      bTot.quantity += q;
      bTot.amount = Math.round((bTot.amount + lineTotal) * 100) / 100;
    }

    grandTotalBottles += deliveryBottles;
    grandTotalVolumeLitres += deliveryVolumeLitres;
    grandTotalAmountMinor += deliveryAmountMinor;

    const billNumber = d.bill_number || `WT-${d.id.toString().padStart(4, '0')}`;

    deliveries.push({
      deliveryId: d.id,
      deliveryDate: d.delivery_date,
      deliveredAt: d.delivered_at,
      billNumber,
      deliveryLocation: d.delivery_location || '',
      items: itemsList,
      deliveryBottles,
      deliveryVolumeLitres: Math.round(deliveryVolumeLitres * 10) / 10,
      deliveryAmount: deliveryAmountMinor / 100,
    });
  }

  const grandTotalAmount = grandTotalAmountMinor / 100;
  const now = new Date();
  const statementReference = `CDS-${customerId}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const generatedAt = now.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return {
    customer: {
      id: customer.id,
      name: formatCustomerName(customer.name, `Customer #${customer.id}`),
      customerType: customer.customer_type,
      address: customer.address,
      phone: customer.phone,
    },
    preset,
    startDate,
    endDate,
    periodLabel,
    statementReference,
    generatedAt,
    deliveries,
    bottleTotals: Array.from(bottleTotalsMap.values()),
    totalDeliveries: deliveries.length,
    totalBottles: grandTotalBottles,
    totalVolumeLitres: Math.round(grandTotalVolumeLitres * 10) / 10,
    grandTotalAmount,
    grandTotalInWords: numberToIndianRupeesWords(grandTotalAmount),
  };
}

