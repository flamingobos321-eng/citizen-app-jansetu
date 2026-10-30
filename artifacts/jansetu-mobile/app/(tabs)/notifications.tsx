import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  SectionHeading,
} from '@/components/ui';
import {
  apiRequest,
  markAllPushNotificationsRead,
  markPushNotificationRead,
  type NotificationItem,
  type PushInboxResponse,
  type PushNotification,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

const inboxQueryKey = (token: string | null) => ['push-inbox', token] as const;

export default function NotificationsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const announcements = useQuery({
    queryKey: ['citizen-notifications', token],
    queryFn: () => apiRequest<NotificationItem[]>('/notifications', { token }),
    enabled: !!token,
  });
  const inbox = useQuery({
    queryKey: inboxQueryKey(token),
    queryFn: () => apiRequest<PushInboxResponse>('/push/inbox?limit=200', { token }),
    enabled: !!token,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => {
      if (!token) throw new Error('Sign in again to open this alert.');
      return markPushNotificationRead(id, token);
    },
    onSuccess: (_result, id) => {
      queryClient.setQueryData<PushInboxResponse>(inboxQueryKey(token), (current) => {
        if (!current) return current;
        const wasUnread = current.notifications.some((item) => item.id === id && !item.read);
        return {
          ...current,
          unread_count: Math.max(0, current.unread_count - Number(wasUnread)),
          notifications: current.notifications.map((item) =>
            item.id === id ? { ...item, read: true } : item,
          ),
        };
      });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('Sign in again to clear your issue alerts.');
      return markAllPushNotificationsRead(token);
    },
    onSuccess: () => {
      queryClient.setQueryData<PushInboxResponse>(inboxQueryKey(token), (current) => {
        if (!current) return current;
        return {
          ...current,
          unread_count: 0,
          notifications: current.notifications.map((item) => ({ ...item, read: true })),
        };
      });
    },
  });

  const refresh = () => Promise.all([inbox.refetch(), announcements.refetch()]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={inbox.isRefetching || announcements.isRefetching}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="FROM YOUR OFFICE"
        title="Updates"
        subtitle="Issue alerts and announcements from your representative's office."
      />
      <View style={styles.section}>
        <View style={styles.headingRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Issue alerts</Text>
          {inbox.data?.unread_count ? (
            <View style={styles.alertActions}>
              <View style={[styles.unreadCount, { backgroundColor: colors.infoBackground }]}>
                <Text style={[styles.unreadCountText, { color: colors.info }]}>
                  {inbox.data.unread_count} unread
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all issue alerts as read"
                accessibilityState={{ disabled: markAllRead.isPending }}
                disabled={markAllRead.isPending}
                onPress={() => markAllRead.mutate()}
                testID="mark-all-issue-alerts-read"
                style={({ pressed }) => [
                  styles.markAllReadButton,
                  { opacity: markAllRead.isPending ? 0.6 : pressed ? 0.7 : 1 },
                ]}
              >
                {markAllRead.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.markAllReadText, { color: colors.primary }]}>
                    Mark all read
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
        {inbox.isLoading ? (
          <View style={styles.loading}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_500Medium' }}>
              Loading issue alerts…
            </Text>
          </View>
        ) : inbox.isError ? (
          <ErrorNotice
            message={inbox.error instanceof Error ? inbox.error.message : 'Could not load issue alerts.'}
            onRetry={() => void inbox.refetch()}
          />
        ) : inbox.data?.notifications.length ? (
          <View style={{ gap: 11 }}>
            {inbox.data.notifications.map((item) => (
              <PushNotificationCard
                key={item.id}
                item={item}
                onPress={() => {
                  if (!item.read) markRead.mutate(item.id);
                  const issueId = getIssueId(item);
                  if (issueId) router.push(`/issues/${encodeURIComponent(issueId)}`);
                }}
              />
            ))}
          </View>
        ) : (
          <Card style={styles.emptyFeed}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Issue progress alerts will appear here.
            </Text>
          </Card>
        )}
        {markRead.isError ? (
          <ErrorNotice
            message="This alert could not be marked as read. Try again by opening it."
            onRetry={() => {
              if (markRead.variables) markRead.mutate(markRead.variables);
            }}
          />
        ) : null}
        {markAllRead.isError ? (
          <ErrorNotice
            message="Issue alerts could not be marked as read. Please try again."
            onRetry={() => markAllRead.mutate()}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeading title="Office announcements" />
        {announcements.isLoading ? (
          <View style={styles.loading}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_500Medium' }}>
              Loading announcements…
            </Text>
          </View>
        ) : announcements.isError ? (
          <ErrorNotice
            message={
              announcements.error instanceof Error
                ? announcements.error.message
                : 'Could not load office announcements.'
            }
            onRetry={() => void announcements.refetch()}
          />
        ) : announcements.data?.length ? (
          <View style={{ gap: 11 }}>
            {announcements.data.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="bell"
            title="No announcements yet"
            body="Your office announcements will appear here when they are shared."
          />
        )}
      </View>
    </Screen>
  );
}

function PushNotificationCard({
  item,
  onPress,
}: {
  item: PushNotification;
  onPress: () => void;
}) {
  const colors = useColors();
  const issueId = getIssueId(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Unread alert. '}${item.title}${issueId ? '. Open issue details.' : ''}`}
      accessibilityState={{ selected: !item.read }}
      onPress={onPress}
      testID={`push-notification-${item.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Card style={[styles.card, !item.read && { borderColor: colors.primary }]}>
        <View
          style={[
            styles.icon,
            { backgroundColor: item.read ? colors.secondary : colors.infoBackground },
          ]}
        >
          <Feather
            name={issueId ? 'file-text' : 'bell'}
            size={16}
            color={item.read ? colors.mutedForeground : colors.info}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.metaRow}>
            <View style={styles.kindRow}>
              {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
              <Text style={[styles.kind, { color: item.read ? colors.mutedForeground : colors.info }]}>
                {item.kind.replace(/[_-]/g, ' ')}
              </Text>
            </View>
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{item.body}</Text>
          {issueId ? (
            <View style={styles.openIssue}>
              <Text style={[styles.openIssueText, { color: colors.primary }]}>View issue</Text>
              <Feather name="arrow-up-right" size={13} color={colors.primary} />
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function AnnouncementCard({ item }: { item: NotificationItem }) {
  const colors = useColors();
  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.infoBackground }]}>
        <Feather name="bell" size={16} color={colors.info} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.metaRow}>
          <Text style={[styles.kind, { color: colors.info }]}>{item.notif_type}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{item.body}</Text>
      </View>
    </Card>
  );
}

function getIssueId(item: PushNotification): string | null {
  const fromData = item.data?.issue_id ?? item.data?.issueId;
  if (typeof fromData === 'string' && fromData.trim()) return fromData;
  const routeMatch = item.click_action?.match(/\/issues\/([^/?#]+)/);
  if (!routeMatch?.[1]) return null;
  try {
    return decodeURIComponent(routeMatch[1]);
  } catch {
    return routeMatch[1];
  }
}

const styles = StyleSheet.create({
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 11 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  unreadCount: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  unreadCountText: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
  markAllReadButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  markAllReadText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emptyFeed: { paddingVertical: 17 },
  emptyText: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19 },
  icon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  kind: { fontFamily: 'Manrope_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  date: { fontFamily: 'Manrope_500Medium', fontSize: 11 },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, marginTop: 5 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 20, marginTop: 4 },
  openIssue: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  openIssueText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
});
