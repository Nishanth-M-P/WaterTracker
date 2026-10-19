import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CustomerSummary } from '../../types/database';
import { Badge } from '../common/Badge';

interface TopCustomersChartProps {
  data: CustomerSummary[];
  limit?: number;
}

export const TopCustomersChart: React.FC<TopCustomersChartProps> = ({ data, limit = 5 }) => {
  const { colors, isDark } = useTheme();

  const displayed = data.slice(0, limit);
  const maxBottles = Math.max(...displayed.map((c) => c.total_bottles), 1);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No customer records in this date range
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {displayed.map((cust, idx) => {
        const barPct = Math.round((cust.total_bottles / maxBottles) * 100);

        return (
          <View key={cust.customer_id} style={styles.customerRow}>
            <View style={styles.headerLine}>
              <View style={styles.nameBlock}>
                <Text style={[styles.rank, { color: colors.textMuted }]}>#{idx + 1}</Text>
                <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                  {cust.customer_name}
                </Text>
                <Badge label={cust.customer_type} type={cust.customer_type} size="sm" />
              </View>
              <Text style={[styles.bottlesTotal, { color: colors.text }]}>
                {cust.total_bottles} <Text style={[styles.unit, { color: colors.textSecondary }]}>bottles</Text>
              </Text>
            </View>

            {/* Progress bar */}
            <View style={[styles.track, { backgroundColor: isDark ? '#334155' : colors.inputBg }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(barPct, 4)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>

            <Text style={[styles.subText, { color: colors.textMuted }]}>
              {cust.total_deliveries} {cust.total_deliveries === 1 ? 'delivery' : 'deliveries'} recorded
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginVertical: 4,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  customerRow: {
    gap: 6,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  rank: {
    fontSize: 12,
    fontWeight: '700',
    width: 22,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 140,
  },
  bottlesTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  unit: {
    fontSize: 11,
    fontWeight: '400',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  subText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
