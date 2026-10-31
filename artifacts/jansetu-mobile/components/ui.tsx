import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { type ReactElement } from 'react';
import { router, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { screenTopPadding } from '@/lib/screenInsets';

const brandIcon = require('../assets/images/icon.png');

export function Screen({
  children,
  contentStyle,
  refreshControl,
  keyboardAware = false,
  hasTabBar = false,
}: React.PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement;
  keyboardAware?: boolean;
  hasTabBar?: boolean;
}>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const contentContainerStyle = [
    styles.screenContent,
    {
      paddingTop: screenTopPadding(Platform.OS, insets.top),
      paddingBottom:
        (Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 18)) +
        (hasTabBar ? (Platform.OS === 'web' ? 84 : 96) : 24),
    },
    contentStyle,
  ];
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {keyboardAware ? (
        <KeyboardAwareScrollViewCompat
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          bottomOffset={64}
          refreshControl={refreshControl}
          contentContainerStyle={contentContainerStyle}
        >
          {children}
        </KeyboardAwareScrollViewCompat>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          contentContainerStyle={contentContainerStyle}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={brandIcon}
      accessibilityLabel="JanSetu"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'inverse' | 'outline' | 'quiet' | 'danger';
  accessibilityLabel?: string;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useColors();
  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.destructive
        : variant === 'outline' || variant === 'inverse'
          ? colors.card
          : 'transparent';
  const foregroundColor =
    variant === 'primary' || variant === 'danger'
      ? colors.primaryForeground
      : variant === 'inverse'
        ? colors.primary
        : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={() => {
        if (disabled || loading) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'outline' ? colors.border : variant === 'inverse' ? colors.card : backgroundColor,
          opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={foregroundColor} /> : null}
          <Text style={[styles.buttonText, { color: foregroundColor, flexShrink: 1 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  style,
}: {
  name: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.65 : 1 },
        style,
      ]}
    >
      <Feather name={name} size={19} color={colors.foreground} />
    </Pressable>
  );
}

/**
 * Shared Back / Home control. Uses history when available, otherwise replaces
 * to a safe fallback so direct entry never loops or lands on login.
 * Pass mode="home" on top-level tabs to always jump to the dashboard.
 * Does not use auth context; callers pass a role-appropriate fallback.
 */
export function BackButton({
  fallback,
  label = 'Go back',
  mode = 'back',
  style,
  testID,
}: {
  fallback: Href;
  label?: string;
  mode?: 'back' | 'home';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
      onPress={() => {
        if (mode === 'back' && router.canGoBack()) router.back();
        else router.replace(fallback);
      }}
      style={({ pressed }) => [
        styles.backButton,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Feather name={mode === 'home' ? 'home' : 'arrow-left'} size={18} color={colors.primary} />
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const lower = status.toLowerCase();
  const palette = ['resolved', 'verified', 'closed'].includes(lower)
    ? { text: colors.success, background: colors.successBackground }
    : ['new', 'cancelled'].includes(lower)
      ? { text: '#991B1B', background: '#FEF2F2' }
      : ['under review', 'pending approval'].includes(lower)
        ? { text: colors.warning, background: colors.warningBackground }
        : ['assigned', 'in progress', 'reopened'].includes(lower)
          ? { text: colors.info, background: colors.infoBackground }
          : { text: colors.mutedForeground, background: colors.muted };
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{status}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.emptyState,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={21} color={colors.primary} />
      </View>
      <Text style={[uiStyles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.errorBox,
        { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
      ]}
    >
      <Feather name="alert-circle" size={18} color={colors.destructive} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: '#991B1B' }]}>{message}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={{ marginTop: 4, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Text style={{ color: colors.primary, fontFamily: 'Manrope_700Bold' }}>
              Try again
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 10 }]}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          <Text style={{ color: colors.primary, fontFamily: 'Manrope_700Bold' }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  body: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21 },
  cardTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  inputLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  screenContent: { paddingHorizontal: 20, gap: 19 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 2,
  },
  eyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 30, lineHeight: 36 },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 20, marginTop: 5 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderRadius: 10,
  },
  buttonText: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  emptyState: { borderWidth: 1, borderRadius: 14, alignItems: 'center', padding: 24, gap: 8 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10 },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
});
