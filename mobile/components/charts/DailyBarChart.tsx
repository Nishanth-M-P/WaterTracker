import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { DailyDistribution } from '../../types/database';
import { getTodayDate } from '../../services/reportingService';

interface DailyBarChartProps {
  data: DailyDistribution[];
  height?: number;
  showSummary?: boolean;
}

export const DailyBarChart: React.FC<DailyBarChartProps> = ({
  data,
  height = 190,
  showSummary = true,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const todayStr = getTodayDate();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No delivery activity in this date range
        </Text>
      </View>
    );
  }

  // Calculate stats
  const totalBottles = data.reduce((sum, d) => sum + (d.total_bottles || 0), 0);
  const maxRaw = Math.max(...data.map((d) => d.total_bottles || 0));
  // Round maxVal up to a pleasant tick: at least 5, or round up to next multiple of 5 or 10
  const maxVal = maxRaw <= 5 ? 5 : Math.ceil(maxRaw / 5) * 5;
  const midVal = Math.round(maxVal / 2);

  // Peak day calculation
  const peakItem = data.reduce(
    (prev, curr) => (curr.total_bottles > (prev?.total_bottles || 0) ? curr : prev),
    data[0]
  );
  const activeDays = data.filter((d) => d.total_bottles > 0).length;
  const avgBottles = activeDays > 0 ? (totalBottles / data.length).toFixed(1) : '0';

  const isScrollable = data.length > 7;
  const chartPlotHeight = height - 55;

  const renderBarColumn = (item: DailyDistribution, index: number) => {
    const isSelected = selectedIndex === index;
    const isToday = item.date === todayStr;
    const hasBottles = item.total_bottles > 0;
    const barPct = maxVal > 0 ? Math.min(100, (item.total_bottles / maxVal) * 100) : 0;

    return (
      <TouchableOpacity
        key={item.date}
        activeOpacity={0.7}
        onPress={() => setSelectedIndex(isSelected ? null : index)}
        style={[
          styles.barColumn,
          isScrollable && { minWidth: 46, paddingHorizontal: 4 },
        ]}
      >
        {/* Value Label above bar */}
        <View style={styles.valueLabelContainer}>
          {hasBottles && (
            <Text
              style={[
                styles.valueLabel,
                { color: isSelected || isToday ? colors.primary : colors.text },
              ]}
              numberOfLines={1}
            >
              {item.total_bottles}
            </Text>
          )}
        </View>

        {/* Bar Track & Fill */}
        <View
          style={[
            styles.barTrack,
            {
              height: chartPlotHeight,
              backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)',
            },
          ]}
        >
          <View
            style={[
              styles.barFill,
              {
                height: `${hasBottles ? Math.max(barPct, 8) : 0}%`,
                backgroundColor: hasBottles
                  ? isToday
                    ? colors.primary
                    : isDark
                    ? '#38bdf8'
                    : '#0284c7'
                  : 'transparent',
              },
            ]}
          />
        </View>

        {/* Date / Day Label */}
        <View style={styles.dayLabelContainer}>
          <Text
            style={[
              styles.dayLabel,
              {
                color: isToday
                  ? colors.primary
                  : isSelected
                  ? colors.text
                  : colors.textSecondary,
                fontWeight: isToday || isSelected ? '700' : '500',
              },
            ]}
            numberOfLines={1}
          >
            {item.day_label}
          </Text>

          {/* Delivery count pill */}
          {item.delivery_count > 0 && (
            <Text
              style={[
                styles.delivCountText,
                {
                  color: isToday ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {item.delivery_count}{item.delivery_count === 1 ? ' delivery' : ' deliveries'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Optional Top Summary Header */}
      {showSummary && (
        <View style={[styles.summaryHeader, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>TOTAL</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {totalBottles} <Text style={{ fontSize: 11, fontWeight: '400' }}>bottles</Text>
            </Text>
          </View>

          {peakItem && peakItem.total_bottles > 0 && (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>PEAK DAY</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {peakItem.total_bottles}{' '}
                <Text style={{ fontSize: 11, fontWeight: '400', color: colors.textSecondary }}>
                  ({peakItem.day_label})
                </Text>
              </Text>
            </View>
          )}

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>DAILY AVG</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {avgBottles} <Text style={{ fontSize: 11, fontWeight: '400' }}>/day</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Selected Day Tooltip Banner */}
      {selectedIndex !== null && data[selectedIndex] && (
        <View style={[styles.tooltipBanner, { backgroundColor: `${colors.primary}15` }]}>
          <Text style={[styles.tooltipText, { color: colors.primary }]}>
            {data[selectedIndex].day_label} ({data[selectedIndex].date}):{' '}
            <Text style={{ fontWeight: '800' }}>
              {data[selectedIndex].total_bottles} bottles
            </Text>{' '}
            across {data[selectedIndex].delivery_count} {data[selectedIndex].delivery_count === 1 ? 'delivery' : 'deliveries'}
          </Text>
        </View>
      )}

      {/* Main Chart Body */}
      <View style={[styles.chartBody, { height }]}>
        {/* Left Y-Axis Scale Markers */}
        <View style={styles.yAxis}>
          <Text style={[styles.axisText, { color: colors.textMuted }]}>{maxVal}</Text>
          <Text style={[styles.axisText, { color: colors.textMuted }]}>{midVal}</Text>
          <Text style={[styles.axisText, { color: colors.textMuted }]}>0</Text>
        </View>

        {/* Chart Plot Area with Grid Lines & Bars */}
        <View style={styles.plotArea}>
          {/* 3 Horizontal Reference Lines */}
          <View style={[styles.gridLine, styles.gridLineTop, { borderColor: colors.borderLight }]} />
          <View style={[styles.gridLine, styles.gridLineMid, { borderColor: colors.borderLight }]} />
          <View style={[styles.gridLine, styles.gridLineBottom, { borderColor: colors.borderLight }]} />

          {/* Bar Columns Container */}
          {isScrollable ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollableContent}
            >
              {data.map(renderBarColumn)}
            </ScrollView>
          ) : (
            <View style={styles.fixedContent}>
              {data.map(renderBarColumn)}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginVertical: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  summaryItem: {
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  tooltipBanner: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  tooltipText: {
    fontSize: 11.5,
  },
  chartBody: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
  },
  yAxis: {
    width: 26,
    justifyContent: 'space-between',
    paddingBottom: 36,
    paddingTop: 18,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  axisText: {
    fontSize: 9,
    fontWeight: '600',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  gridLineTop: {
    top: 22,
  },
  gridLineMid: {
    top: '48%',
  },
  gridLineBottom: {
    bottom: 36,
    borderStyle: 'solid',
  },
  fixedContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  scrollableContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: 16,
    zIndex: 1,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  valueLabelContainer: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  barTrack: {
    width: 24,
    maxWidth: 32,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  dayLabelContainer: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayLabel: {
    fontSize: 9.5,
    textAlign: 'center',
  },
  delivCountText: {
    fontSize: 8,
    marginTop: 1,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 13,
  },
});
