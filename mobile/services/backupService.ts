import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../database/database';
import { BackupData, BottleSize, Customer, Delivery, DeliveryItem } from '../types/database';
import { CURRENT_SCHEMA_VERSION } from '../database/schema';

export async function exportBackup(): Promise<{ fileUri: string; filename: string }> {
  const db = getDatabase();

  const customers = await db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY id ASC');
  const bottleSizes = await db.getAllAsync<BottleSize>('SELECT * FROM bottle_sizes ORDER BY id ASC');
  const deliveries = await db.getAllAsync<Delivery>('SELECT * FROM deliveries ORDER BY id ASC');
  const deliveryItems = await db.getAllAsync<DeliveryItem>('SELECT * FROM delivery_items ORDER BY id ASC');
  const settingsRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');

  const settingsMap: Record<string, string> = {};
  for (const s of settingsRows) {
    settingsMap[s.key] = s.value;
  }

  // Group line items by delivery_id
  const itemsByDelivery: Record<number, DeliveryItem[]> = {};
  for (const item of deliveryItems) {
    if (!itemsByDelivery[item.delivery_id]) {
      itemsByDelivery[item.delivery_id] = [];
    }
    itemsByDelivery[item.delivery_id].push(item);
  }

  const deliveriesWithItems = deliveries.map((d) => ({
    ...d,
    items: itemsByDelivery[d.id] || [],
  }));

  const backupData: BackupData = {
    metadata: {
      app_name: 'WaterTrack',
      version: '1.0.0',
      schema_version: CURRENT_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
    },
    customers,
    bottle_sizes: bottleSizes,
    deliveries: deliveriesWithItems,
    settings: settingsMap,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `watertrack_backup_${dateTag}.json`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { fileUri: url, filename };
    }
    return { fileUri: '', filename };
  }

  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export WaterTrack Backup',
      UTI: 'public.json',
    });
  }

  return { fileUri, filename };
}

export function validateBackupContent(rawJson: string): BackupData {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new Error('Invalid JSON format in backup file');
  }

  if (!parsed.metadata || parsed.metadata.app_name !== 'WaterTrack') {
    throw new Error('This file is not a valid WaterTrack backup');
  }

  if (typeof parsed.metadata.schema_version !== 'number' || parsed.metadata.schema_version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Incompatible backup schema version (${parsed.metadata?.schema_version})`);
  }

  if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.deliveries) || !Array.isArray(parsed.bottle_sizes)) {
    throw new Error('Missing core business tables in backup payload');
  }

  return parsed as BackupData;
}

export async function restoreBackup(backup: BackupData): Promise<{
  customersRestored: number;
  deliveriesRestored: number;
  bottleSizesRestored: number;
}> {
  const db = getDatabase();

  let customersRestored = 0;
  let deliveriesRestored = 0;
  let bottleSizesRestored = 0;

  await db.withTransactionAsync(async () => {
    // Clear existing data cleanly in correct foreign key order
    await db.runAsync('DELETE FROM delivery_items');
    await db.runAsync('DELETE FROM deliveries');
    await db.runAsync('DELETE FROM customers');
    await db.runAsync('DELETE FROM bottle_sizes');

    // Restore bottle sizes
    for (const b of backup.bottle_sizes) {
      await db.runAsync(
        `INSERT INTO bottle_sizes (id, name, volume_ml, is_active, default_unit_price, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.name, b.volume_ml, b.is_active, b.default_unit_price, b.created_at, b.updated_at]
      );
      bottleSizesRestored++;
    }

    // Restore customers
    for (const c of backup.customers) {
      await db.runAsync(
        `INSERT INTO customers (id, name, customer_type, phone, address, notes, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.customer_type, c.phone, c.address, c.notes, c.is_archived, c.created_at, c.updated_at]
      );
      customersRestored++;
    }

    // Restore deliveries and items
    for (const d of backup.deliveries) {
      await db.runAsync(
        `INSERT INTO deliveries (id, customer_id, delivery_date, delivered_at, delivery_location, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.customer_id, d.delivery_date, d.delivered_at, d.delivery_location, d.notes, d.created_at, d.updated_at]
      );
      deliveriesRestored++;

      if (d.items && Array.isArray(d.items)) {
        for (const item of d.items) {
          await db.runAsync(
            `INSERT INTO delivery_items (id, delivery_id, bottle_size_id, bottle_size_name_snapshot, quantity, unit_price_snapshot, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              d.id,
              item.bottle_size_id,
              item.bottle_size_name_snapshot,
              item.quantity,
              item.unit_price_snapshot,
              item.created_at,
            ]
          );
        }
      }
    }

    // Restore settings
    if (backup.settings) {
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(backup.settings)) {
        await db.runAsync(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, value, now]
        );
      }
    }
  });

  return { customersRestored, deliveriesRestored, bottleSizesRestored };
}
