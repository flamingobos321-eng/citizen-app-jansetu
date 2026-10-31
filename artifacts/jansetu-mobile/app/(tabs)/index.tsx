import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  SectionHeading,
  StatusBadge,
  uiStyles,
} from '@/components/ui';
import { RepresentativeIdentity } from '@/components/RepresentativeIdentity';
import {
  apiRequest,
  type CitizenStats,
  type Issue,
  type NotificationItem,
  type Portal,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const { user, token } = useAuth();
  const stats = useQuery({
    queryKey: ['citizen-stats', token],
    queryFn: () => apiRequest<CitizenStats>('/dashboard/citizen-stats', { token }),
    enabled: !!token,
  });
  const issues = useQuery({
    queryKey: ['citizen-issues', token],
    queryFn: () => apiRequest<Issue[]>('/issues', { token }),
    enabled: !!token,
  });
  const notifications = useQuery({
    queryKey: ['citizen-notifications', token],
    queryFn: () => apiRequest<NotificationItem[]>('/notifications', { token }),
    enabled: !!token,
  });
  const representative = useQuery({
    queryKey: ['citizen-portal', token],
    queryFn: async () => {
      const config = await apiRequest<{ slug?: string | null }>('/me/portal-config', { token });
      if (!config.slug) return null;
      return apiRequest<Portal>(`/portals/${encodeURIComponent(config.slug)}`, { token });
    },
    enabled: !!token,
  });
  const refresh = async () => {
    await Promise.all([
      stats.refetch(),
      issues.refetch(),
      notifications.refetch(),
      representative.refetch(),
    ]);
  };

  return (
    <Screen
      hasTabBar
      contentStyle={{ gap: 22 }}
      refreshControl={
        <RefreshControl
          refreshing={stats.isRefetching || issues.isRefetching || representative.isRefetching}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="NAMASTE"
        title={user?.name?.split(' ')[0] || 'Welcome'}
        subtitle={user?.address || 'Your local civic services, in one place.'}
        right={
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {(user?.name || 'J').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        }
      />

      {representative.isError ? (
        <ErrorNotice
          message="Could not load your representative details."
          onRetry={() => void representative.refetch()}
        />
      ) : representative.data?.politician_name ? (
        <Card>
          <RepresentativeIdentity
            name={representative.data.politician_name}
            subtitle={
              representative.data.designation ||
              representative.data.constituency_name ||
              'Local representative'
            }
          />
        </Card>
      ) : null}

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>YOUR VOICE, YOUR COMMUNITY</Text>
          <Text style={styles.heroTitle}>A better neighborhood starts here.</Text>
          <Text style={styles.heroSub}>
            Report a local issue and follow it through to resolution.
          </Text>
        </View>
        <ActionButton
          title="Raise an issue"
          icon="plus"
          onPress={() => router.push('/issues/new')}
          style={styles.heroButton}
        />
        <Feather name="map" size={96} color="rgba(255,255,255,0.08)" style={styles.heroWatermark} />
      </View>

      {stats.isError ? (
        <ErrorNotice
          message={stats.error instanceof Error ? stats.error.message : 'Could not load your issue summary.'}
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <View style={styles.statsRow}>
          <Stat label="Total" value={stats.data?.total ?? '—'} icon="file-text" />
          <Stat label="Resolved" value={stats.data?.resolved ?? '—'} icon="check-circle" positive />
          <Stat label="Open" value={stats.data?.pending ?? '—'} icon="clock" />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my household and service history"
        onPress={() => router.push('/my-household')}
        style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
      >
        <Card style={styles.householdShortcut}>
          <View style={[styles.householdIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="home" size={18} color={colors.primary} />
          </View>
          <View style={styles.householdText}>
            <Text style={[styles.householdTitle, { color: colors.foreground }]}>My household</Text>
            <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
              Household members and service history
            </Text>
          </View>
          <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
        </Card>
      </Pressable>

      <View style={styles.section}>
        <SectionHeading
          title="Your recent issues"
          action="See all"
          onAction={() => router.push('/(tabs)/issues')}
        />
        {issues.isLoading ? (
          <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading your issues…</Text></Card>
        ) : issues.isError ? (
          <ErrorNotice
            message={issues.error instanceof Error ? issues.error.message : 'Could not load your issues.'}
            onRetry={() => void issues.refetch()}
          />
        ) : issues.data?.length ? (
          <View style={{ gap: 10 }}>
            {issues.data.slice(0, 3).map((issue) => (
              <IssuePreview key={issue.id} issue={issue} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="file-plus"
            title="No issues yet"
            body="When you report a civic issue, its progress will appear here."
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Office updates"
          action="View all"
          onAction={() => router.push('/(tabs)/notifications')}
        />
        {notifications.isLoading ? (
          <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading office updates…</Text></Card>
        ) : notifications.isError ? (
          <ErrorNotice
            message={notifications.error instanceof Error ? notifications.error.message : 'Could not load office updates.'}
            onRetry={() => void notifications.refetch()}
          />
        ) : notifications.data?.length ? (
          <Card style={styles.updateCard}>
            <View style={[styles.updateIcon, { backgroundColor: colors.infoBackground }]}>
              <Feather name="bell" size={17} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.updateTitle, { color: colors.foreground }]}>
                {notifications.data[0].title}
              </Text>
              <Text style={[uiStyles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
                {notifications.data[0].body}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.updateCard}>
            <View style={[styles.updateIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="bell" size={17} color={colors.primary} />
            </View>
            <Text style={[uiStyles.body, { flex: 1, color: colors.mutedForeground }]}>
              No office announcements yet.
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function Stat({
  label,
  value,
  icon,
  positive = false,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Feather.glyphMap;
  positive?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Feather name={icon} size={16} color={positive ? colors.success : colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function IssuePreview({ issue }: { issue: Issue }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push(`/issues/${issue.id}`)}
      style={({ pressed }) => [
        styles.issuePreview,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.issueCode, { color: colors.mutedForeground }]}>{issue.issue_code}</Text>
        <Text style={[styles.issueTitle, { color: colors.foreground }]} numberOfLines={1}>
          {issue.title}
        </Text>
        <Text style={[styles.issueMeta, { color: colors.mutedForeground }]}>{issue.category}</Text>
      </View>
      <StatusBadge status={issue.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 19 },
  hero: { minHeight: 220, borderRadius: 20, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  heroCopy: { maxWidth: 280, gap: 9 },
  heroEyebrow: { color: '#D5DEEF', fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 27, lineHeight: 32 },
  heroSub: { color: '#DEE5F1', fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 20 },
  heroButton: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', alignSelf: 'flex-start', marginTop: 15 },
  heroWatermark: { position: 'absolute', right: -16, top: 29 },
  householdShortcut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  householdIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  householdText: { flex: 1, gap: 2 },
  householdTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 10, gap: 5 },
  statValue: { fontFamily: 'Outfit_700Bold', fontSize: 21, marginTop: 2 },
  statLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12 },
  section: { gap: 12 },
  issuePreview: { minHeight: 83, borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  issueCode: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.5 },
  issueTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, marginTop: 2 },
  issueMeta: { fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 1 },
  updateCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  updateIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  updateTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, marginBottom: 3 },
});
