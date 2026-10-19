import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { createCustomer, checkDuplicateCustomer } from '../../services/customerService';
import { CustomerType } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function NewCustomerScreen() {
  const { colors, isDark } = useTheme();

  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Hotel');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);
  const clientSubmissionIdRef = React.useRef(
    'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
  );

  const customerTypes: CustomerType[] = ['Hotel', 'Shop', 'Office', 'Other'];

  const validatePhone = (p: string) => {
    if (!p) return true;
    // Allow digits, +, -, spaces, parentheses, minimum 7 chars
    const cleaned = p.replace(/[\s+()-]/g, '');
    return /^\d{7,15}$/.test(cleaned);
  };

  const handleNameBlur = async () => {
    if (name.trim().length >= 2) {
      const { similarName, matchingPhone } = await checkDuplicateCustomer(name, phone);
      if (similarName) {
        setDuplicateWarning(
          `Notice: An existing customer "${similarName.name}" (${similarName.customer_type}) is already registered.`
        );
      } else if (matchingPhone) {
        setDuplicateWarning(
          `Notice: Phone number is already linked to "${matchingPhone.name}".`
        );
      } else {
        setDuplicateWarning(null);
      }
    }
  };

  const handleSave = async (forceDuplicate: boolean = false) => {
    // Synchronous guard against rapid multiple taps
    if (isSubmittingRef.current) return;

    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Required Field', 'Please enter a customer or business name.');
      return;
    }

    if (phone.trim() && !validatePhone(phone.trim())) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 7 digits).');
      return;
    }

    // Duplicate check
    if (!forceDuplicate) {
      const { similarName, matchingPhone } = await checkDuplicateCustomer(cleanName, phone);
      if (similarName || matchingPhone) {
        const matchTitle = similarName
          ? `Similar customer name: "${similarName.name}"`
          : `Phone match: "${matchingPhone?.name}"`;

        Alert.alert(
          'Possible Duplicate Customer',
          `${matchTitle} already exists. Do you still wish to register this new business account?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Anyway',
              style: 'default',
              onPress: () => handleSave(true),
            },
          ]
        );
        return;
      }
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const created = await createCustomer({
        name: cleanName,
        customer_type: customerType,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        client_submission_id: clientSubmissionIdRef.current,
      });

      // Navigate DIRECTLY to that customer's profile screen per PRD Section 1
      router.replace(`/customer/${created.id}?created=true`);
    } catch (err: any) {
      isSubmittingRef.current = false;
      Alert.alert('Save Failed', err.message || 'Could not register customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Header title="New Customer" subtitle="Register a hotel, shop, or office" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          {/* Customer Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Customer / Business Name *
            </Text>
            <TextInput
              id="customer-name-input"
              nativeID="customer-name-input"
              aria-label="Customer or Business Name"
              autoComplete="organization"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (duplicateWarning) setDuplicateWarning(null);
              }}
              onBlur={handleNameBlur}
              placeholder="e.g. Royal Grand Hotel, Apex Corp"
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

          {/* Duplicate Warning Banner */}
          {duplicateWarning && (
            <View
              style={[
                styles.warningBanner,
                { backgroundColor: isDark ? '#78350f' : colors.warningLight },
              ]}
            >
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <Text style={[styles.warningText, { color: isDark ? '#fef3c7' : '#92400e' }]}>
                {duplicateWarning}
              </Text>
            </View>
          )}

          {/* Customer Type Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Customer Type *
            </Text>
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

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Phone Number (Optional)
            </Text>
            <TextInput
              id="customer-phone-input"
              nativeID="customer-phone-input"
              aria-label="Phone Number"
              autoComplete="tel"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (duplicateWarning) setDuplicateWarning(null);
              }}
              onBlur={handleNameBlur}
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

          {/* Address / Location */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Address / Delivery Location
            </Text>
            <TextInput
              id="customer-address-input"
              nativeID="customer-address-input"
              aria-label="Address or Delivery Location"
              autoComplete="street-address"
              value={address}
              onChangeText={setAddress}
              placeholder="Building name, street, room or gate number"
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

          {/* Delivery Notes */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Delivery Instructions (Optional)
            </Text>
            <TextInput
              id="customer-notes-input"
              nativeID="customer-notes-input"
              aria-label="Delivery Instructions"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Call security on arrival, deliver at back entrance"
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
        </Card>

        {/* Buttons */}
        <View style={styles.actionsRow}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            style={{ flex: 1, marginRight: 8 }}
            size="lg"
          />
          <Button
            title={saving ? "Saving Customer..." : "Save Customer"}
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
