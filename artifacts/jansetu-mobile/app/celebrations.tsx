import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
} from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type PersonEvent = {
  id: string;
  name: string;
  mobile?: string;
  ward_id?: string;
  village_id?: string;
  dob?: string;
  anniversary?: string;
  date_of_death?: string;
  in_days?: number;
};
type EventGroup = { today: PersonEvent[]; upcoming: PersonEvent[] };
type Celebrations = {
  birthdays: EventGroup;
  anniversaries: EventGroup;
  remembrance: EventGroup;
};
type Area = { id: string; name: string; kind?: string };

const STAFF_ROLES = ['admin', 'pa', 'politician'];

export default function CelebrationsScreen() {
  const colors = useColors();
  const { user, token, loading } = useAuth();
  const celebrationsQuery = useQuery({
    queryKey: ['office-celebrations', token],
    queryFn: () => apiRequest<Celebrations>('/dashboard/celebrations?days=7', { token }),
    enabled: !!token && !!user && STAFF_ROLES.includes(user.role),
  });
  const areasQuery = useQuery({
    queryKey: ['office-area-labels', token],
    queryFn: () => apiRequest<Area[]>('/areas', { token }),
    enabled: !!token && !!user && STAFF_ROLES.includes(user.role),
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!STAFF_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const data = celebrationsQuery.data;
  const areaName = (id?: string) => areasQuery.data?.find((area) => area.id === id)?.name || '';
  const categories = data
    ? [
        { key: 'birthday-today', title: "Today's birthdays", icon: 'gift' as const, people: data.birthdays.today, dateLabel: (person: PersonEvent) => `Age ${age(person.dob)}` },
        { key: 'birthday-upcoming', title: 'Birthdays this week', icon: 'gift' as const, people: data.birthdays.upcoming, dateLabel: (person: PersonEvent) => `${daysAway(person.in_days)} · Age ${age(person.dob)}` },
        { key: 'anniversary-today', title: "Today's anniversaries", icon: 'heart' as const, people: data.anniversaries.today, dateLabel: () => 'Today' },
        { key: 'anniversary-upcoming', title: 'Anniversaries this week', icon: 'heart' as const, people: data.anniversaries.upcoming, dateLabel: (person: PersonEvent) => daysAway(person.in_days) },
        { key: 'remembrance', title: 'Remembrance', icon: 'sunset' as const, people: [...data.remembrance.today, ...data.remembrance.upcoming], dateLabel: (person: PersonEvent) => person.in_days ? `${daysAway(person.in_days)} · ${person.date_of_death || ''}` : `Today · ${person.date_of_death || ''}` },
      ].filter((category) => category.people.length > 0)
    : [];

  return (
    <Screen
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={celebrationsQuery.isRefetching || areasQuery.isRefetching}
          onRefresh={() => void Promise.all([celebrationsQuery.refetch(), areasQuery.refetch()])}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow="OFFICE WORKSPACE"
        title="Celebrations"
        subtitle="Birthdays, anniversaries, and remembrance dates for your constituency."
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

      {celebrationsQuery.isError ? (
        <ErrorNotice
          message={celebrationsQuery.error instanceof Error ? celebrationsQuery.error.message : 'Could not load celebrations.'}
          onRetry={() => void celebrationsQuery.refetch()}
        />
      ) : celebrationsQuery.isLoading || !data ? (
        <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading celebrations…</Text></Card>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <Metric label="Birthdays today" value={data.birthdays.today.length} icon="gift" />
            <Metric label="Birthdays soon" value={data.birthdays.upcoming.length} icon="gift" />
            <Metric label="Anniversaries today" value={data.anniversaries.today.length} icon="heart" />
            <Metric label="Anniversaries soon" value={data.anniversaries.upcoming.length} icon="heart" />
            <Metric label="Remembrance" value={data.remembrance.today.length + data.remembrance.upcoming.length} icon="sunset" />
          </View>

          {!categories.length ? (
            <EmptyState
              icon="calendar"
              title="No dates this week"
              body="Birthdays, anniversaries, and remembrance dates coming up in the next seven days will appear here."
            />
          ) : categories.map((category) => (
            <View key={category.key} style={styles.section}>
              <View style={styles.sectionHeading}>
                <Feather name={category.icon} size={17} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{category.title}</Text>
                <Text style={[styles.count, { color: colors.mutedForeground }]}>{category.people.length}</Text>
              </View>
              {category.people.slice(0, 50).map((person) => (
                <Card key={person.id} style={styles.personCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${person.name}'s profile`}
                    onPress={() => router.push(`/persons/${encodeURIComponent(person.id)}`)}
                    style={styles.personCopy}
                  >
                    <Text style={[styles.personName, { color: colors.foreground }]} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {[category.dateLabel(person), person.mobile, areaName(person.ward_id) ? `Ward ${areaName(person.ward_id)}` : '', areaName(person.village_id) ? `Village ${areaName(person.village_id)}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                  {person.mobile && category.key !== 'remembrance' ? (
                    <View style={styles.contactActions}>
                      <ContactButton icon="phone" label={`Call ${person.name}`} url={`tel:${person.mobile}`} />
                      <ContactButton icon="message-circle" label={`Text ${person.name}`} url={`sms:${person.mobile}`} />
                    </View>
                  ) : null}
                </Card>
              ))}
              {category.people.length > 50 ? (
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  Showing 50 of {category.people.length}. Open the website to view the full list.
                </Text>
              ) : null}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: 'gift' | 'heart' | 'sunset' }) {
  const colors = useColors();
  return (
    <Card style={styles.metric}>
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

function ContactButton({ icon, label, url }: { icon: 'phone' | 'message-circle'; label: string; url: string }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={({ pressed }) => [styles.contactButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon} size={16} color={colors.primary} />
    </Pressable>
  );
}

function age(dob?: string) {
  if (!dob) return '—';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '—';
  return `${Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.25 * 86400000)))}`;
}

function daysAway(days?: number) {
  if (days === undefined) return '';
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 3, paddingVertical: 11, paddingHorizontal: 5 },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  metricLabel: { fontFamily: 'Manrope_500Medium', fontSize: 10, textAlign: 'center' },
  section: { gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  count: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  personCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personCopy: { flex: 1, gap: 3 },
  personName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 16 },
  contactActions: { flexDirection: 'row', gap: 7 },
  contactButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
