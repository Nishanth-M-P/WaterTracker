import { getDatabase } from '../database/database';
import { CustomerType, Delivery, DeliveryInput, DeliveryItem } from '../types/database';
import { formatCustomerName } from '../utils/formatters';

export async function createDelivery(input: DeliveryInput): Promise<Delivery> {
  const db = getDatabase();

  // Validate quantities
  const validItems = input.items.filter((item) => item.quantity > 0);
  if (validItems.length === 0) {
    throw new Error('At least one bottle quantity must be greater than zero');
  }

  for (const item of input.items) {
    if (item.quantity < 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Bottle quantities must be non-negative whole numbers');
    }
  }

  // Idempotency check: if submission_key already exists, return the existing delivery
  if (input.submission_key) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM deliveries WHERE submission_key = ?',
      [input.submission_key]
    );
    if (existing) {
      const existingDelivery = await getDeliveryById(existing.id);
      if (existingDelivery) {
        return existingDelivery;
      }
    }
  }

  const now = new Date().toISOString();

  // Calculate totals
  const totalBottles = validItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalVolumeMl = validItems.reduce(
    (sum, item) => sum + item.quantity * (item.volume_ml_snapshot ?? 1000),
    0
  );
  const totalAmount = validItems.reduce(
    (sum, item) => sum + item.quantity * (item.unit_price_snapshot ?? 0),
    0
  );
  const totalAmountMinorUnits = Math.round(totalAmount * 100);

  let createdDeliveryId = 0;

  try {
    await db.withTransactionAsync(async () => {
      // Determine initial bill number if supplied
      const initialBillNumber = input.bill_number?.trim() || null;

      // Insert delivery record
      const deliveryRes = await db.runAsync(
        `INSERT INTO deliveries (
           bill_number, submission_key, customer_id, delivery_date, delivered_at, delivery_location,
           notes, total_bottles, total_volume_ml, total_amount, total_amount_minor_units,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initialBillNumber,
          input.submission_key || null,
          input.customer_id,
          input.delivery_date,
          input.delivered_at,
          (input.delivery_location || '').trim() || 'Store Location',
          input.notes?.trim() || null,
          totalBottles,
          totalVolumeMl,
          totalAmount,
          totalAmountMinorUnits,
          now,
          now,
        ]
      );

      createdDeliveryId = deliveryRes.lastInsertRowId;

      // If no bill number was provided, generate a permanent sequential one based on delivery id
      if (!initialBillNumber) {
        const generatedBillNo = `WT-${createdDeliveryId.toString().padStart(4, '0')}`;
        await db.runAsync(
          'UPDATE deliveries SET bill_number = ? WHERE id = ?',
          [generatedBillNo, createdDeliveryId]
        );
      }

      // Insert line items with snapshots and totals
      for (const item of validItems) {
        const lineTotal = item.quantity * (item.unit_price_snapshot ?? 0);
        const lineTotalMinorUnits = Math.round(lineTotal * 100);
        const volMl = item.volume_ml_snapshot ?? 1000;
        const volUnit = item.volume_unit_snapshot || 'L';

        await db.runAsync(
          `INSERT INTO delivery_items (
             delivery_id, bottle_size_id, bottle_size_name_snapshot,
             volume_ml_snapshot, volume_unit_snapshot, quantity,
             unit_price_snapshot, line_total, line_total_minor_units, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            createdDeliveryId,
            item.bottle_size_id,
            item.bottle_size_name_snapshot,
            volMl,
            volUnit,
            item.quantity,
            item.unit_price_snapshot ?? null,
            lineTotal,
            lineTotalMinorUnits,
            now,
          ]
        );
      }
    });
  } catch (err: any) {
    // If unique constraint on submission_key failed due to race condition, retrieve and return existing delivery
    if (input.submission_key && err.message?.includes('submission_key')) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM deliveries WHERE submission_key = ?',
        [input.submission_key]
      );
      if (existing) {
        const existingDelivery = await getDeliveryById(existing.id);
        if (existingDelivery) return existingDelivery;
      }
    }
    throw err;
  }

  const delivery = await getDeliveryById(createdDeliveryId);
  if (!delivery) {
    throw new Error('Failed to retrieve saved delivery');
  }
  return delivery;
}

