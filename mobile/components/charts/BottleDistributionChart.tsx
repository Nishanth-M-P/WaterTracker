import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BottleSizeSummary } from '../../types/database';

interface BottleDistributionChartProps {
  data: BottleSizeSummary[];
}

export const BottleDistributionChart: React.FC<BottleDistributionChartProps> = ({ data }) => {
  const { colors, isDark } = useTheme();

  const totalBottles = data.reduce((acc, curr) => acc + curr.total_quantity, 0);

  if (!data || data.length === 0 || totalBottles === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No bottle distribution records available
        </Text>
      </View>
    );
  }

  const palette = [
    colors.primary,
    '#0d9488', // teal
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  return (
    <View style={styles.container}>
      {/* Combined segmented bar */}
      <View style={[styles.segmentedTrack, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
        {data.map((item, idx) => {
          const pct = (item.total_quantity / totalBottles) * 100;
          if (pct === 0) return null;
          return (
            <View
              key={item.bottle_size_id}
              style={[
                styles.segment,
                {
                  width: `${pct}%`,
                  backgroundColor: palette[idx % palette.length],
                },
              ]}
            />
          );
        })}
      </View>

      {/* Breakdown rows */}
      <View style={styles.legendContainer}>
        {data.map((item, idx) => {
          const pct = Math.round((item.total_quantity / totalBottles) * 100) || 0;
          const barColor = palette[idx % palette.length];

          return (
            <View key={item.bottle_size_id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.colorDot, { backgroundColor: barColor }]} />
                <Text style={[styles.sizeName, { color: colors.text }]} numberOfLines={1}>
                  {item.bottle_size_name}
                </Text>
              </View>

              <View style={styles.rowRight}>
                <Text style={[styles.qtyText, { color: colors.text }]}>
                  {item.total_quantity}{' '}
                  <Text style={[styles.unitText, { color: colors.textSecondary }]}>bottles</Text>
                </Text>
                <Text style={[styles.pctText, { color: colors.textMuted }]}>
                  {pct}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  segmentedTrack: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  segment: {
    height: '100%',
  },
  legendContainer: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  sizeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '400',
  },
  pctText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'right',
  },
});
