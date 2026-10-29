import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  ErrorNotice,
  PageHeader,
  Screen,
  StatusBadge,
  uiStyles,
} from '@/components/ui';
import { apiRequest, type Issue } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

type IssueDetailResponse = { issue: Issue };

export default function IssueDetailScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['citizen-issue', id, token],
    queryFn: () => apiRequest<IssueDetailResponse>(`/issues/${encodeURIComponent(id)}`, { token }),
    enabled: !!id && !!token,
  });
  const issue = query.data?.issue;

  return (
    <Screen>
      <View style={styles.topline}>
        <Text
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.back, { color: colors.primary }]}
        >
          ‹  Back to issues
        </Text>
      </View>
      {query.isLoading ? (
        <Card>
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading issue details…</Text>
        </Card>
      ) : query.isError ? (
        <ErrorNotice
          message={query.error instanceof Error ? query.error.message : 'Could not load this issue.'}
          onRetry={() => void query.refetch()}
        />
      ) : issue ? (
        <>
          <PageHeader eyebrow={issue.issue_code} title={issue.title} subtitle={issue.category} />
          <Card style={{ gap: 14 }}>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>CURRENT STATUS</Text>
              <StatusBadge status={issue.status} />
            </View>
            <Text style={[uiStyles.body, { color: colors.foreground }]}>{issue.description}</Text>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                Submitted {new Date(issue.created_at).toLocaleDateString()}
              </Text>
            </View>
            {issue.location_address ? (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {issue.location_address}
                </Text>
              </View>
            ) : null}
          </Card>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Progress history</Text>
          {issue.timeline?.length ? (
            <View style={{ gap: 0 }}>
              {issue.timeline.map((event, index) => (
                <View key={`${event.at}-${index}`} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: index === 0 ? colors.primary : colors.border },
                      ]}
                    />
                    {index < (issue.timeline?.length || 0) - 1 ? (
                      <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                  <Card style={styles.timelineCard}>
                    <View style={styles.statusRow}>
                      <Text style={[styles.eventStatus, { color: colors.foreground }]}>
                        {event.status}
                      </Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {new Date(event.at).toLocaleDateString()}
                      </Text>
                    </View>
                    {event.note ? (
                      <Text style={[styles.note, { color: colors.mutedForeground }]}>
                        {event.note}
                      </Text>
                    ) : null}
                  </Card>
                </View>
              ))}
            </View>
          ) : (
            <Card>
              <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
                Your office has not posted a progress update yet.
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topline: { marginLeft: -2 },
  back: { fontFamily: 'Manrope_700Bold', fontSize: 13, paddingVertical: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  meta: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 17 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 19, marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 80 },
  timelineRail: { alignItems: 'center', width: 13 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 },
  timelineLine: { width: 1.5, flex: 1, marginTop: 4, marginBottom: -2 },
  timelineCard: { flex: 1, padding: 13, gap: 5, marginBottom: 8 },
  eventStatus: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  note: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
});
