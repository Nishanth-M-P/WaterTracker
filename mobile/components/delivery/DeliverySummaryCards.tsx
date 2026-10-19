import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface DeliverySummaryCardsProps {
  totalBottles: number;
  totalDeliveries: number;
  uniqueCustomers: number;
  totalAmount: number;
}

export const DeliverySummaryCards: React.FC<DeliverySummaryCardsProps> = ({
  totalBottles,
  totalDeliveries,
  uniqueCustomers,
  totalAmount,
}) => {
  const { colors, isDark } = useTheme();

  const formattedAmount = `₹${totalAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const cards = [
    {
      id: 'bottles',
      title: 'Total Bottles',
      value: totalBottles.toLocaleString('en-IN'),
      subtitle: 'All sizes',
      icon: 'water' as const,
      color: '#0284c7',
      bgColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
    },
    {
      id: 'deliveries',
      title: 'Deliveries',
      value: totalDeliveries.toLocaleString('en-IN'),
      subtitle: 'Completed',
      icon: 'cube' as const,
      color: '#0d9488',
      bgColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#ccfbf1',
    },
    {
      id: 'customers',
      title: 'Customers Served',
      value: uniqueCustomers.toLocaleString('en-IN'),
      subtitle: 'Hotels & Shops',
      icon: 'business' as const,
      color: '#8b5cf6',
      bgColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
    },
    {
      id: 'amount',
      title: 'Total Amount',
      value: formattedAmount,
      subtitle: 'Period revenue',
      icon: 'cash' as const,
      color: '#16a34a',
      bgColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {cards.map((card) => (
          <View
            key={card.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: card.bgColor }]}>
                <Ionicons name={card.icon} size={18} color={card.color} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {card.title}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <Text
                style={[
                  styles.cardValue,
                  { color: colors.text },
                  card.id === 'amount' && styles.amountValue,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {card.value}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {card.subtitle}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardBody: {
    marginTop: 2,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  amountValue: {
    fontSize: 17,
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});
