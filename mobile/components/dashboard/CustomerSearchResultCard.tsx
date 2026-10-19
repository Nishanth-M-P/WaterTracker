import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CustomerWithStats } from '../../types/database';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { HighlightedText } from '../common/HighlightedText';
import { Ionicons } from '@expo/vector-icons';
import { formatCustomerName, isPlaceholderCustomerName } from '../../utils/formatters';

interface CustomerSearchResultCardProps {
  customer: CustomerWithStats;
  searchQuery?: string;
  onSelectForDelivery: (customer: CustomerWithStats) => void;
  onViewProfile: (customer: CustomerWithStats) => void;
}

export const CustomerSearchResultCard: React.FC<CustomerSearchResultCardProps> = ({
  customer,
  searchQuery = '',
  onSelectForDelivery,
  onViewProfile,
}) => {
  const { colors, isDark } = useTheme();
  const displayName = formatCustomerName(customer.name, `Customer #${customer.id}`);
  const isPlaceholder = isPlaceholderCustomerName(customer.name);

  return (
    <Card
      onPress={() => onSelectForDelivery(customer)}
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      {/* Top Header: Business/Customer Name, Type Badge, and Profile action */}
      <View style={styles.topRow}>
        <View style={styles.nameBlock}>
          <HighlightedText
            text={displayName}
            highlight={searchQuery}
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
          />
          <Badge label={customer.customer_type} type={customer.customer_type} size="sm" />
          {isPlaceholder && (
            <Badge label="Needs Name" type="warning" size="sm" />
          )}
        </View>

        {/* Secondary Action: View Full Customer Profile */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation();
            onViewProfile(customer);
          }}
          style={[
            styles.profileBtn,
            {
              backgroundColor: isDark ? '#334155' : colors.inputBg,
              borderColor: colors.border,
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`View full profile for ${customer.name}`}
        >
          <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.profileBtnText, { color: colors.textSecondary }]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Address */}
      {customer.address ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <HighlightedText
            text={customer.address}
            highlight={searchQuery}
            style={[styles.metaText, { color: colors.textSecondary }]}
            numberOfLines={1}
          />
        </View>
      ) : null}

      {/* Phone Number */}
      {customer.phone ? (
        <View style={styles.metaRow}>
          <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
          <HighlightedText
            text={customer.phone}
            highlight={searchQuery}
            style={[styles.metaText, { color: colors.textSecondary }]}
            numberOfLines={1}
          />
        </View>
      ) : null}

      {/* Stats Summary & Quick Delivery Callout */}
      <View style={[styles.footerRow, { borderTopColor: colors.borderLight }]}>
        <View style={styles.statsGroup}>
          <View style={styles.statPill}>
            <Ionicons name="water-outline" size={13} color={colors.primary} />
            <Text style={[styles.statPillText, { color: colors.text }]}>
              {customer.total_bottles || 0} bottles
            </Text>
          </View>

          <View style={styles.statPill}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.statPillText, { color: colors.textMuted }]}>
              {customer.last_delivery_date ? `Last: ${customer.last_delivery_date}` : 'No deliveries'}
            </Text>
          </View>
        </View>

        {/* Primary Delivery CTA Pill */}
        <View style={[styles.deliveryCtaPill, { backgroundColor: colors.primary }]}>
          <Ionicons name="add-circle" size={15} color="#ffffff" />
          <Text style={styles.deliveryCtaText}>Add Delivery</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deliveryCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
  },
  deliveryCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
