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

export default function OfficeWorkspaceScreen() {
  const colors = useColors();
  const { user, token, loading, signOut } = useAuth();
  const issuesQuery = useQuery({
    queryKey: ['office-issues', token, user?.role],
    queryFn: () => apiRequest<Issue[]>('/issues', { token }),
    enabled: !!token && !!user && OFFICE_ROLES.includes(user.role),
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
  summary: {
    flex: 1,
    minHeight: 75,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'center',
  },
  summaryValue: { fontFamily: 'Outfit_700Bold', fontSize: 23 },
  summaryLabel: { fontFamily: 'Manrope_500Medium', fontSize: 10, marginTop: 2 },
  sectionHeader: { marginTop: 2 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  issueCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  issueTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issueCode: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 0.7 },
  issueTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 20, marginTop: 3 },
  issueBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  issueMeta: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 10 },
  moreNote: { textAlign: 'center', fontSize: 11 },
});
