import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ErrorNotice, PageHeader, Screen, StatusBadge, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type HouseholdDetail = {
  household: {
    id: string;
    household_code: string;
    family_head_name: string;
    house_number?: string;
    region_type?: string;
    address?: string;
  };
  members: Array<{ id: string; name: string; mobile?: string; gender?: string; relation?: string }>;
  issues: Array<{ id: string; issue_code: string; title: string; status: string; created_at?: string }>;
  benefits: Array<{ id: string; title: string; category: string; status: string }>;
  stats: { total: number; resolved: number; pending: number };
};
const DIRECTORY_ROLES = ['admin', 'pa', 'politician'];

export default function HouseholdDetailScreen() {
  const colors = useColors();
  const { user, token, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['household-detail', token, id],
    queryFn: () => apiRequest<HouseholdDetail>(`/households/${encodeURIComponent(id)}`, { token }),
    enabled: !!token && !!id && !!user && DIRECTORY_ROLES.includes(user.role),
  });
  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!DIRECTORY_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const data = query.data;
  return (
    <Screen contentStyle={{ gap: 14 }}>
      <PageHeader
        eyebrow="HOUSEHOLD PROFILE"
        title={data?.household.family_head_name || 'Household'}
        subtitle={data?.household.household_code || 'Loading household details'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to households"
            onPress={() => router.replace('/households')}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />
      {query.isError ? (
        <ErrorNotice message={query.error instanceof Error ? query.error.message : 'Could not load this household.'} onRetry={() => void query.refetch()} />
      ) : query.isLoading || !data ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading household details…</Text></Card>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <View style={styles.codeRow}>
              <Feather name="home" size={17} color={colors.primary} />
              <Text style={[styles.code, { color: colors.primary }]}>{data.household.household_code}</Text>
            </View>
            <InfoRow label="House number" value={data.household.house_number} />
            <InfoRow label="Region" value={data.household.region_type} />
            <InfoRow label="Address" value={data.household.address} />
          </Card>

          <View style={styles.statsRow}>
            <Metric label="Issues" value={data.stats.total} />
            <Metric label="Resolved" value={data.stats.resolved} />
            <Metric label="Pending" value={data.stats.pending} />
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members ({data.members.length})</Text>
            {data.members.length ? data.members.map((member) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${member.name}'s profile`}
                onPress={() => router.push(`/persons/${encodeURIComponent(member.id)}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <Card style={styles.memberCard}>
                  <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                    <Feather name="user" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{member.name}</Text>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
                      {[member.mobile, member.gender, member.relation].filter(Boolean).join(' · ') || 'Member'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Card>
              </Pressable>
            )) : <EmptyState icon="users" title="No members listed" body="Household members will appear here." />}
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Service history ({data.issues.length})</Text>
            {data.issues.length ? data.issues.map((issue) => (
              <Pressable
                key={issue.id}
                accessibilityRole="button"
                accessibilityLabel={`Open issue ${issue.issue_code}`}
                onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <Card style={styles.issueCard}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.issueCode, { color: colors.mutedForeground }]}>{issue.issue_code}</Text>
                    <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={2}>{issue.title}</Text>
                  </View>
                  <StatusBadge status={issue.status} />
                </Card>
              </Pressable>
            )) : <EmptyState icon="file-text" title="No issues raised" body="Household service requests will appear here." />}
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Development benefits ({data.benefits.length})</Text>
            {data.benefits.length ? data.benefits.map((benefit) => (
              <Card key={benefit.id} style={styles.benefitCard}>
                <Feather name="award" size={17} color={colors.primary} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{benefit.title}</Text>
                  <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>{benefit.category}</Text>
                </View>
                <StatusBadge status={benefit.status} />
              </Card>
            )) : <EmptyState icon="award" title="No benefits recorded" body="Approved local projects for this area will appear here." />}
          </View>
        </>
      )}
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value || '—'}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <Card style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Manrope_500Medium', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12 },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 22 },
  metricLabel: { fontFamily: 'Manrope_500Medium', fontSize: 11 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  memberMeta: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 16 },
  issueCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  issueCode: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  benefitCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
