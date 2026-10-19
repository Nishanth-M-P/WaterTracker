import { getDatabase } from '../database/database';
import { createCustomer } from './customerService';
import { createDelivery } from './deliveryService';
import { getBottleSizes } from './bottleSizeService';
import { formatLocalDate } from './reportingService';

export async function clearAllBusinessData(): Promise<void> {
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM delivery_items');
    await db.runAsync('DELETE FROM deliveries');
    await db.runAsync('DELETE FROM customer_product_rates');
    await db.runAsync('DELETE FROM customers');
    try {
      await db.runAsync(
        "DELETE FROM sqlite_sequence WHERE name IN ('deliveries', 'delivery_items', 'customers', 'customer_product_rates')"
      );
    } catch (e) {
      // Ignore if sqlite_sequence table or row does not exist
    }
  });
}

export async function seedSampleTestData(): Promise<{
  customersCreated: number;
  deliveriesCreated: number;
}> {
  // Clear any previous business data first to ensure clean state
  await clearAllBusinessData();

  const bottleSizes = await getBottleSizes(true);
  if (bottleSizes.length === 0) {
    throw new Error('No active bottle sizes found. Please configure bottle sizes first.');
  }

  // 1. Create sample customers
  const sampleCustomers = [
    {
      name: 'Grand Horizon Hotel & Resort',
      customer_type: 'Hotel' as const,
      phone: '+91 98765 43210',
      address: 'Plot 45, Marine Drive, Beachfront',
      notes: 'Deliver before 10 AM at the rear service entrance',
    },
    {
      name: 'Apex Corporate Tower',
      customer_type: 'Office' as const,
      phone: '+91 98123 45678',
      address: 'Tower B, Sector 62, Business District',
      notes: 'Security pass required at gate 2',
    },
    {
      name: 'Royal Bakery & Cafe',
      customer_type: 'Shop' as const,
      phone: '+91 94567 89012',
      address: 'Shop 12, Central Market Plaza',
      notes: 'Needs 20L jars daily for kitchen',
    },
    {
      name: 'City Care Hospital Cafeteria',
      customer_type: 'Other' as const,
      phone: '+91 91234 56789',
      address: 'Main Block, City Hospital Campus',
      notes: 'Strict hygiene standard verification',
    },
    {
      name: 'Silver Oak Law Chambers',
      customer_type: 'Office' as const,
      phone: '+91 99887 76655',
      address: 'Flat 301, High Court Annexe',
      notes: 'Deliver 1L bottles for conference rooms',
    },
  ];

  const createdCustomers = [];
  for (const c of sampleCustomers) {
    const cust = await createCustomer(c);
    createdCustomers.push(cust);
  }

  // 2. Create sample deliveries across the past 7 days up to today
  const now = new Date();
  let deliveriesCount = 0;

  // Let's create deliveries for:
  // Today (2 deliveries)
  // Yesterday (2 deliveries)
  // 2 days ago (1 delivery)
  // 3 days ago (2 deliveries)
  // 5 days ago (1 delivery)

  const deliverySchedule = [
    { daysAgo: 0, customerIndex: 0, jars: 25, smallBottles: 40, note: 'Daily morning batch' },
    { daysAgo: 0, customerIndex: 2, jars: 10, smallBottles: 15, note: 'Regular cafe restock' },
    { daysAgo: 1, customerIndex: 1, jars: 30, smallBottles: 60, note: 'Corporate floor supplies' },
    { daysAgo: 1, customerIndex: 3, jars: 20, smallBottles: 30, note: 'Hospital cafeteria supply' },
    { daysAgo: 2, customerIndex: 0, jars: 20, smallBottles: 20, note: 'Weekend prep' },
    { daysAgo: 3, customerIndex: 4, jars: 5, smallBottles: 35, note: 'Conference room packs' },
    { daysAgo: 3, customerIndex: 2, jars: 12, smallBottles: 10, note: 'Mid-week restock' },
    { daysAgo: 5, customerIndex: 1, jars: 28, smallBottles: 50, note: 'Weekly scheduled refill' },
  ];

  for (const item of deliverySchedule) {
    const d = new Date(now);
    d.setDate(d.getDate() - item.daysAgo);
    const dateStr = formatLocalDate(d);
    const timeStr = `${dateStr}T10:30:00.000Z`;
    const customer = createdCustomers[item.customerIndex];

    const lineItems = [];
    // 20L Jar
    const jarSize = bottleSizes.find((b) => b.name.includes('20L')) || bottleSizes[0];
    if (jarSize && item.jars > 0) {
      lineItems.push({
        bottle_size_id: jarSize.id,
        bottle_size_name_snapshot: jarSize.name,
        volume_ml_snapshot: jarSize.volume_ml ?? 20000,
        volume_unit_snapshot: jarSize.volume_unit || 'L',
        quantity: item.jars,
        unit_price_snapshot: jarSize.default_unit_price,
        line_total: item.jars * (jarSize.default_unit_price || 0),
      });
    }

    // Small bottle (1L or 500ml or second available)
    const smallSize = bottleSizes.find((b) => b.name.includes('1L')) || bottleSizes[1] || bottleSizes[0];
    if (smallSize && item.smallBottles > 0) {
      lineItems.push({
        bottle_size_id: smallSize.id,
        bottle_size_name_snapshot: smallSize.name,
        volume_ml_snapshot: smallSize.volume_ml ?? 1000,
        volume_unit_snapshot: smallSize.volume_unit || 'L',
        quantity: item.smallBottles,
        unit_price_snapshot: smallSize.default_unit_price,
        line_total: item.smallBottles * (smallSize.default_unit_price || 0),
      });
    }

    await createDelivery({
      customer_id: customer.id,
      delivery_date: dateStr,
      delivered_at: timeStr,
      delivery_location: customer.address || 'Standard Location',
      notes: item.note,
      items: lineItems,
    });

    deliveriesCount++;
  }

  return {
    customersCreated: createdCustomers.length,
    deliveriesCreated: deliveriesCount,
  };
}
