import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { DailyDistribution } from '../../types/database';

interface DistributionTrendChartProps {
  data: DailyDistribution[];
  height?: number;
}

export const DistributionTrendChart: React.FC<DistributionTrendChartProps> = ({
  data,
  height = 160,
}) => {
  const { colors, isDark } = useTheme();
  const [containerWidth, setContainerWidth] = useState<number>(0);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No distribution records to plot trend
        </Text>
      </View>
    );
  }

  const effectiveWidth =
    containerWidth || Math.min(Dimensions.get('window').width - 64, 600);
  const maxVal = Math.max(...data.map((d) => d.total_bottles || 0), 5);
  const chartHeight = height - 40;
  const paddingX = 24;
  const usableWidth = Math.max(effectiveWidth - paddingX * 2, 80);

  if (data.length === 1) {
    const singleX = effectiveWidth / 2;
    const singleY = chartHeight - ((data[0].total_bottles || 0) / maxVal) * (chartHeight - 30) - 10;
    return (
      <View
        style={styles.container}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <Svg width={effectiveWidth} height={height}>
          <Line
            x1={0}
            y1={chartHeight}
            x2={effectiveWidth}
            y2={chartHeight}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Circle
            cx={singleX}
            cy={singleY}
            r={5}
            fill={colors.surface}
            stroke={colors.primary}
            strokeWidth={2.5}
          />
          <SvgText
            x={singleX}
            y={Math.max(14, singleY - 8)}
            fill={colors.text}
            fontSize={11}
            fontWeight="700"
            textAnchor="middle"
          >
            {data[0].total_bottles}
          </SvgText>
          <SvgText
            x={singleX}
            y={height - 6}
            fill={colors.textSecondary}
            fontSize={10}
            fontWeight="500"
            textAnchor="middle"
          >
            {data[0].day_label}
          </SvgText>
        </Svg>
      </View>
    );
  }

  const stepX = usableWidth / (data.length - 1);

  // Generate line points
  const points = data.map((item, idx) => {
    const x = paddingX + idx * stepX;
    const y = chartHeight - ((item.total_bottles || 0) / maxVal) * (chartHeight - 30) - 10;
    return { x, y, val: item.total_bottles || 0, date: item.day_label };
  });

  // SVG path command
  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={effectiveWidth} height={height}>
        {/* Baseline grid */}
        <Line
          x1={0}
          y1={chartHeight}
          x2={effectiveWidth}
          y2={chartHeight}
          stroke={colors.border}
          strokeWidth={1}
        />

        {/* Filled Area */}
        <Path
          d={areaPath}
          fill={colors.primary}
          fillOpacity={isDark ? 0.2 : 0.12}
        />

        {/* Line Curve */}
        <Path
          d={linePath}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
        />

        {/* Data points */}
        {points.map((pt, idx) => (
          <React.Fragment key={idx}>
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={colors.surface}
              stroke={colors.primary}
              strokeWidth={2}
            />
            {/* Show value label for non-zero points */}
            {pt.val > 0 && (
              <SvgText
                x={pt.x}
                y={Math.max(14, pt.y - 8)}
                fill={colors.text}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                {pt.val}
              </SvgText>
            )}
            {/* Date label */}
            <SvgText
              x={pt.x}
              y={height - 6}
              fill={colors.textSecondary}
              fontSize={9}
              fontWeight="500"
              textAnchor="middle"
            >
              {pt.date}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    width: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
