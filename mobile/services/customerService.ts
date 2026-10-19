import { getDatabase } from '../database/database';
import { Customer, CustomerType, CustomerWithStats, Delivery, BottleSizeSummary, CustomerProductRate } from '../types/database';
import { formatCustomerName } from '../utils/formatters';

export async function getCustomers(options?: {
  query?: string;
  type?: CustomerType;
  sort?: 'alpha' | 'recent' | 'volume';
  includeArchived?: boolean;
  limit?: number;
}): Promise<CustomerWithStats[]> {
  const db = getDatabase();
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (!options?.includeArchived) {
    whereClauses.push('c.is_archived = 0');
  }

  if (options?.query && options.query.trim()) {
    whereClauses.push("(LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.phone, '')) LIKE ? OR LOWER(COALESCE(c.address, '')) LIKE ?)");
    const q = `%${options.query.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }

  if (options?.type) {
    whereClauses.push('c.customer_type = ?');
    params.push(options.type);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  let orderSql = 'ORDER BY c.name COLLATE NOCASE ASC';
  if (options?.sort === 'recent') {
    orderSql = 'ORDER BY last_delivery_date DESC NULLS LAST, c.name COLLATE NOCASE ASC';
  } else if (options?.sort === 'volume') {
    orderSql = 'ORDER BY total_bottles DESC, c.name COLLATE NOCASE ASC';
  }

  const limitSql = options?.limit ? `LIMIT ${Number(options.limit)}` : '';

  const sql = `
    SELECT
      c.*,
      COUNT(DISTINCT d.id) as total_deliveries,
      COALESCE(SUM(di.quantity), 0) as total_bottles,
      ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
      COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_delivery_value,
      MAX(d.delivery_date) as last_delivery_date
    FROM customers c
    LEFT JOIN deliveries d ON d.customer_id = c.id
    LEFT JOIN delivery_items di ON di.delivery_id = d.id
    ${whereSql}
    GROUP BY c.id
    ${orderSql}
    ${limitSql}
  `;

  const customers = await db.getAllAsync<CustomerWithStats>(sql, params);
  for (const c of customers) {
    c.name = formatCustomerName(c.name);
  }
  return customers;
}

export async function searchActiveCustomers(
  query: string,
  limit: number = 30
): Promise<CustomerWithStats[]> {
  return await getCustomers({
    query,
    includeArchived: false,
    sort: query.trim() ? 'alpha' : 'recent',
    limit,
  });
}

export async function getCustomerById(id: number): Promise<CustomerWithStats | null> {
  const db = getDatabase();
  const sql = `
    SELECT
      c.*,
      COUNT(DISTINCT d.id) as total_deliveries,
      COALESCE(SUM(di.quantity), 0) as total_bottles,
      ROUND(COALESCE(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, 1000)), 0) / 1000.0, 1) as total_volume_litres,
      COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_delivery_value,
      MAX(d.delivery_date) as last_delivery_date
    FROM customers c
    LEFT JOIN deliveries d ON d.customer_id = c.id
    LEFT JOIN delivery_items di ON di.delivery_id = d.id
    WHERE c.id = ?
    GROUP BY c.id
  `;
  const customer = await db.getFirstAsync<CustomerWithStats>(sql, [id]);
  if (customer) {
    customer.name = formatCustomerName(customer.name);
  }
  return customer;
}

export async function checkDuplicateCustomer(
  name: string,
  phone?: string | null,
  excludeId?: number
): Promise<{ similarName?: Customer; matchingPhone?: Customer }> {
  const db = getDatabase();
  const trimmedName = name.trim();
  const cleanPhone = phone?.trim();

  let similarName: Customer | undefined;
  let matchingPhone: Customer | undefined;

  // Exact or close name check
  let nameSql = 'SELECT * FROM customers WHERE LOWER(TRIM(name)) = LOWER(?)';
  const nameParams: any[] = [trimmedName];
  if (excludeId) {
    nameSql += ' AND id != ?';
    nameParams.push(excludeId);
  }
  const nameMatch = await db.getFirstAsync<Customer>(nameSql, nameParams);
  if (nameMatch) {
    similarName = nameMatch;
  }

  // Phone match check if provided
  if (cleanPhone && cleanPhone.length >= 7) {
    let phoneSql = 'SELECT * FROM customers WHERE phone = ?';
    const phoneParams: any[] = [cleanPhone];
    if (excludeId) {
      phoneSql += ' AND id != ?';
      phoneParams.push(excludeId);
    }
    const phoneMatch = await db.getFirstAsync<Customer>(phoneSql, phoneParams);
    if (phoneMatch) {
      matchingPhone = phoneMatch;
    }
  }

  return { similarName, matchingPhone };
}

export async function createCustomer(data: {
  name: string;
  customer_type: CustomerType;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  client_submission_id?: string | null;
}): Promise<Customer> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanName = (data.name || '').trim();
  if (!cleanName || ['none', 'null', 'undefined', 'nan'].includes(cleanName.toLowerCase())) {
    throw new Error('Please enter a valid customer or business name.');
  }

  // Idempotency check: if client_submission_id was provided and already exists, return that customer
  if (data.client_submission_id) {
    const existing = await db.getFirstAsync<Customer>(
      'SELECT * FROM customers WHERE client_submission_id = ?',
      [data.client_submission_id]
    );
    if (existing) {
      return existing;
    }
  }

  try {
    const res = await db.runAsync(
      `INSERT INTO customers (client_submission_id, name, customer_type, phone, address, notes, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        data.client_submission_id || null,
        cleanName,
        data.customer_type,
        data.phone?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null,
        now,
        now,
      ]
    );

    const inserted = await db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', [res.lastInsertRowId]);
    if (!inserted) {
      throw new Error('Failed to retrieve newly created customer');
    }
    return inserted;
  } catch (err: any) {
    // If unique constraint on client_submission_id fired due to race condition, return existing
    if (data.client_submission_id && err.message?.includes('client_submission_id')) {
      const existing = await db.getFirstAsync<Customer>(
        'SELECT * FROM customers WHERE client_submission_id = ?',
        [data.client_submission_id]
      );
      if (existing) return existing;
    }
    throw err;
  }
}

