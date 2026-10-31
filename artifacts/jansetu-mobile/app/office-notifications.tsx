import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  uiStyles,
} from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Area = { id: string; name: string; kind: 'ward' | 'village' };
type OfficeNotification = {
  id: string;
  title: string;
  body: string;
  notif_type: string;
  scope: string;
  ward_ids?: string[];
  village_ids?: string[];
  recipients_count?: number;
  created_by_name?: string;
  created_at?: string;
};
type PushNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
};
type InboxResult = { notifications: PushNotification[]; unread_count: number };
type Scope = 'all' | 'ward' | 'village';

const STAFF_ROLES = ['admin', 'pa', 'politician'];
const NOTIFICATION_TYPES = [
  'Politician Visit',
  'Public Meeting',
  'Health Camp',
  'Government Scheme',
  'Emergency Notice',
  'Important Announcement',
];

export default function OfficeNotificationsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState(NOTIFICATION_TYPES[5]);
  const [scope, setScope] = useState<Scope>('all');
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  const notificationsQuery = useQuery({
    queryKey: ['office-notifications', token],
    queryFn: () => apiRequest<OfficeNotification[]>('/notifications', { token }),
    enabled: !!token && !!user && STAFF_ROLES.includes(user.role),
  });
  const inboxQuery = useQuery({
    queryKey: ['office-push-inbox', token],
    queryFn: () => apiRequest<InboxResult>('/push/inbox?limit=20', { token }),
    enabled: !!token && !!user && STAFF_ROLES.includes(user.role),
  });
  const areasQuery = useQuery({
    queryKey: ['office-notification-areas', token],
    queryFn: () => apiRequest<Area[]>('/areas', { token }),
    enabled: !!token && !!user && STAFF_ROLES.includes(user.role),
  });
  const sendNotification = useMutation({
    mutationFn: () => {
      if (!title.trim() || !body.trim()) throw new Error('Add a title and message before sending.');
      if (scope === 'ward' && selectedWards.length === 0) throw new Error('Select at least one ward.');
      if (scope === 'village' && selectedVillages.length === 0) throw new Error('Select at least one village.');
      return apiRequest<OfficeNotification>('/notifications', {
        method: 'POST',
        token,
        body: {
          title: title.trim(),
          body: body.trim(),
          notif_type: type,
          scope,
          ward_ids: scope === 'ward' ? selectedWards : [],
          village_ids: scope === 'village' ? selectedVillages : [],
        },
      });
    },
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setScope('all');
      setSelectedWards([]);
      setSelectedVillages([]);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['office-notifications', token] });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => apiRequest<{ updated: number }>('/push/inbox/read-all', { method: 'POST', token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['office-push-inbox', token] });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!STAFF_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const wards = (areasQuery.data || []).filter((area) => area.kind === 'ward');
  const villages = (areasQuery.data || []).filter((area) => area.kind === 'village');
  const toggleArea = (areaId: string, current: string[], setCurrent: (ids: string[]) => void) => {
    setCurrent(current.includes(areaId) ? current.filter((id) => id !== areaId) : [...current, areaId]);
    setFormError('');
  };
  const refresh = async () => {
    await Promise.all([notificationsQuery.refetch(), inboxQuery.refetch(), areasQuery.refetch()]);
  };
  const submit = () => {
    setFormError('');
    sendNotification.mutate();
  };
  const mutationMessage =
    sendNotification.error instanceof Error ? sendNotification.error.message : 'Could not send notification.';

  return (
    <Screen
      keyboardAware
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={notificationsQuery.isRefetching || inboxQuery.isRefetching}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="OFFICE WORKSPACE"
        title="Notifications"
        subtitle="Review office announcements and send updates to citizens."
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to office"
            onPress={() => router.replace('/office')}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      {inboxQuery.data?.notifications.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your push inbox</Text>
            {inboxQuery.data.unread_count > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  {markAllRead.isPending ? 'Updating…' : 'Mark all read'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {inboxQuery.data.notifications.slice(0, 10).map((notice) => (
            <Card key={notice.id} style={styles.inboxCard}>
              <View style={[styles.inboxIcon, { backgroundColor: notice.read ? colors.secondary : colors.infoBackground }]}>
                <Feather name="bell" size={15} color={notice.read ? colors.primary : colors.info} />
              </View>
              <View style={styles.notificationCopy}>
                <Text style={[styles.notificationTitle, { color: colors.foreground }]}>{notice.title}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{notice.body}</Text>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate(notice.created_at)}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Card style={styles.composer}>
        <View style={styles.sectionHeading}>
          <Feather name="send" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Compose notification</Text>
        </View>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
        <View style={styles.choiceRow}>
          {NOTIFICATION_TYPES.map((item) => {
            const selected = type === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setType(item)}
                style={[styles.choice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
              >
                <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.foreground }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={(value) => { setTitle(value); setFormError(''); }}
          placeholder="Notification title"
          placeholderTextColor={colors.mutedForeground}
          maxLength={120}
          accessibilityLabel="Notification title"
          style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
        />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Message</Text>
        <TextInput
          value={body}
          onChangeText={(value) => { setBody(value); setFormError(''); }}
          placeholder="Write the message for citizens"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          accessibilityLabel="Notification message"
          style={[styles.input, styles.multiline, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
        />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Target audience</Text>
        <View style={styles.scopeRow}>
          {([
            ['all', 'All citizens'],
            ['ward', 'Selected wards'],
            ['village', 'Selected villages'],
          ] as const).map(([value, label]) => {
            const selected = scope === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => { setScope(value); setFormError(''); }}
                style={[styles.scopeChoice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
              >
                <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {scope === 'ward' ? (
          <AreaPicker
            title="Choose wards"
            areas={wards}
            selected={selectedWards}
            onToggle={(id) => toggleArea(id, selectedWards, setSelectedWards)}
            emptyMessage="No wards are configured."
          />
        ) : null}
        {scope === 'village' ? (
          <AreaPicker
            title="Choose villages"
            areas={villages}
            selected={selectedVillages}
            onToggle={(id) => toggleArea(id, selectedVillages, setSelectedVillages)}
            emptyMessage="No villages are configured."
          />
        ) : null}

        {formError ? <ErrorNotice message={formError} /> : null}
        {sendNotification.isError ? <ErrorNotice message={mutationMessage} /> : null}
        <ActionButton
          title="Send notification"
          icon="send"
          onPress={submit}
          loading={sendNotification.isPending}
        />
      </Card>

      {notificationsQuery.isError ? (
        <ErrorNotice
          message={notificationsQuery.error instanceof Error ? notificationsQuery.error.message : 'Could not load office notifications.'}
          onRetry={() => void notificationsQuery.refetch()}
        />
      ) : notificationsQuery.isLoading ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading office announcements…</Text></Card>
      ) : notificationsQuery.data?.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Office announcements</Text>
          {notificationsQuery.data.map((notice) => (
            <Card key={notice.id} style={styles.noticeCard}>
              <View style={styles.noticeMeta}>
                <Text style={[styles.noticeType, { color: colors.primary }]}>{notice.notif_type}</Text>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate(notice.created_at)}</Text>
              </View>
              <Text style={[styles.notificationTitle, { color: colors.foreground }]}>{notice.title}</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>{notice.body}</Text>
              <View style={[styles.noticeFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  Audience: {formatScope(notice, areasQuery.data || [])}
                </Text>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  {notice.recipients_count ?? 0} recipients
                </Text>
              </View>
              {notice.created_by_name ? (
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>By {notice.created_by_name}</Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="bell"
          title="No office announcements"
          body="Notifications sent by your office will appear here."
        />
      )}
    </Screen>
  );
}

function AreaPicker({
  title,
  areas,
  selected,
  onToggle,
  emptyMessage,
}: {
  title: string;
  areas: Area[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyMessage: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {title} ({selected.length} selected)
      </Text>
      {areas.length ? (
        <View style={styles.choiceRow}>
          {areas.map((area) => {
            const active = selected.includes(area.id);
            return (
              <Pressable
                key={area.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onToggle(area.id)}
                style={[styles.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.secondary : colors.card }]}
              >
                <Text style={[styles.choiceText, { color: active ? colors.primary : colors.foreground }]}>{area.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{emptyMessage}</Text>
      )}
    </View>
  );
}

function formatScope(notice: OfficeNotification, areas: Area[]) {
  if (notice.scope === 'all') return 'All citizens';
  const ids = notice.scope === 'ward' ? notice.ward_ids || [] : notice.village_ids || [];
  const labels = ids.map((id) => areas.find((area) => area.id === id)?.name).filter(Boolean);
  return labels.length ? `${notice.scope === 'ward' ? 'Wards' : 'Villages'}: ${labels.join(', ')}` : notice.scope;
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN');
}

const styles = StyleSheet.create({
  backButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  composer: { gap: 11 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  multiline: { minHeight: 104, paddingTop: 12, textAlignVertical: 'top' },
  scopeRow: { gap: 8 },
  scopeChoice: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 36, borderWidth: 1, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 11 },
  choiceText: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  actionText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  inboxCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  inboxIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, gap: 3 },
  notificationTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  dateText: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  noticeCard: { gap: 7 },
  noticeMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  noticeType: { fontFamily: 'Manrope_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  noticeFooter: { borderTopWidth: 1, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
});
