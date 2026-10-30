import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Alert, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  StatusBadge,
  uiStyles,
} from '@/components/ui';
import { apiRequest, type Issue } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

const OFFICE_ROLES = ['admin', 'pa', 'politician', 'worker'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Office admin',
  pa: 'Personal assistant',
  politician: 'Representative',
  worker: 'Field worker',
};

type OfficeDashboardStats = {
  total_citizens: number;
  total_households: number;
  total_issues: number;
  total_workers: number;
};

export default function OfficeWorkspaceScreen() {
  const colors = useColors();
  const { user, token, loading, signOut } = useAuth();
  const issuesQuery = useQuery({
    queryKey: ['office-issues', token, user?.role],
    queryFn: () => apiRequest<Issue[]>('/issues', { token }),
    enabled: !!token && !!user && OFFICE_ROLES.includes(user.role),
  });
  const dashboardQuery = useQuery({
    queryKey: ['office-dashboard', token],
    queryFn: () => apiRequest<OfficeDashboardStats>('/dashboard/stats', { token }),
    enabled: !!token && !!user && user.role !== 'worker' && OFFICE_ROLES.includes(user.role),
  });

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'citizen') return <Redirect href="/(tabs)" />;
  if (!OFFICE_ROLES.includes(user.role)) {
    return (
      <Screen>
        <PageHeader eyebrow="JANSETU" title="Office access unavailable" />
        <ErrorNotice message="This account does not have access to the mobile office workspace. Use the web portal for platform administration." />
      </Screen>
    );
  }

  const issues = issuesQuery.data || [];
  const activeCount = issues.filter((issue) => !['Resolved', 'Closed'].includes(issue.status)).length;
  const inProgressCount = issues.filter((issue) => issue.status === 'In Progress').length;
  const resolvedCount = issues.filter((issue) => issue.status === 'Resolved').length;

  const handleSignOut = () => {
    const finishSignOut = () => {
      void signOut().then(() => router.replace('/(auth)/login'));
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Sign out of JanSetu?')) finishSignOut();
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in with your office account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: finishSignOut },
    ]);
  };

  return (
    <Screen
      contentStyle={{ gap: 18 }}
      refreshControl={
        <RefreshControl
          refreshing={issuesQuery.isRefetching}
          onRefresh={() => void issuesQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <PageHeader
          eyebrow="OFFICE WORKSPACE"
          title={`Namaste, ${user.name?.split(' ')[0] || 'team'}`}
          subtitle={`${ROLE_LABELS[user.role]}. Your access is limited to your office and assigned work.`}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={handleSignOut}
              style={[styles.signOutButton, { borderColor: colors.border }]}
            >
              <Feather name="log-out" size={17} color={colors.primary} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.statsRow}>
        <Summary label={user.role === 'worker' ? 'Assigned' : 'Active'} value={activeCount} />
        <Summary label="In progress" value={inProgressCount} />
        <Summary label="Resolved" value={resolvedCount} />
      </View>

      {dashboardQuery.data ? (
        <View style={styles.overviewGrid}>
          <OverviewMetric label="Citizens" value={dashboardQuery.data.total_citizens} />
          <OverviewMetric label="Households" value={dashboardQuery.data.total_households} />
          <OverviewMetric label="All issues" value={dashboardQuery.data.total_issues} />
          <OverviewMetric label="Field workers" value={dashboardQuery.data.total_workers} />
        </View>
      ) : null}

      {dashboardQuery.isError ? (
        <ErrorNotice
          message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Could not load office summary.'}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}

      {user.role !== 'worker' ? (
        <View style={styles.shortcutGrid}>
          <FeatureLink
            icon="calendar"
            title="Visits & camps"
            subtitle="Schedule and approve office visits"
            onPress={() => router.push('/visits')}
          />
          <FeatureLink
            icon="tool"
            title="Development works"
            subtitle="Manage local project progress"
            onPress={() => router.push('/devworks')}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {user.role === 'worker' ? 'Your assigned issues' : 'Office issues'}
          </Text>
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
            {user.role === 'politician'
              ? 'Monitor requests from your constituency.'
              : 'Review issue details and progress.'}
          </Text>
        </View>
      </View>

      {issuesQuery.isLoading ? (
        <Card>
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
            Loading your office queue…
          </Text>
        </Card>
      ) : issuesQuery.isError ? (
        <ErrorNotice
          message={
            issuesQuery.error instanceof Error
              ? issuesQuery.error.message
              : 'Could not load office issues.'
          }
          onRetry={() => void issuesQuery.refetch()}
        />
      ) : issues.length ? (
        <View style={{ gap: 10 }}>
          {issues.slice(0, 30).map((issue) => (
            <Pressable
              key={issue.id}
              accessibilityRole="button"
              accessibilityLabel={`${issue.issue_code}: ${issue.title}. Status ${issue.status}. Open issue details.`}
              accessibilityHint="Opens this issue's details."
              onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)}
              style={({ pressed }) => [
                styles.issueCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <View style={styles.issueTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.issueCode, { color: colors.mutedForeground }]}>
                    {issue.issue_code}
                  </Text>
                  <Text style={[styles.issueTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {issue.title}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </View>
              <View style={styles.issueBottom}>
                <Text style={[styles.issueMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {issue.category} · {new Date(issue.created_at).toLocaleDateString()}
                </Text>
                <StatusBadge status={issue.status} />
              </View>
            </Pressable>
          ))}
          {issues.length > 30 ? (
            <Text style={[uiStyles.body, styles.moreNote, { color: colors.mutedForeground }]}>
              Showing the 30 most recent issues. Refresh to check for updates.
            </Text>
          ) : null}
        </View>
      ) : (
        <EmptyState
          icon="check-circle"
          title="No issues in your queue"
          body={
            user.role === 'worker'
              ? 'New issues assigned to you will appear here.'
              : 'Constituency issues will appear here when citizens submit them.'
          }
        />
      )}
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function OverviewMetric({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={[styles.overviewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.overviewValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function FeatureLink({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.featureLink,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Feather name={icon} size={19} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.featureTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.featureSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  signOutButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  statsRow: { flexDirection: 'row', gap: 9 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  overviewCard: { width: '48%', minHeight: 68, borderWidth: 1, borderRadius: 14, padding: 11, justifyContent: 'center' },
  overviewValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  overviewLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 2 },
  shortcutGrid: { gap: 9 },
  featureLink: { minHeight: 64, borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  featureTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  featureSubtitle: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  summary: {
    flex: 1,
    minHeight: 75,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'center',
  },
  summaryValue: { fontFamily: 'Outfit_700Bold', fontSize: 23 },
  summaryLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 2 },
  sectionHeader: { marginTop: 2 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  issueCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  issueTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issueCode: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.6 },
  issueTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 20, marginTop: 3 },
  issueBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  issueMeta: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 12 },
  moreNote: { textAlign: 'center', fontSize: 12 },
});
