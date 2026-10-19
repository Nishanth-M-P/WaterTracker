import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { initDatabase } from '../database/database';

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Web accessibility fix: prevent Chrome's "Blocked aria-hidden on an element because its descendant retained focus"
  // When React Navigation hides a tab or screen with aria-hidden="true", blur any descendant that retained focus.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'aria-hidden' &&
          (m.target as HTMLElement)?.getAttribute?.('aria-hidden') === 'true'
        ) {
          const target = m.target as HTMLElement;
          const active = document.activeElement as HTMLElement | null;
          if (active && active !== document.body && target.contains(active)) {
            active.blur();
          }
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden'],
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initDatabase();
        if (mounted) setDbReady(true);
      } catch (err: any) {
        if (mounted) {
          setInitError(err.message || 'Database initialization error');
          setDbReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRetry = async () => {
    setInitError(null);
    setDbReady(false);
    try {
      await initDatabase();
      setDbReady(true);
    } catch (err: any) {
      setInitError(err.message || 'Database initialization error');
      setDbReady(true);
    }
  };

  if (!dbReady) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.initText, { color: colors.textSecondary }]}>
          Loading WaterTrack...
        </Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.errorTitle, { color: colors.danger }]}>Initialization Notice</Text>
        <Text style={[styles.errorMsg, { color: colors.text }]}>{initError}</Text>
        <View style={{ marginTop: 16 }}>
          <Text
            onPress={handleRetry}
            style={{
              color: '#ffffff',
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            Retry Connection
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="delivery/new"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="delivery/edit"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="delivery/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="customer/new"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="customer/edit"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="customer/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="bottle-sizes"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 14,
    textAlign: 'center',
  },
});
