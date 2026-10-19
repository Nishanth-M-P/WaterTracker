import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CustomerWithStats } from '../../types/database';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Ionicons } from '@expo/vector-icons';
import { formatCustomerName, isPlaceholderCustomerName } from '../../utils/formatters';

interface CustomerCardProps {
  customer: CustomerWithStats;
  onPress: () => void;
  onAddDelivery?: () => void;
  onEdit?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onPress,
  onAddDelivery,
  onEdit,
}) => {
  const { colors, isDark } = useTheme();
  const displayName = formatCustomerName(customer.name, `Customer #${customer.id}`);
  const isPlaceholder = isPlaceholderCustomerName(customer.name);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.nameBlock}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Badge label={customer.customer_type} type={customer.customer_type} size="sm" />
          {isPlaceholder && (
            <Badge label="Needs Name" type="warning" size="sm" />
          )}
          {customer.is_archived === 1 && (
            <Badge label="Archived" type="inactive" size="sm" />
          )}
        </View>

        <View style={styles.actionsGroup}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={[
                styles.actionPill,
                { backgroundColor: isDark ? '#334155' : colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.actionPillText, { color: colors.textSecondary }]}>Edit</Text>
            </TouchableOpacity>
          )}

          {onAddDelivery && customer.is_archived === 0 && (
            <TouchableOpacity
              onPress={onAddDelivery}
              style={[
                styles.addDeliveryPill,
                { backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[styles.addDeliveryText, { color: colors.primary }]}>Delivery</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Address */}
      {customer.address ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {customer.address}
          </Text>
        </View>
      ) : null}

      {/* Phone */}
      {customer.phone ? (
        <View style={styles.metaRow}>
          <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {customer.phone}
          </Text>
        </View>
      ) : null}

      {/* Stats summary row */}
      <View
        style={[
          styles.statsRow,
          {
            backgroundColor: isDark ? '#334155' : colors.inputBg,
            borderTopColor: colors.borderLight,
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {customer.total_deliveries}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Deliveries</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {customer.total_bottles}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bottles</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {customer.last_delivery_date || '-'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Delivery</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addDeliveryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
  },
  addDeliveryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
  },
});