export async function updateDelivery(id: number, input: DeliveryInput): Promise<Delivery> {
  const db = getDatabase();

  const validItems = input.items.filter((item) => item.quantity > 0);
  if (validItems.length === 0) {
    throw new Error('At least one bottle quantity must be greater than zero');
  }

  for (const item of input.items) {
    if (item.quantity < 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Bottle quantities must be non-negative whole numbers');
    }
  }

  const now = new Date().toISOString();

  // Calculate totals
  const totalBottles = validItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalVolumeMl = validItems.reduce(
    (sum, item) => sum + item.quantity * (item.volume_ml_snapshot ?? 1000),
    0
  );
  const totalAmount = validItems.reduce(
    (sum, item) => sum + item.quantity * (item.unit_price_snapshot ?? 0),
    0
  );
  const totalAmountMinorUnits = Math.round(totalAmount * 100);

  await db.withTransactionAsync(async () => {
    // Update delivery record
    await db.runAsync(
      `UPDATE deliveries
       SET customer_id = ?, delivery_date = ?, delivered_at = ?, delivery_location = ?,
           notes = ?, total_bottles = ?, total_volume_ml = ?, total_amount = ?,
           total_amount_minor_units = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.customer_id,
        input.delivery_date,
        input.delivered_at,
        (input.delivery_location || '').trim() || 'Store Location',
        input.notes?.trim() || null,
        totalBottles,
        totalVolumeMl,
        totalAmount,
        totalAmountMinorUnits,
        now,
        id,
      ]
    );

    // Delete existing line items
    await db.runAsync('DELETE FROM delivery_items WHERE delivery_id = ?', [id]);

    // Insert new line items
    for (const item of validItems) {
      const lineTotal = item.quantity * (item.unit_price_snapshot ?? 0);
      const lineTotalMinorUnits = Math.round(lineTotal * 100);
      const volMl = item.volume_ml_snapshot ?? 1000;
      const volUnit = item.volume_unit_snapshot || 'L';

      await db.runAsync(
        `INSERT INTO delivery_items (
           delivery_id, bottle_size_id, bottle_size_name_snapshot,
           volume_ml_snapshot, volume_unit_snapshot, quantity,
           unit_price_snapshot, line_total, line_total_minor_units, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.bottle_size_id,
          item.bottle_size_name_snapshot,
          volMl,
          volUnit,
          item.quantity,
          item.unit_price_snapshot ?? null,
          lineTotal,
          lineTotalMinorUnits,
          now,
        ]
      );
    }
  });

  const updated = await getDeliveryById(id);
  if (!updated) {
    throw new Error('Failed to retrieve updated delivery');
  }
  return updated;
}

export async function deleteDelivery(id: number): Promise<void> {
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM delivery_items WHERE delivery_id = ?', [id]);
    await db.runAsync('DELETE FROM deliveries WHERE id = ?', [id]);
  });
}

export async function getDeliveryById(id: number): Promise<Delivery | null> {
  const db = getDatabase();
  const delivery = await db.getFirstAsync<Delivery>(
    `SELECT d.*, c.name as customer_name, c.customer_type, c.address as customer_address,
            COALESCE(SUM(di.quantity), 0) as total_bottles,
            ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
            COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_amount
     FROM deliveries d
     LEFT JOIN customers c ON c.id = d.customer_id
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE d.id = ?
     GROUP BY d.id`,
    [id]
  );

  if (!delivery) return null;

  delivery.customer_name = formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`);

  if (!delivery.bill_number) {
    const assigned = `WT-${delivery.id.toString().padStart(4, '0')}`;
    delivery.bill_number = assigned;
    try {
      await db.runAsync('UPDATE deliveries SET bill_number = ? WHERE id = ?', [assigned, id]);
    } catch {
      // ignore
    }
  }

  delivery.items = await db.getAllAsync<DeliveryItem>(
    `SELECT * FROM delivery_items WHERE delivery_id = ? ORDER BY id ASC`,
    [id]
  );

  return delivery;
}

export async function getDeliveries(options?: {
  startDate?: string;
  endDate?: string;
  customerQuery?: string;
  customerType?: CustomerType;
  sort?: 'newest' | 'oldest';
  limit?: number;
}): Promise<Delivery[]> {
  const db = getDatabase();
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (options?.startDate) {
    whereClauses.push('d.delivery_date >= ?');
    params.push(options.startDate);
  }
  if (options?.endDate) {
    whereClauses.push('d.delivery_date <= ?');
    params.push(options.endDate);
  }
  if (options?.customerQuery && options.customerQuery.trim()) {
    whereClauses.push('(c.name LIKE ? OR d.delivery_location LIKE ?)');
    const q = `%${options.customerQuery.trim()}%`;
    params.push(q, q);
  }
  if (options?.customerType) {
    whereClauses.push('c.customer_type = ?');
    params.push(options.customerType);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderSql = options?.sort === 'oldest'
    ? 'ORDER BY d.delivery_date ASC, d.delivered_at ASC'
    : 'ORDER BY d.delivery_date DESC, d.delivered_at DESC';
  const limitSql = options?.limit ? `LIMIT ${options.limit}` : '';

  const sql = `
    SELECT d.*, c.name as customer_name, c.customer_type, c.address as customer_address,
           COALESCE(SUM(di.quantity), 0) as total_bottles,
           ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
           COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_amount
    FROM deliveries d
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN delivery_items di ON di.delivery_id = d.id
    ${whereSql}
    GROUP BY d.id
    ${orderSql}
    ${limitSql}
  `;

  const deliveries = await db.getAllAsync<Delivery>(sql, params);

  // Hydrate items for each delivery
  for (const d of deliveries) {
    d.customer_name = formatCustomerName(d.customer_name, `Customer #${d.customer_id}`);
    d.items = await db.getAllAsync<DeliveryItem>(
      'SELECT * FROM delivery_items WHERE delivery_id = ? ORDER BY id ASC',
      [d.id]
    );
  }

  return deliveries;
}
