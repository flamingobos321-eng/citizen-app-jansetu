import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  StatusBadge,
  uiStyles,
} from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type HouseholdIssue = {
  id: string;
  citizen_id?: string;
  issue_code: string;
  title: string;
  category?: string;
  status: string;
  created_at?: string;
};

type HouseholdRecord = {
  household: {
    id: string;
    household_code?: string;
    family_head_name?: string;
    house_number?: string;
    region_type?: string;
    address?: string;
  };
  members: Array<{ id: string; name: string; gender?: string }>;
  issues: HouseholdIssue[];
  benefits: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    location?: string;
  }>;
  stats: { total: number; resolved: number; pending: number };
};

export default function MyHouseholdScreen() {
  const colors = useColors();
  const { user, token, loading } = useAuth();
  const householdQuery = useQuery({
    queryKey: ['my-household', token, user?.household_id],
    queryFn: () =>
      apiRequest<HouseholdRecord>(
        `/households/${encodeURIComponent(user!.household_id!)}`,
        { token },
      ),
    enabled: !!token && user?.role === 'citizen' && !!user.household_id,
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (user?.role !== 'citizen') return <Redirect href="/office" />;

  const household = householdQuery.data?.household;
  const refresh = () => householdQuery.refetch();

  return (
    <Screen
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={householdQuery.isRefetching}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="YOUR RECORD"
        title="My household"
        subtitle="Household details and service requests linked to your family."
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      {!user.household_id ? (
        <EmptyState
          icon="home"
          title="No household linked"
          body="Your citizen profile is not linked to a household yet. Contact your local office to check or update your record."
        />
      ) : householdQuery.error instanceof ApiError && householdQuery.error.status === 404 ? (
        <EmptyState
          icon="home"
          title="Household record not found"
          body="Your profile is linked to a household record that is not available. Contact your local office to verify the household link."
        />
      ) : householdQuery.isError ? (
        <ErrorNotice
          message={
            householdQuery.error instanceof Error
              ? householdQuery.error.message
              : 'Could not load your household record.'
          }
          onRetry={() => void householdQuery.refetch()}
        />
      ) : householdQuery.isLoading || !householdQuery.data ? (
        <Card>
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
            Loading your household…
          </Text>
        </Card>
      ) : (
        <>
          <Card style={styles.householdCard}>
            <View style={[styles.houseIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="home" size={20} color={colors.primary} />
            </View>
            <View style={styles.householdCopy}>
              <Text style={[styles.code, { color: colors.primary }]}>
                {household?.household_code || 'HOUSEHOLD'}
              </Text>
              <Text style={[styles.familyName, { color: colors.foreground }]}>
                {household?.family_head_name || 'Family household'}
              </Text>
              <Text style={[styles.address, { color: colors.mutedForeground }]}>
                {[household?.house_number, household?.region_type, household?.address]
                  .filter(Boolean)
                  .join(' · ') || 'Address not recorded'}
              </Text>
            </View>
          </Card>

          <View style={styles.statsRow} accessibilityLabel="Household service summary">
            <SummaryMetric label="Requests" value={householdQuery.data.stats.total} />
            <SummaryMetric label="Resolved" value={householdQuery.data.stats.resolved} />
            <SummaryMetric label="Open" value={householdQuery.data.stats.pending} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Household members
            </Text>
            {householdQuery.data.members.length ? (
              householdQuery.data.members.map((member) => {
                const isCurrentUser = member.id === user.id;
                return (
                  <Card key={member.id} style={styles.memberCard}>
                    <View style={[styles.memberIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name="user" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.memberCopy}>
                      <Text style={[styles.memberName, { color: colors.foreground }]}>
                        {member.name}
                      </Text>
                      <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
                        {isCurrentUser ? 'You' : 'Household member'}
                      </Text>
                    </View>
                    {isCurrentUser ? (
                      <Feather name="check-circle" size={17} color={colors.success} />
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon="users"
                title="No members listed"
                body="There are no other household members recorded."
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Approved development benefits
            </Text>
            {householdQuery.data.benefits.length ? (
              householdQuery.data.benefits.map((benefit) => (
                <Card key={benefit.id} style={styles.benefitCard}>
                  <View style={[styles.memberIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="award" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.memberCopy}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>
                      {benefit.title}
                    </Text>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
                      {[benefit.category, benefit.location].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <StatusBadge status={benefit.status} />
                </Card>
              ))
            ) : (
              <EmptyState
                icon="award"
                title="No approved benefits recorded"
                body="Approved local development projects will appear here."
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Household service history
            </Text>
            {householdQuery.data.issues.length ? (
              householdQuery.data.issues.map((issue) => {
                const isOwnIssue = issue.citizen_id === user.id;
                const content = (
                  <Card style={styles.issueCard}>
                    <View style={styles.issueCopy}>
                      <Text style={[styles.issueCode, { color: colors.mutedForeground }]}>
                        {issue.issue_code}
                      </Text>
                      <Text
                        style={[styles.issueTitle, { color: colors.foreground }]}
                        numberOfLines={2}
                      >
                        {issue.title}
                      </Text>
                      <Text style={[styles.issueMeta, { color: colors.mutedForeground }]}>
                        {[issue.category, formatDate(issue.created_at), isOwnIssue ? 'Submitted by you' : 'Household request']
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.issueTrailing}>
                      <StatusBadge status={issue.status} />
                      {isOwnIssue ? (
                        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                      ) : null}
                    </View>
                  </Card>
                );

                return isOwnIssue ? (
                  <Pressable
                    key={issue.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open your service request ${issue.issue_code}`}
                    onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View key={issue.id}>{content}</View>
                );
              })
            ) : (
              <EmptyState
                icon="file-text"
                title="No service requests yet"
                body="Requests raised by your household will appear here."
              />
            )}
          </View>
          <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
            Household details are visible only to members linked to this household and authorized office staff.
          </Text>
        </>
      )}
    </Screen>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <Card style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  householdCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  houseIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  householdCopy: { flex: 1, gap: 3 },
  code: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.5 },
  familyName: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  address: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 6 },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  metricLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, textAlign: 'center' },
  section: { gap: 9 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberCopy: { flex: 1, gap: 2 },
  memberName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  memberMeta: { fontFamily: 'Manrope_400Regular', fontSize: 11 },
  issueCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  issueCopy: { flex: 1, gap: 3 },
  issueCode: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, letterSpacing: 0.3 },
  issueTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  issueMeta: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  issueTrailing: { alignItems: 'flex-end', gap: 5 },
  privacyNote: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
