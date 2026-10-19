import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Delivery } from '../../types/database';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Ionicons } from '@expo/vector-icons';
import { formatCustomerName } from '../../utils/formatters';

interface DeliveryItemCardProps {
  delivery: Delivery;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const DeliveryItemCard: React.FC<DeliveryItemCardProps> = ({
  delivery,
  onPress,
  onEdit,
  onDelete,
}) => {
  const { colors, isDark } = useTheme();

  // Format delivered_at time
  let timeStr = '';
  try {
    const d = new Date(delivery.delivered_at);
    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    timeStr = delivery.delivery_date;
  }

  const customerDisplayName = formatCustomerName(
    delivery.customer_name,
    `Customer #${delivery.customer_id}`
  );

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
            {customerDisplayName}
          </Text>
          {delivery.customer_type && (
            <Badge label={delivery.customer_type} type={delivery.customer_type} size="sm" />
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={[styles.totalNum, { color: colors.primary }]}>
              {delivery.total_bottles || 0}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>bottles</Text>
          </View>
          {((delivery.total_volume_litres !== undefined && delivery.total_volume_litres > 0) ||
            (delivery.total_volume_ml !== undefined && delivery.total_volume_ml > 0)) && (
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 1 }}>
              {(delivery.total_volume_litres ?? (delivery.total_volume_ml! / 1000)).toFixed(1)} L
              {delivery.total_amount !== undefined && delivery.total_amount > 0
                ? ` • ₹${delivery.total_amount.toFixed(2)}`
                : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Location line */}
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
          {delivery.delivery_location || 'Address not specified'}
        </Text>
      </View>

      {/* Date & Time line with Reference Number */}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {delivery.delivery_date} {timeStr ? `• ${timeStr}` : ''} • Ref: <Text style={{ fontWeight: '700', color: colors.primary }}>{delivery.bill_number || `WT-${delivery.id.toString().padStart(4, '0')}`}</Text>
        </Text>
      </View>

      {/* Line items breakdown */}
      {delivery.items && delivery.items.length > 0 && (
        <View
          style={[
            styles.breakdownBox,
            { backgroundColor: isDark ? '#1e293b' : colors.inputBg, borderColor: colors.borderLight, borderWidth: 1 },
          ]}
        >
          {delivery.items.map((item) => {
            const rate = item.unit_price_snapshot;
            const lineAmt = item.line_total ?? (rate != null ? item.quantity * rate : null);
            return (
              <View key={item.id || item.bottle_size_id} style={styles.sizePill}>
                <Text style={[styles.sizeNameText, { color: colors.textSecondary }]}>
                  {item.bottle_size_name_snapshot}:
                </Text>
                <Text style={[styles.sizeQtyText, { color: colors.text }]}>
                  {' '}{item.quantity}
                </Text>
                {rate != null && rate > 0 && (
                  <Text style={[styles.sizeRateText, { color: colors.textSecondary }]}>
                    {' '}(@₹{rate.toFixed(2)} = ₹{(lineAmt ?? (item.quantity * rate)).toFixed(2)})
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Notes if any */}
      {delivery.notes ? (
        <Text style={[styles.notesText, { color: colors.textMuted }]} numberOfLines={2}>
          "{delivery.notes}"
        </Text>
      ) : null}

      {/* Quick Action Buttons */}
      {(onEdit || onDelete) && (
        <View style={[styles.actionRow, { borderTopColor: colors.borderLight }]}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={[
                styles.actionBtn,
                { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff' },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={[
                styles.actionBtn,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2' },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  totalBadge: {
    alignItems: 'flex-end',
  },
  totalNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  breakdownBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  sizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  sizeNameText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sizeQtyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sizeRateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    minWidth: 70,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
