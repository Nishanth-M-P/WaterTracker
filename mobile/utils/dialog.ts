import { Alert, Platform } from 'react-native';

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Cross-platform confirmation dialog that reliably prompts and executes on both Web and Native (iOS/Android).
 * On Web, uses window.confirm since React Native Web's Alert.alert does not support action buttons.
 * On Native, uses Alert.alert with destructive styling.
 */
export function confirmAction({
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
}: ConfirmActionOptions): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const promptText = message ? `${title}\n\n${message}` : title;
    const ok = window.confirm(promptText);
    if (ok) {
      // Execute on next tick so DOM focus releases cleanly
      setTimeout(() => {
        Promise.resolve(onConfirm()).catch((err) => {
          console.error('Confirmation action error:', err);
          showAlert('Error', err?.message || 'Operation failed');
        });
      }, 50);
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: isDestructive ? 'destructive' : 'default',
      onPress: () => {
        Promise.resolve(onConfirm()).catch((err) => {
          console.error('Confirmation action error:', err);
          Alert.alert('Error', err?.message || 'Operation failed');
        });
      },
    },
  ]);
}

/**
 * Cross-platform information alert dialog.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const text = message ? `${title}\n\n${message}` : title;
    window.alert(text);
  } else {
    Alert.alert(title, message);
  }
}
