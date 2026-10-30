import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Card, ErrorNotice, PageHeader, Screen, StatusBadge, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest, type Issue } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Person = {
  id: string;
  name: string;
  mobile?: string;
  gender?: string;
  dob?: string;
  address?: string;
  house_number?: string;
  region_type?: string;
  household_id?: string;
  occupation?: string;
  anniversary?: string;
  status?: string;
  notes?: string;
  created_at?: string;
};
type Relationship = { id?: string; display_type?: string; type?: string; other?: Person };
type Interaction = { id?: string; type?: string; summary?: string; occurred_at?: string; note?: string };
type TimelineEvent = { id?: string; event_type?: string; type?: string; title?: string; label?: string; note?: string; summary?: string; at?: string };
type PersonDetail = {
  person: Person;
  relationships: Relationship[];
  interactions: Interaction[];
  issues: Issue[];
  transfer_banner?: {
    read_only?: boolean;
    reason?: string;
    transferred_at?: string;
    to_organisation?: string | { politician_name?: string; tenant_name?: string; constituency_name?: string; slug?: string };
  };
};
type PersonTimeline = { events: TimelineEvent[] };
type PersonEdit = { occupation: string; anniversary: string; status: string; notes: string };
const DIRECTORY_ROLES = ['admin', 'pa', 'politician'];

