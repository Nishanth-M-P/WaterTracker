export type CustomerType = 'Hotel' | 'Shop' | 'Office' | 'Other';

export interface Customer {
  id: number;
  client_submission_id?: string | null;
  name: string;
  customer_type: CustomerType;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_archived: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface CustomerWithStats extends Customer {
  total_deliveries: number;
  total_bottles: number;
  total_volume_litres?: number;
  total_delivery_value?: number;
  last_delivery_date: string | null;
}

export interface BottleSize {
  id: number;
  name: string;
  volume_ml: number | null;
  volume_unit?: string; // 'L' or 'mL'
  description?: string | null;
  is_active: number; // 0 or 1
  default_unit_price: number | null;
  standard_price_paise?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProductRate {
  id: number;
  customer_id: number;
  bottle_size_id: number;
  unit_price_minor_units: number;
  rate_rupees: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItem {
  id: number;
  delivery_id: number;
  bottle_size_id: number;
  bottle_size_name_snapshot: string;
  volume_ml_snapshot?: number | null;
  volume_unit_snapshot?: string | null;
  quantity: number;
  unit_price_snapshot: number | null;
  line_total?: number | null;
  line_total_minor_units?: number | null;
  created_at: string;
}

export interface DeliveryItemInput {
  bottle_size_id: number;
  bottle_size_name_snapshot: string;
  volume_ml_snapshot?: number | null;
  volume_unit_snapshot?: string | null;
  quantity: number;
  unit_price_snapshot?: number | null;
  line_total?: number | null;
}

export interface Delivery {
  id: number;
  bill_number?: string | null;
  submission_key?: string | null;
  customer_id: number;
  customer_name?: string;
  customer_type?: CustomerType;
  customer_address?: string | null;
  delivery_date: string; // 'YYYY-MM-DD'
  delivered_at: string; // ISO8601
  delivery_location: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: DeliveryItem[];
  total_bottles?: number;
  total_volume_ml?: number;
  total_volume_litres?: number;
  total_amount?: number;
  total_amount_minor_units?: number;
}

export interface DeliveryInput {
  bill_number?: string | null;
  submission_key?: string;
  customer_id: number;
  delivery_date: string; // YYYY-MM-DD
  delivered_at: string; // ISO8601
  delivery_location: string;
  notes?: string | null;
  items: DeliveryItemInput[];
}

export interface BottleSizeSummary {
  bottle_size_id: number;
  bottle_size_name: string;
  volume_ml?: number | null;
  total_quantity: number;
  total_volume_litres?: number;
  total_amount: number;
}

export interface CustomerSummary {
  customer_id: number;
  customer_name: string;
  customer_type: CustomerType;
  total_deliveries: number;
  total_bottles: number;
  total_amount?: number;
  total_volume_litres?: number;
}

export interface DailyDistribution {
  date: string; // YYYY-MM-DD
  day_label: string; // e.g. "Mon 14"
  total_bottles: number;
  total_volume_litres?: number;
  total_amount?: number;
  delivery_count: number;
}

export interface SummaryReport {
  start_date: string;
  end_date: string;
  total_bottles: number;
  total_deliveries: number;
  unique_customers: number;
  total_volume_litres?: number;
  total_amount?: number;
  avg_bottles_per_delivery: number;
  bottle_size_breakdown: BottleSizeSummary[];
  daily_breakdown: DailyDistribution[];
  customer_breakdown: CustomerSummary[];
}

export interface DashboardMetrics {
  today_bottles: number;
  today_deliveries: number;
  today_unique_customers: number;
  today_volume_litres?: number;
  today_amount?: number;
  week_bottles: number;
  month_bottles: number;
  today_bottle_sizes: BottleSizeSummary[];
  recent_deliveries: Delivery[];
  weekly_distribution?: DailyDistribution[];
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface BackupData {
  metadata: {
    app_name: string;
    version: string;
    schema_version: number;
    exported_at: string;
  };
  customers: Customer[];
  bottle_sizes: BottleSize[];
  deliveries: Array<Delivery & { items: DeliveryItem[] }>;
  settings: Record<string, string>;
}
