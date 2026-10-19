import { getDatabase } from '../database/database';
import { BottleSize } from '../types/database';

export async function getBottleSizes(activeOnly: boolean = false): Promise<BottleSize[]> {
  const db = getDatabase();
  const sql = activeOnly
    ? 'SELECT * FROM bottle_sizes WHERE is_active = 1 ORDER BY volume_ml DESC, id ASC'
    : 'SELECT * FROM bottle_sizes ORDER BY is_active DESC, volume_ml DESC, id ASC';
  return await db.getAllAsync<BottleSize>(sql);
}

export async function getBottleSizeById(id: number): Promise<BottleSize | null> {
  const db = getDatabase();
  return await db.getFirstAsync<BottleSize>('SELECT * FROM bottle_sizes WHERE id = ?', [id]);
}

export async function createBottleSize(data: {
  name: string;
  volume_ml?: number | null;
  volume_unit?: string;
  description?: string | null;
  default_unit_price?: number | null;
}): Promise<BottleSize> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanName = data.name.trim();
  const paise = data.default_unit_price !== undefined && data.default_unit_price !== null
    ? Math.round(data.default_unit_price * 100)
    : null;

  const res = await db.runAsync(
    `INSERT INTO bottle_sizes (
       name, volume_ml, volume_unit, description, is_active,
       default_unit_price, standard_price_paise, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      cleanName,
      data.volume_ml ?? null,
      data.volume_unit || 'L',
      data.description?.trim() || null,
      data.default_unit_price ?? null,
      paise,
      now,
      now,
    ]
  );

  const inserted = await db.getFirstAsync<BottleSize>('SELECT * FROM bottle_sizes WHERE id = ?', [res.lastInsertRowId]);
  if (!inserted) {
    throw new Error('Failed to retrieve newly created bottle size');
  }
  return inserted;
}

export async function updateBottleSize(
  id: number,
  data: {
    name?: string;
    volume_ml?: number | null;
    volume_unit?: string;
    description?: string | null;
    is_active?: number;
    default_unit_price?: number | null;
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
  if (data.volume_ml !== undefined) {
    sets.push('volume_ml = ?');
    params.push(data.volume_ml);
  }
  if (data.volume_unit !== undefined) {
    sets.push('volume_unit = ?');
    params.push(data.volume_unit);
  }
  if (data.description !== undefined) {
    sets.push('description = ?');
    params.push(data.description ? data.description.trim() : null);
  }
  if (data.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(data.is_active);
  }
  if (data.default_unit_price !== undefined) {
    sets.push('default_unit_price = ?');
    params.push(data.default_unit_price);
    sets.push('standard_price_paise = ?');
    params.push(
      data.default_unit_price !== null ? Math.round(data.default_unit_price * 100) : null
    );
  }

  params.push(id);
  await db.runAsync(`UPDATE bottle_sizes SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function toggleBottleSizeActive(id: number, isActive: boolean): Promise<void> {
  await updateBottleSize(id, { is_active: isActive ? 1 : 0 });
}

export async function deleteBottleSizeSafe(
  id: number
): Promise<{ deleted: boolean; deactivatedInstead?: boolean; reason?: string }> {
  const db = getDatabase();
  const usedCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM delivery_items WHERE bottle_size_id = ?',
    [id]
  );

  if (usedCount && usedCount.count > 0) {
    // Deliveries reference this bottle size -> safe deactivation preserves historical deliveries
    await toggleBottleSizeActive(id, false);
    return {
      deleted: false,
      deactivatedInstead: true,
      reason: `Bottle size is used in ${usedCount.count} delivery line items. Safely deactivated so it won't appear for new deliveries while preserving past records.`,
    };
  }

  await db.runAsync('DELETE FROM bottle_sizes WHERE id = ?', [id]);
  return { deleted: true };
}