export default function PersonProfileScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<PersonEdit | null>(null);
  const detailQuery = useQuery({
    queryKey: ['person-profile', token, id],
    queryFn: () => apiRequest<PersonDetail>(`/persons/${encodeURIComponent(id)}`, { token }),
    enabled: !!token && !!id && !!user && DIRECTORY_ROLES.includes(user.role),
  });
  const timelineQuery = useQuery({
    queryKey: ['person-timeline', token, id],
    queryFn: () => apiRequest<PersonTimeline>(`/persons/${encodeURIComponent(id)}/timeline`, { token }),
    enabled: !!token && !!id && !!user && DIRECTORY_ROLES.includes(user.role),
  });
  const saveProfile = useMutation({
    mutationFn: () => apiRequest<Person>(`/persons/${encodeURIComponent(id)}`, { method: 'PUT', token, body: draft }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['person-profile', token, id] });
      await queryClient.invalidateQueries({ queryKey: ['person-timeline', token, id] });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!DIRECTORY_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const profileData = detailQuery.data;
  const person = profileData?.person;
  const formerOffice = typeof profileData?.transfer_banner?.to_organisation === 'string'
    ? profileData.transfer_banner.to_organisation
    : profileData?.transfer_banner?.to_organisation?.politician_name
      || profileData?.transfer_banner?.to_organisation?.tenant_name
      || profileData?.transfer_banner?.to_organisation?.constituency_name
      || profileData?.transfer_banner?.to_organisation?.slug;
  const canEditProfile = !profileData?.transfer_banner?.read_only;
  const beginEditing = () => {
    if (!person) return;
    setDraft({
      occupation: person.occupation || '',
      anniversary: person.anniversary || '',
      status: person.status || '',
      notes: person.notes || '',
    });
  };

  return (
    <Screen contentStyle={{ gap: 14 }}>
      <PageHeader
        eyebrow="PERSON PROFILE"
        title={person?.name || 'Citizen'}
        subtitle={person?.household_id ? `Household member · ${person.house_number || ''}` : 'Constituency record'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to household"
            onPress={() => person?.household_id ? router.replace(`/households/${encodeURIComponent(person.household_id)}`) : router.replace('/households')}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      {detailQuery.isError ? (
        <ErrorNotice message={detailQuery.error instanceof Error ? detailQuery.error.message : 'Could not load this profile.'} onRetry={() => void detailQuery.refetch()} />
      ) : detailQuery.isLoading || !profileData || !person ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading profile…</Text></Card>
      ) : (
        <>
          {profileData.transfer_banner ? (
            <Card style={[styles.transferCard, { backgroundColor: colors.warningBackground, borderColor: colors.warning }]}>
              <Feather name="info" size={17} color={colors.warning} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>Historical membership record</Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  {profileData.transfer_banner.reason || 'This record is read-only in this office.'}
                  {formerOffice ? ` Former office: ${formerOffice}.` : ''}
                </Text>
              </View>
            </Card>
          ) : null}

          <Card style={{ gap: 11 }}>
            <View style={styles.identityRow}>
              <View style={[styles.personIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="user" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{person.name}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{person.mobile || 'No phone recorded'}</Text>
              </View>
              {person.status ? <StatusBadge status={person.status} /> : null}
            </View>
            <InfoRow label="Gender" value={person.gender} />
            <InfoRow label="Date of birth" value={person.dob} />
            <InfoRow label="Occupation" value={person.occupation} />
            <InfoRow label="Anniversary" value={person.anniversary} />
            <InfoRow label="House number" value={person.house_number} />
            <InfoRow label="Region" value={person.region_type} />
            <InfoRow label="Address" value={person.address} />
          </Card>

          {canEditProfile && draft ? (
            <Card style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Update profile details</Text>
              <EditField label="Occupation" value={draft.occupation} onChange={(value) => setDraft({ ...draft, occupation: value })} />
              <EditField label="Anniversary" value={draft.anniversary} onChange={(value) => setDraft({ ...draft, anniversary: value })} placeholder="YYYY-MM-DD" />
              <EditField label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} />
              <EditField label="Office notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} multiline />
              {saveProfile.isError ? <ErrorNotice message={saveProfile.error instanceof Error ? saveProfile.error.message : 'Could not save profile changes.'} /> : null}
              <View style={styles.buttonRow}>
                <View style={{ flex: 1 }}>
                  <ActionButton title="Save changes" icon="save" onPress={() => saveProfile.mutate()} loading={saveProfile.isPending} />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton title="Cancel" variant="outline" onPress={() => setDraft(null)} disabled={saveProfile.isPending} />
                </View>
              </View>
            </Card>
          ) : canEditProfile ? (
            <ActionButton title="Edit profile details" icon="edit-2" variant="outline" onPress={beginEditing} />
          ) : null}

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Household relationships</Text>
            {profileData.relationships?.length ? profileData.relationships.map((relationship, index) => (
              <Card key={relationship.id || `${relationship.display_type}-${index}`} style={styles.listRow}>
                <Feather name="users" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{relationship.other?.name || 'Family member'}</Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>
                    {relationship.display_type || relationship.type || 'Related'}
                    {relationship.other?.mobile ? ` · ${relationship.other.mobile}` : ''}
                  </Text>
                </View>
              </Card>
            )) : (
              <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>No linked relationships recorded.</Text></Card>
            )}
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Issue history ({profileData.issues.length})</Text>
            {profileData.issues.length ? profileData.issues.map((issue) => (
              <Pressable key={issue.id} onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)} accessibilityRole="button" accessibilityLabel={`Open ${issue.issue_code}`}>
                <Card style={styles.listRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>{issue.issue_code}</Text>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{issue.title}</Text>
                  </View>
                  <StatusBadge status={issue.status} />
                </Card>
              </Pressable>
            )) : <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>No issues recorded for this citizen.</Text></Card>}
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent interactions</Text>
            {profileData.interactions?.length ? profileData.interactions.slice(0, 8).map((interaction, index) => (
              <Card key={interaction.id || `${interaction.type}-${index}`} style={styles.listRow}>
                <Feather name="message-circle" size={15} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{interaction.type || 'Interaction'}</Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>{interaction.summary || interaction.note || 'No note recorded'}</Text>
                </View>
                <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>{interaction.occurred_at || ''}</Text>
              </Card>
            )) : <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>No interactions recorded.</Text></Card>}
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
            {timelineQuery.isError ? (
              <ErrorNotice message="Could not load the timeline." onRetry={() => void timelineQuery.refetch()} />
            ) : timelineQuery.data?.events?.length ? timelineQuery.data.events.slice(0, 12).map((event, index) => (
              <Card key={event.id || `${event.at}-${index}`} style={styles.listRow}>
                <Feather name="clock" size={15} color={colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{event.title || event.label || event.event_type || event.type || 'Activity'}</Text>
                  {event.note || event.summary ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{event.note || event.summary}</Text> : null}
                  <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>{event.at || ''}</Text>
                </View>
              </Card>
            )) : <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>{timelineQuery.isLoading ? 'Loading timeline…' : 'No timeline activity recorded.'}</Text></Card>}
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
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value || '—'}</Text>
    </View>
  );
}

function EditField({
  label, value, onChange, placeholder, multiline = false,
}: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  transferCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  personIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  multilineInput: { minHeight: 78, paddingTop: 11 },
  buttonRow: { flexDirection: 'row', gap: 9 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  memberMeta: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
});
