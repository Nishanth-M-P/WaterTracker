import { getSetting, setSetting } from './settingsService';
import { getBottleSizes } from './bottleSizeService';
import { BottleSize, Delivery, DeliveryItem } from '../types/database';

export type BillRowSlot = 'row_1_20l' | 'row_2_half_l' | 'row_3_1l' | 'row_4_bisleri';

export interface BillRowDefinition {
  slot: BillRowSlot;
  slNo: number;
  label: string;
  defaultVolumeMl?: number;
}

export const BILL_ROW_DEFINITIONS: BillRowDefinition[] = [
  { slot: 'row_1_20l', slNo: 1, label: '20 Ltr. Can', defaultVolumeMl: 20000 },
  { slot: 'row_2_half_l', slNo: 2, label: '½ Ltr. Package Water', defaultVolumeMl: 500 },
  { slot: 'row_3_1l', slNo: 3, label: '1 Ltr. Packaged Water', defaultVolumeMl: 1000 },
  { slot: 'row_4_bisleri', slNo: 4, label: 'Bisleri Water' },
];

export const SETTING_BILL_MAPPING_KEY = 'bill_product_mapping';

export type BillProductMapping = Record<BillRowSlot, number | null>;

/**
 * Retrieves the current mapping from settings, or automatically resolves it
 * against active bottle sizes by standard volume/naming rules.
 */
export async function getBillProductMapping(): Promise<BillProductMapping> {
  const raw = await getSetting(SETTING_BILL_MAPPING_KEY, '');
  let savedMapping: Partial<BillProductMapping> = {};

  if (raw) {
    try {
      savedMapping = JSON.parse(raw);
    } catch {
      savedMapping = {};
    }
  }

  const allSizes = await getBottleSizes(false);

  const resolveSlot = (slot: BillRowSlot): number | null => {
    // If explicitly configured in settings and the bottle size exists, use it
    if (savedMapping[slot] !== undefined && savedMapping[slot] !== null) {
      const match = allSizes.find((b) => b.id === savedMapping[slot]);
      if (match) return match.id;
    }

    // Default resolution rules based on volume and product naming
    switch (slot) {
      case 'row_1_20l': {
        const found = allSizes.find(
          (b) =>
            b.volume_ml === 20000 ||
            /20\s*l/i.test(b.name) ||
            /can/i.test(b.name)
        );
        return found ? found.id : null;
      }
      case 'row_2_half_l': {
        const found = allSizes.find(
          (b) =>
            b.volume_ml === 500 ||
            /500\s*ml/i.test(b.name) ||
            /half/i.test(b.name) ||
            /½/i.test(b.name)
        );
        return found ? found.id : null;
      }
      case 'row_3_1l': {
        const found = allSizes.find(
          (b) =>
            (b.volume_ml === 1000 || /1\s*l\b/i.test(b.name) || /1\s*ltr/i.test(b.name)) &&
            !/bisleri/i.test(b.name)
        );
        return found ? found.id : null;
      }
      case 'row_4_bisleri': {
        const found = allSizes.find((b) => /bisleri/i.test(b.name));
        return found ? found.id : null;
      }
      default:
        return null;
    }
  };

  return {
    row_1_20l: resolveSlot('row_1_20l'),
    row_2_half_l: resolveSlot('row_2_half_l'),
    row_3_1l: resolveSlot('row_3_1l'),
    row_4_bisleri: resolveSlot('row_4_bisleri'),
  };
}

export async function saveBillProductMapping(mapping: BillProductMapping): Promise<void> {
  await setSetting(SETTING_BILL_MAPPING_KEY, JSON.stringify(mapping));
}

export interface BillRowItemData {
  slot: BillRowSlot;
  slNo: number;
  particulars: string;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  matchedItems: DeliveryItem[];
}

export interface BillMappingResult {
  rows: BillRowItemData[];
  unmappedItems: DeliveryItem[];
  totalMappedAmount: number;
  totalDeliveryAmount: number;
  canGenerateExactBill: boolean;
}

/**
 * Maps a saved delivery to the exact 4 CASH/CREDIT bill rows.
 * Preserves historical unit rates and line totals stored in delivery_items.
 */
export function mapDeliveryToBillRows(
  delivery: Delivery,
  mapping: BillProductMapping
): BillMappingResult {
  const items = delivery.items || [];
  const mappedItemIds = new Set<number>();

  const rows: BillRowItemData[] = BILL_ROW_DEFINITIONS.map((def) => {
    const targetBottleSizeId = mapping[def.slot];
    const matching = items.filter((item) => {
      if (targetBottleSizeId) {
        return item.bottle_size_id === targetBottleSizeId;
      }
      // Fallback matching if mapping slot wasn't configured
      switch (def.slot) {
        case 'row_1_20l':
          return (
            item.volume_ml_snapshot === 20000 ||
            /20\s*l/i.test(item.bottle_size_name_snapshot) ||
            /can/i.test(item.bottle_size_name_snapshot)
          );
        case 'row_2_half_l':
          return (
            item.volume_ml_snapshot === 500 ||
            /500\s*ml/i.test(item.bottle_size_name_snapshot) ||
            /half/i.test(item.bottle_size_name_snapshot) ||
            /½/i.test(item.bottle_size_name_snapshot)
          );
        case 'row_3_1l':
          return (
            (item.volume_ml_snapshot === 1000 ||
              /1\s*l\b/i.test(item.bottle_size_name_snapshot) ||
              /1\s*ltr/i.test(item.bottle_size_name_snapshot)) &&
            !/bisleri/i.test(item.bottle_size_name_snapshot)
          );
        case 'row_4_bisleri':
          return /bisleri/i.test(item.bottle_size_name_snapshot);
        default:
          return false;
      }
    });

    matching.forEach((it) => mappedItemIds.add(it.id));

    if (matching.length === 0) {
      return {
        slot: def.slot,
        slNo: def.slNo,
        particulars: def.label,
        quantity: null,
        rate: null,
        amount: null,
        matchedItems: [],
      };
    }

    const totalQty = matching.reduce((sum, it) => sum + it.quantity, 0);
    // Weighted rate or first item unit price
    const totalAmount = matching.reduce(
      (sum, it) => sum + (it.line_total ?? it.quantity * (it.unit_price_snapshot ?? 0)),
      0
    );
    const avgRate = totalQty > 0 ? totalAmount / totalQty : matching[0].unit_price_snapshot ?? 0;

    return {
      slot: def.slot,
      slNo: def.slNo,
      particulars: def.label,
      quantity: totalQty > 0 ? totalQty : null,
      rate: totalQty > 0 ? Math.round(avgRate * 100) / 100 : null,
      amount: totalQty > 0 ? Math.round(totalAmount * 100) / 100 : null,
      matchedItems: matching,
    };
  });

  const unmappedItems = items.filter((it) => !mappedItemIds.has(it.id) && it.quantity > 0);

  const totalMappedAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalDeliveryAmount =
    delivery.total_amount ?? items.reduce((s, it) => s + (it.line_total ?? 0), 0);

  return {
    rows,
    unmappedItems,
    totalMappedAmount: Math.round(totalMappedAmount * 100) / 100,
    totalDeliveryAmount: Math.round(totalDeliveryAmount * 100) / 100,
    canGenerateExactBill: unmappedItems.length === 0,
  };
}
