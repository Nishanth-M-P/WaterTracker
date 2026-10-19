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
import { getCustomerById, updateCustomer, checkDuplicateCustomer } from '../../services/customerService';
import { CustomerType } from '../../types/database';

export default function EditCustomerScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Hotel');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isArchived, setIsArchived] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const customerTypes: CustomerType[] = ['Hotel', 'Shop', 'Office', 'Other'];

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const c = await getCustomerById(Number(id));
        if (!c) {
          Alert.alert('Error', 'Customer not found');
          router.back();
          return;
        }
        setName(c.name);
        setCustomerType(c.customer_type);
        setPhone(c.phone || '');
        setAddress(c.address || '');
        setNotes(c.notes || '');
        setIsArchived(c.is_archived);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async (force: boolean = false) => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Required Field', 'Customer name cannot be blank.');
      return;
    }

    if (!force && id) {
      const { similarName, matchingPhone } = await checkDuplicateCustomer(cleanName, phone, Number(id));
      if (similarName || matchingPhone) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const proceed = window.confirm(
            `Another customer has a matching name or phone number. Do you wish to continue saving?`
          );
          if (!proceed) return;
        } else {
          const matchTitle = similarName
            ? `Another customer has a matching name: "${similarName.name}"`
            : `Phone already used by "${matchingPhone?.name}"`;

          Alert.alert('Potential Duplicate', `${matchTitle}. Do you wish to continue?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Changes',
              onPress: () => handleSave(true),
            },
          ]);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await updateCustomer(Number(id), {
        name: cleanName,
        customer_type: customerType,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_archived: isArchived,
      });

      // Immediately redirect to the customer profile details
      router.replace(`/customer/${id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title="Edit Customer" showBack />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Header title="Edit Customer" subtitle={`Account #${id}`} showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Customer / Business Name *
            </Text>
            <TextInput
              id="edit-customer-name-input"
              nativeID="edit-customer-name-input"
              aria-label="Customer or Business Name"
              autoComplete="organization"
              value={name}
              onChangeText={setName}
              placeholder="Business name"
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
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Customer Type</Text>
            <View style={styles.typesRow}>
              {customerTypes.map((type) => {
                const isSelected = customerType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setCustomerType(type)}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isDark
                          ? '#334155'
                          : colors.inputBg,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        {
                          color: isSelected ? '#ffffff' : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone Number</Text>
            <TextInput
              id="edit-customer-phone-input"
              nativeID="edit-customer-phone-input"
              aria-label="Phone Number"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
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
              Address / Delivery Location
            </Text>
            <TextInput
              id="edit-customer-address-input"
              nativeID="edit-customer-address-input"
              aria-label="Address or Delivery Location"
              autoComplete="street-address"
              value={address}
              onChangeText={setAddress}
              placeholder="Delivery address"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
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

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              id="edit-customer-notes-input"
              nativeID="edit-customer-notes-input"
              aria-label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Special delivery instructions"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
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

          {/* Archive Status Toggle */}
          <TouchableOpacity
            onPress={() => setIsArchived(isArchived === 1 ? 0 : 1)}
            style={[
              styles.archiveToggle,
              {
                backgroundColor: isArchived === 1 ? colors.warningLight : isDark ? '#334155' : colors.inputBg,
                borderColor: isArchived === 1 ? colors.warning : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.archiveToggleText,
                { color: isArchived === 1 ? colors.warning : colors.text },
              ]}
            >
              {isArchived === 1 ? 'Customer is currently Archived' : 'Customer is Active'}
            </Text>
            <Text style={[styles.archiveToggleSub, { color: colors.textSecondary }]}>
              Tap to {isArchived === 1 ? 'Unarchive' : 'Archive'}
            </Text>
          </TouchableOpacity>
        </Card>

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
            disabled={saving || !name.trim()}
            onPress={() => handleSave(false)}
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
    paddingBottom: 40,
  },
  formCard: {
    padding: 18,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  formInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  formTextArea: {
    minHeight: 65,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  typesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnText: {
    fontSize: 13,
  },
  archiveToggle: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  archiveToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  archiveToggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
