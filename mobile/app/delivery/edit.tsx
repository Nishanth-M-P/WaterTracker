import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { getBottleSizes } from '../../services/bottleSizeService';
import { getDeliveryById, updateDelivery } from '../../services/deliveryService';
import { BottleSize, Delivery } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

function showAppAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function EditDeliveryScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [bottleSizes, setBottleSizes] = useState<BottleSize[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const d = await getDeliveryById(Number(id));
        if (!d) {
          showAppAlert('Error', 'Delivery record not found');
          router.back();
          return;
        }

        const sizes = await getBottleSizes(false); // include all active/inactive in case past sizes used
        setDelivery(d);
        setBottleSizes(sizes);
        setDeliveryDate(d.delivery_date);

        let initialTime = '10:00';
        if (d.delivered_at) {
          try {
            const parsed = new Date(d.delivered_at);
            initialTime = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
          } catch {}
        }
        setDeliveryTime(initialTime);

        setDeliveryLocation(d.delivery_location);
        setNotes(d.notes || '');

        const qtys: Record<number, number> = {};
        for (const s of sizes) {
          qtys[s.id] = 0;
        }
        if (d.items) {
          for (const item of d.items) {
            qtys[item.bottle_size_id] = item.quantity;
          }
        }
        setQuantities(qtys);
      } catch (err: any) {
        showAppAlert('Error', err.message || 'Failed to load delivery');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleQtyChange = (bottleId: number, delta: number) => {
    const current = quantities[bottleId] || 0;
    const next = Math.max(0, current + delta);
    setQuantities((prev) => ({ ...prev, [bottleId]: next }));
  };

  const handleDirectQtyChange = (bottleId: number, text: string) => {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setQuantities((prev) => ({
      ...prev,
      [bottleId]: isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const totalBottles = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    if (saving || !delivery) return;

    if (totalBottles <= 0) {
      showAppAlert('Invalid Quantities', 'At least one bottle quantity must be greater than zero.');
      return;
    }

    const resolvedLocation =
      deliveryLocation.trim() ||
      delivery.delivery_location ||
      delivery.customer_address?.trim() ||
      delivery.customer_name ||
      'Store Location';

    setSaving(true);
    try {
      const lineItems = bottleSizes
        .filter((size) => (quantities[size.id] || 0) > 0)
        .map((size) => {
          const volMl = size.volume_ml ?? 1000;
          const volUnit = size.volume_unit || (volMl >= 1000 ? 'L' : 'mL');
          const existingItem = delivery.items?.find((it) => it.bottle_size_id === size.id);
          const unitPrice =
            existingItem?.unit_price_snapshot ??
            (size.standard_price_paise
              ? size.standard_price_paise / 100
              : size.default_unit_price ?? 0);
          return {
            bottle_size_id: size.id,
            bottle_size_name_snapshot: size.name,
            volume_ml_snapshot: volMl,
            volume_unit_snapshot: volUnit,
            quantity: quantities[size.id],
            unit_price_snapshot: unitPrice,
            line_total: quantities[size.id] * unitPrice,
          };
        });

      const timeClean = deliveryTime.trim() || '10:00';
      const timeParts = timeClean.split(':');
      const hh = (timeParts[0] || '10').padStart(2, '0');
      const mm = (timeParts[1] || '00').padStart(2, '0');
      const deliveredAt = `${deliveryDate}T${hh}:${mm}:00.000Z`;

      await updateDelivery(delivery.id, {
        customer_id: delivery.customer_id,
        delivery_date: deliveryDate,
        delivered_at: deliveredAt,
        delivery_location: resolvedLocation,
        notes: notes.trim() || null,
        items: lineItems,
      });

      // Immediately redirect to the updated delivery details
      router.replace(`/delivery/${delivery.id}`);
    } catch (err: any) {
      showAppAlert('Update Failed', err.message || 'Could not update delivery.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !delivery) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title="Edit Delivery" showBack />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Header
        title={`Edit Delivery #${delivery.id}`}
        subtitle={delivery.customer_name}
        showBack
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Read-Only Badge Card */}
        <Card style={styles.customerCard}>
          <Text style={[styles.customerLabel, { color: colors.textSecondary }]}>Customer</Text>
          <View style={styles.customerRow}>
            <Text style={[styles.customerName, { color: colors.text }]}>{delivery.customer_name}</Text>
            {delivery.customer_type && (
              <Badge label={delivery.customer_type} type={delivery.customer_type} size="sm" />
            )}
          </View>
        </Card>

        {/* Quantities Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Update Bottle Quantities</Text>
          {bottleSizes.map((size) => {
            const qty = quantities[size.id] || 0;
            return (
              <Card key={size.id} style={styles.qtyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sizeName, { color: colors.text }]}>{size.name}</Text>
                  {size.is_active === 0 && (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      (Deactivated product)
                    </Text>
                  )}
                </View>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    onPress={() => handleQtyChange(size.id, -1)}
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: isDark ? '#334155' : colors.inputBg },
                    ]}
                    disabled={qty <= 0}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={qty <= 0 ? colors.textMuted : colors.text}
                    />
                  </TouchableOpacity>

                  <TextInput
                    id={`edit-bottle-qty-${size.id}`}
                    nativeID={`edit-bottle-qty-${size.id}`}
                    aria-label={`Quantity for ${size.name}`}
                    keyboardType="number-pad"
                    value={String(qty)}
                    onChangeText={(t) => handleDirectQtyChange(size.id, t)}
                    style={[
                      styles.qtyInput,
                      {
                        color: colors.text,
                        backgroundColor: isDark ? '#1e293b' : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={() => handleQtyChange(size.id, 1)}
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: isDark ? '#334155' : colors.inputBg },
                    ]}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Total bottles summary */}
        <Card
          style={[
            styles.totalCard,
            { backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.primaryDark }]}>TOTAL BOTTLES</Text>
          <Text style={[styles.totalNum, { color: colors.text }]}>{totalBottles} bottles</Text>
        </Card>

        {/* Delivery Details Form */}
        <Card style={styles.formCard}>
          {/* Date & Time Row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.fieldGroup, { flex: 3 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Delivery Date (YYYY-MM-DD) *
              </Text>
              <TextInput
                id="edit-delivery-date-input"
                nativeID="edit-delivery-date-input"
                aria-label="Delivery Date"
                value={deliveryDate}
                onChangeText={setDeliveryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.formInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 2 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Time (HH:MM) *
              </Text>
              <TextInput
                id="edit-delivery-time-input"
                nativeID="edit-delivery-time-input"
                aria-label="Delivery Time"
                value={deliveryTime}
                onChangeText={setDeliveryTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.formInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Delivery Location *
            </Text>
            <TextInput
              id="edit-delivery-location-input"
              nativeID="edit-delivery-location-input"
              aria-label="Delivery Location"
              autoComplete="street-address"
              value={deliveryLocation}
              onChangeText={setDeliveryLocation}
              placeholder="Delivery address / point"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.formInput,
                {
                  color: colors.text,
                  backgroundColor: isDark ? '#334155' : colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Notes (Optional)
            </Text>
            <TextInput
              id="edit-delivery-notes-input"
              nativeID="edit-delivery-notes-input"
              aria-label="Delivery Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Special instructions or notes"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[
                styles.formTextArea,
                {
                  color: colors.text,
                  backgroundColor: isDark ? '#334155' : colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            style={{ flex: 1, marginRight: 8 }}
            size="lg"
          />
          <Button
            title="Save Changes"
            variant="primary"
            loading={saving}
            disabled={saving || totalBottles <= 0 || !deliveryLocation.trim()}
            onPress={handleSave}
            style={{ flex: 2, marginLeft: 8 }}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 60,
  },
  customerCard: {
    padding: 14,
    gap: 4,
  },
  customerLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  qtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  sizeName: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 54,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  totalCard: {
    padding: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalNum: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  formCard: {
    padding: 16,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  formInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  formTextArea: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
