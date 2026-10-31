import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { BackButton, ActionButton, Card, ErrorNotice, PageHeader, Screen } from '@/components/ui';
import { apiRequest, type CitizenStats, type NotificationCategory, type NotificationPreferences } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';
import {
  getSavedPushToken,
  setPushNotificationPreference,
} from '@/lib/pushNotifications';

const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
}[] = [
  {
    key: 'issue_updates',
    label: 'Issue updates',
    description: 'Alerts when your submitted issues are assigned or updated.',
  },
  {
    key: 'broadcasts',
    label: 'Office announcements',
    description: 'Messages sent by your representative’s office.',
  },
  {
    key: 'announcements',
    label: 'General alerts',
    description: 'Reminders, events, family link requests, and other general notifications.',
  },
];

export default function ProfileScreen() {
  const colors = useColors();
  const { user, token, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const stats = useQuery({
    queryKey: ['citizen-stats', token],
    queryFn: () => apiRequest<CitizenStats>('/dashboard/citizen-stats', { token }),
    enabled: !!token,
  });
  const notificationPreferences = useQuery({
    queryKey: ['notification-preferences', token],
    queryFn: () => apiRequest<NotificationPreferences>('/me/notification-prefs', { token }),
    enabled: !!token,
  });
  const savedPushToken = useQuery({
    queryKey: ['saved-push-token', user?.id],
    queryFn: () => getSavedPushToken(user!.id),
    enabled: !!user?.id,
  });
  const notificationMutation = useMutation({
    mutationFn: async ({
      category,
      enabled,
    }: {
      category: NotificationCategory;
      enabled: boolean;
    }) => {
      if (!user || !token) throw new Error('Sign in again to change notification settings.');
      await setPushNotificationPreference(user.id, token, category, enabled);
    },
    onSuccess: async () => {
      setNotificationError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notification-preferences', token] }),
        queryClient.invalidateQueries({ queryKey: ['saved-push-token', user?.id] }),
      ]);
    },
    onError: (error) => {
      setNotificationError(
        error instanceof Error ? error.message : 'Could not update notification settings.',
      );
    },
  });
  const changeNotificationSetting = (category: NotificationCategory, enabled: boolean) => {
    setNotificationError(null);
    if (Platform.OS === 'web') {
      Alert.alert('Use the mobile app', 'Push alerts can be enabled from JanSetu on your phone.');
      return;
    }
    notificationMutation.mutate({ category, enabled });
  };

  const openNotificationSettings = () => {
    void Linking.openSettings().catch(() => {
      Alert.alert(
        'Open device settings',
        'Find JanSetu in your device settings and allow notifications.',
      );
    });
  };

  const confirmSignOut = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm('Sign out of JanSetu?')) {
        void signOut().then(() => router.replace('/(auth)/login'));
      }
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in with your mobile number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void signOut().then(() => router.replace('/(auth)/login')),
      },
    ]);
  };

  return (
    <Screen hasTabBar>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Profile"
        subtitle="Your citizen details and service activity."
        right={<BackButton mode="home" fallback="/(tabs)" label="Go to Home" />}
      />
      <Card style={styles.identityCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {(user?.name || 'J').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name || 'Citizen'}</Text>
          <Text style={[styles.mobile, { color: colors.mutedForeground }]}>
            {user?.mobile ? `+91 ${user.mobile}` : 'Verified citizen'}
          </Text>
        </View>
        <Feather name="check-circle" size={19} color={colors.success} />
      </Card>

      {stats.isError ? (
        <ErrorNotice
          message={stats.error instanceof Error ? stats.error.message : 'Could not load your summary.'}
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <View style={styles.statRow}>
          <Summary value={stats.data?.total ?? '—'} label="Total issues" />
          <Summary value={stats.data?.resolved ?? '—'} label="Resolved" />
          <Summary value={stats.data?.pending ?? '—'} label="Open" />
        </View>
      )}

      <Card style={{ padding: 0 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Citizen details</Text>
        <ProfileRow label="Mobile" value={user?.mobile ? `+91 ${user.mobile}` : undefined} />
        <ProfileRow label="Gender" value={user?.gender} />
        <ProfileRow label="Area type" value={user?.region_type} />
        <ProfileRow label="House number" value={user?.house_number} />
        <ProfileRow label="Address" value={user?.address} last />
      </Card>

      <ActionButton
        title="View my household"
        icon="home"
        variant="outline"
        onPress={() => router.push('/my-household')}
      />

      <ActionButton
        title="Manage family links"
        icon="users"
        variant="outline"
        onPress={() => router.push('/family')}
      />

      <ActionButton
        title="Change password"
        icon="lock"
        variant="outline"
        onPress={() => router.push('/change-password')}
      />

      <Card style={styles.notificationCard}>
        <View style={styles.notificationHeading}>
          <View style={[styles.notificationIcon, { backgroundColor: colors.infoBackground }]}>
            <Feather name="bell" size={17} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.notificationTitle, { color: colors.foreground }]}>
              Notification preferences
            </Text>
            <Text style={[styles.notificationBody, { color: colors.mutedForeground }]}>
              Choose which push alerts you receive. Turning a category off keeps messages in your in-app inbox.
            </Text>
          </View>
        </View>
        {NOTIFICATION_CATEGORIES.map(({ key, label, description }) => {
          const enabled = !!notificationPreferences.data?.[key] && !!savedPushToken.data;
          return (
            <View key={key} style={[styles.preferenceRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notificationTitle, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.notificationBody, { color: colors.mutedForeground }]}>{description}</Text>
              </View>
              <Switch
                accessibilityLabel={label}
                testID={`notification-pref-${key}`}
                value={enabled}
                onValueChange={(value) => changeNotificationSetting(key, value)}
                disabled={
                  Platform.OS === 'web' ||
                  notificationMutation.isPending ||
                  notificationPreferences.isLoading ||
                  notificationPreferences.isError ||
                  savedPushToken.isLoading
                }
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          );
        })}
        {notificationError ? (
          <View style={styles.notificationFeedback}>
            <Text style={[styles.notificationBody, { color: colors.destructive, flex: 1 }]}>
              {notificationError}
            </Text>
            {notificationError.includes('device settings') ? (
              <Text
                accessibilityRole="button"
                onPress={openNotificationSettings}
                style={[styles.settingsLink, { color: colors.primary }]}
              >
                Settings
              </Text>
            ) : null}
          </View>
        ) : Platform.OS === 'web' ? (
          <Text style={[styles.notificationBody, { color: colors.mutedForeground }]}>
            Open JanSetu on your phone to manage push alerts.
          </Text>
        ) : null}
        {notificationPreferences.isError || savedPushToken.isError ? (
          <ErrorNotice message="Could not load your notification setting. Try again later." />
        ) : null}
      </Card>

      <ActionButton
        title="Sign out"
        icon="log-out"
        variant="outline"
        onPress={confirmSignOut}
      />
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        JanSetu citizen app
      </Text>
    </Screen>
  );
}

function Summary({ value, label }: { value: number | string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.summaryValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ProfileRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.profileRow,
        { borderBottomColor: colors.border },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value || 'Not provided'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 22 },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  mobile: { fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 3 },
  statRow: { flexDirection: 'row', gap: 9 },
  summary: { flex: 1, minHeight: 78, borderWidth: 1, borderRadius: 13, padding: 12, justifyContent: 'center' },
  summaryValue: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  summaryLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 3 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17, padding: 16, paddingBottom: 6 },
  profileRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 11, gap: 3 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { fontFamily: 'Manrope_500Medium', fontSize: 13 },
  notificationCard: { gap: 12 },
  notificationHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1 },
  notificationIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  notificationTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  notificationBody: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
  notificationFeedback: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsLink: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  footer: { fontFamily: 'Manrope_500Medium', fontSize: 12, textAlign: 'center', marginTop: 2 },
});
