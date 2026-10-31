import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  ActionButton,
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

export default function IssuesScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['citizen-issues', token],
    queryFn: () => apiRequest<Issue[]>('/issues', { token }),
    enabled: !!token,
  });

  return (
    <Screen
      hasTabBar
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="CIVIC REQUESTS"
        title="Your issues"
        subtitle="Track every report from submission to resolution."
      />
      <ActionButton
        title="Raise a new issue"
        icon="plus"
        onPress={() => router.push('/issues/new')}
      />
      {query.isLoading ? (
        <View style={styles.loading}>
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading your reports…</Text>
        </View>
      ) : query.isError ? (
        <ErrorNotice
          message={query.error instanceof Error ? query.error.message : 'Could not load your issues.'}
          onRetry={() => void query.refetch()}
        />
      ) : query.data?.length ? (
        <View style={{ gap: 11 }}>
          {query.data.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="file-plus"
          title="Nothing reported yet"
          body="If you spot a local issue, send it to your office and follow the updates here."
        />
      )}
    </Screen>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.issue_code}: ${issue.title}. Status ${issue.status}. Open issue details.`}
      accessibilityHint="Opens this issue's details."
      onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)}
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.code, { color: colors.mutedForeground }]}>{issue.issue_code}</Text>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {issue.title}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
      <View style={styles.cardBottom}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {issue.category} · {new Date(issue.created_at).toLocaleDateString()}
        </Text>
        <StatusBadge status={issue.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 15, gap: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.6 },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 21, marginTop: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { fontFamily: 'Manrope_500Medium', fontSize: 12, flex: 1 },
});