export async function updateCustomer(
  id: number,
  data: {
    name?: string;
    customer_type?: CustomerType;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    is_archived?: number;
  }
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (data.name !== undefined) {
    sets.push('name = ?');
    params.push(data.name.trim());
  }
  if (data.customer_type !== undefined) {
    sets.push('customer_type = ?');
    params.push(data.customer_type);
  }
  if (data.phone !== undefined) {
    sets.push('phone = ?');
    params.push(data.phone ? data.phone.trim() : null);
  }
  if (data.address !== undefined) {
    sets.push('address = ?');
    params.push(data.address ? data.address.trim() : null);
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?');
    params.push(data.notes ? data.notes.trim() : null);
  }
  if (data.is_archived !== undefined) {
    sets.push('is_archived = ?');
    params.push(data.is_archived);
  }

  params.push(id);
  await db.runAsync(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function archiveCustomer(id: number): Promise<void> {
  await updateCustomer(id, { is_archived: 1 });
}

export async function unarchiveCustomer(id: number): Promise<void> {
  await updateCustomer(id, { is_archived: 0 });
}

export async function deleteCustomerSafe(
  id: number
): Promise<{ deleted: boolean; archivedInstead?: boolean; reason?: string }> {
  const db = getDatabase();
  const deliveryCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM deliveries WHERE customer_id = ?',
    [id]
  );

  if (deliveryCount && deliveryCount.count > 0) {
    // Deliveries exist: Safe strategy per PRD -> archive customer to preserve delivery history
    await archiveCustomer(id);
    return {
      deleted: false,
      archivedInstead: true,
      reason: `Customer has ${deliveryCount.count} recorded deliveries. Safely archived to preserve historical delivery records.`,
    };
  }

  // No deliveries: Safe to permanently delete
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
  return { deleted: true };
}

export async function getCustomerDeliveries(
  customerId: number,
  startDate?: string,
  endDate?: string
): Promise<Delivery[]> {
  const db = getDatabase();
  const whereParts: string[] = ['d.customer_id = ?'];
  const params: any[] = [customerId];

  if (startDate && endDate) {
    whereParts.push('d.delivery_date >= ? AND d.delivery_date <= ?');
    params.push(startDate, endDate);
  } else if (startDate) {
    whereParts.push('d.delivery_date >= ?');
    params.push(startDate);
  }

  const deliveries = await db.getAllAsync<Delivery>(
    `SELECT d.*, c.name as customer_name, c.customer_type,
            COALESCE(SUM(di.quantity), 0) as total_bottles,
            COALESCE(SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)), 0) as total_amount
     FROM deliveries d
     JOIN customers c ON c.id = d.customer_id
     LEFT JOIN delivery_items di ON di.delivery_id = d.id
     WHERE ${whereParts.join(' AND ')}
     GROUP BY d.id
     ORDER BY d.delivery_date DESC, d.delivered_at DESC, d.id DESC`,
    params
  );

  for (const d of deliveries) {
    d.items = await db.getAllAsync(
      `SELECT * FROM delivery_items WHERE delivery_id = ? ORDER BY id ASC`,
      [d.id]
    );
  }

  return deliveries;
}

export async function getCustomerBottleTotals(
  customerId: number,
  startDate?: string,
  endDate?: string
): Promise<BottleSizeSummary[]> {
  const db = getDatabase();
  const whereParts: string[] = ['d.customer_id = ?'];
  const params: any[] = [customerId];

  if (startDate && endDate) {
    whereParts.push('d.delivery_date >= ? AND d.delivery_date <= ?');
    params.push(startDate, endDate);
  } else if (startDate) {
    whereParts.push('d.delivery_date >= ?');
    params.push(startDate);
  }

  return await db.getAllAsync<BottleSizeSummary>(
    `SELECT
       di.bottle_size_id,
       di.bottle_size_name_snapshot as bottle_size_name,
       COALESCE(di.volume_ml_snapshot, bs.volume_ml) as volume_ml,
       SUM(di.quantity) as total_quantity,
       ROUND(SUM(di.quantity * COALESCE(di.volume_ml_snapshot, bs.volume_ml, 1000)) / 1000.0, 1) as total_volume_litres,
       SUM(di.quantity * COALESCE(di.unit_price_snapshot, 0)) as total_amount
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     LEFT JOIN bottle_sizes bs ON bs.id = di.bottle_size_id
     WHERE ${whereParts.join(' AND ')}
     GROUP BY di.bottle_size_id, di.bottle_size_name_snapshot
     ORDER BY total_quantity DESC`,
    params
  );
}

// ----------------------------------------------------
// Customer-Specific Product Rates Management
// ----------------------------------------------------

export async function getCustomerProductRates(customerId: number): Promise<CustomerProductRate[]> {
  const db = getDatabase();
  return await db.getAllAsync<CustomerProductRate>(
    `SELECT * FROM customer_product_rates WHERE customer_id = ? ORDER BY id ASC`,
    [customerId]
  );
}

export async function getCustomerRateForBottle(
  customerId: number,
  bottleSizeId: number
): Promise<number | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ rate_rupees: number }>(
    `SELECT rate_rupees FROM customer_product_rates WHERE customer_id = ? AND bottle_size_id = ?`,
    [customerId, bottleSizeId]
  );
  return row ? row.rate_rupees : null;
}

export async function setCustomerProductRate(
  customerId: number,
  bottleSizeId: number,
  rateRupees: number
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const minorUnits = Math.round(rateRupees * 100);

  await db.runAsync(
    `INSERT INTO customer_product_rates (customer_id, bottle_size_id, unit_price_minor_units, rate_rupees, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(customer_id, bottle_size_id) DO UPDATE SET
       unit_price_minor_units = excluded.unit_price_minor_units,
       rate_rupees = excluded.rate_rupees,
       updated_at = excluded.updated_at`,
    [customerId, bottleSizeId, minorUnits, rateRupees, now, now]
  );
}

export async function deleteCustomerProductRate(
  customerId: number,
  bottleSizeId: number
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `DELETE FROM customer_product_rates WHERE customer_id = ? AND bottle_size_id = ?`,
    [customerId, bottleSizeId]
  );
}
