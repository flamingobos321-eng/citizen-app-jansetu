import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ErrorNotice, PageHeader, Screen } from '@/components/ui';
import { apiRequest, type NotificationItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

export default function NotificationsScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['citizen-notifications', token],
    queryFn: () => apiRequest<NotificationItem[]>('/notifications', { token }),
    enabled: !!token,
  });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="FROM YOUR OFFICE"
        title="Updates"
        subtitle="Announcements and service information from your representative's office."
      />
      {query.isLoading ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_500Medium' }}>
            Loading updates…
          </Text>
        </View>
      ) : query.isError ? (
        <ErrorNotice
          message={query.error instanceof Error ? query.error.message : 'Could not load updates.'}
          onRetry={() => void query.refetch()}
        />
      ) : query.data?.length ? (
        <View style={{ gap: 11 }}>
          {query.data.map((item) => <NotificationCard key={item.id} item={item} />)}
        </View>
      ) : (
        <EmptyState
          icon="bell"
          title="No updates yet"
          body="Your office announcements will appear here when they are shared."
        />
      )}
    </Screen>
  );
}

function NotificationCard({ item }: { item: NotificationItem }) {
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

const styles = StyleSheet.create({
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kind: { fontFamily: 'Manrope_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 },
  date: { fontFamily: 'Manrope_500Medium', fontSize: 10 },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, marginTop: 5 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 20, marginTop: 4 },
});
