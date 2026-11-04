import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, BackButton, Card, EmptyState, ErrorNotice, PageHeader, Screen, StatusBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Campaign = {
  id: string;
  name: string;
  campaign_type: string;
  description?: string;
  objectives?: string;
  status: string;
  priority: string;
  response_mode: string;
  start_date?: string;
  end_date?: string;
  total_responses?: number;
  assigned_worker_ids?: string[];
};
type CampaignStats = { total: number; active: number; draft: number; completed: number; total_responses: number };
type CampaignForm = {
  name: string;
  campaign_type: string;
  description: string;
  objectives: string;
  priority: string;
  response_mode: string;
  start_date: string;
  end_date: string;
};
const OFFICE_ROLES = ['admin', 'pa', 'politician'];
const CAMPAIGN_ROLES = [...OFFICE_ROLES, 'worker'];
const CAMPAIGN_TYPES = [
  ['membership_drive', 'Membership'],
  ['opinion_survey', 'Opinion survey'],
  ['citizen_data', 'Citizen data'],
  ['scheme_registration', 'Scheme registration'],
  ['voter_registration', 'Voter registration'],
  ['health_camp', 'Health camp'],
  ['development_inspection', 'Project inspection'],
  ['complaint_followup', 'Complaint follow-up'],
  ['blood_donation', 'Blood donation'],
  ['tree_plantation', 'Tree plantation'],
  ['scholarship_drive', 'Scholarship drive'],
  ['custom', 'Custom'],
  ['booth_strengthening', 'Booth strengthening'],
  ['election_campaign', 'Election campaign'],
  ['voter_awareness', 'Voter awareness'],
  ['event_registration', 'Event registration'],
  ['volunteer_registration', 'Volunteer registration'],
];
const EMPTY_FORM: CampaignForm = {
  name: '',
  campaign_type: 'custom',
  description: '',
  objectives: '',
  priority: 'medium',
  response_mode: 'linked_citizen',
  start_date: '',
  end_date: '',
};

export default function CampaignsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState('');
  const isStaff = OFFICE_ROLES.includes(user?.role || '');
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', token, search, user?.role],
    queryFn: () => apiRequest<Campaign[]>(`/campaigns${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
    enabled: !!token && !!user && CAMPAIGN_ROLES.includes(user.role),
  });
  const statsQuery = useQuery({
    queryKey: ['campaign-stats', token],
    queryFn: () => apiRequest<CampaignStats>('/campaigns/stats', { token }),
    enabled: !!token && !!user && CAMPAIGN_ROLES.includes(user.role),
  });
  const createCampaign = useMutation({
    mutationFn: () =>
      apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        token,
        body: {
          ...form,
          name: form.name.trim(),
          description: form.description.trim() || null,
          objectives: form.objectives.trim() || null,
          start_date: form.start_date.trim() || null,
          end_date: form.end_date.trim() || null,
        },
      }),
    onSuccess: async (campaign) => {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['campaigns', token] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-stats', token] });
      router.push(`/campaigns/${encodeURIComponent(campaign.id)}`);
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!CAMPAIGN_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const updateForm = (key: keyof CampaignForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const submit = () => {
    if (!form.name.trim()) {
      setFormError('Campaign name is required.');
      return;
    }
    createCampaign.mutate();
  };

  return (
    <Screen
      keyboardAware
      contentStyle={{ gap: 14 }}
      refreshControl={
        <RefreshControl refreshing={campaignsQuery.isRefetching} onRefresh={() => void campaignsQuery.refetch()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow={user?.role === 'worker' ? 'FIELD WORKSPACE' : 'OFFICE WORKSPACE'}
        title={user?.role === 'worker' ? 'My campaigns' : 'Campaigns'}
        subtitle={user?.role === 'worker' ? 'Campaigns and field tasks assigned to you.' : 'Field operations, surveys, and community data collection.'}
        right={<BackButton fallback="/office" label="Back to office" testID="campaigns-back" />}
      />
      {isStaff ? (
        <ActionButton
          title={showCreate ? 'Close campaign form' : 'New campaign'}
          icon={showCreate ? 'x' : 'plus'}
          variant={showCreate ? 'outline' : 'primary'}
          onPress={() => setShowCreate((value) => !value)}
          testID="toggle-create-campaign"
        />
      ) : null}

      {statsQuery.data ? (
        <View style={styles.statsRow}>
          <Stat label="Total" value={statsQuery.data.total} />
          <Stat label="Active" value={statsQuery.data.active} />
          <Stat label="Responses" value={statsQuery.data.total_responses} />
        </View>
      ) : null}

      {isStaff && showCreate ? (
        <Card style={{ gap: 11 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create campaign</Text>
          <Field label="Campaign name *" value={form.name} onChangeText={(value) => updateForm('name', value)} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <Chips options={CAMPAIGN_TYPES.map(([value]) => value)} selected={form.campaign_type} onSelect={(value) => updateForm('campaign_type', value)} labels={Object.fromEntries(CAMPAIGN_TYPES)} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Priority</Text>
          <Chips options={['low', 'medium', 'high', 'urgent']} selected={form.priority} onSelect={(value) => updateForm('priority', value)} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Response mode</Text>
          <Chips options={['linked_citizen', 'anonymous', 'optional']} selected={form.response_mode} onSelect={(value) => updateForm('response_mode', value)} labels={{ linked_citizen: 'Link to citizen', anonymous: 'Anonymous', optional: 'Optional link' }} />
          <Field label="Description" value={form.description} onChangeText={(value) => updateForm('description', value)} multiline />
          <Field label="Objectives" value={form.objectives} onChangeText={(value) => updateForm('objectives', value)} multiline />
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}><Field label="Start date" value={form.start_date} onChangeText={(value) => updateForm('start_date', value)} placeholder="YYYY-MM-DD" /></View>
            <View style={{ flex: 1 }}><Field label="End date" value={form.end_date} onChangeText={(value) => updateForm('end_date', value)} placeholder="YYYY-MM-DD" /></View>
          </View>
          {formError ? <ErrorNotice message={formError} /> : null}
          {createCampaign.isError ? <ErrorNotice message={createCampaign.error instanceof Error ? createCampaign.error.message : 'Could not create campaign.'} /> : null}
          <ActionButton title="Create campaign" icon="plus" onPress={submit} loading={createCampaign.isPending} />
        </Card>
      ) : null}

      <Card style={styles.searchCard}>
        <TextInput
          value={draftSearch}
          onChangeText={setDraftSearch}
          onSubmitEditing={() => setSearch(draftSearch.trim())}
          placeholder="Search campaigns"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          accessibilityLabel="Search campaigns"
          style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Search campaigns" onPress={() => setSearch(draftSearch.trim())} style={[styles.searchButton, { backgroundColor: colors.primary }]}>
          <Feather name="search" size={17} color={colors.primaryForeground} />
        </Pressable>
      </Card>

      {campaignsQuery.isError ? (
        <ErrorNotice message={campaignsQuery.error instanceof Error ? campaignsQuery.error.message : 'Could not load campaigns.'} onRetry={() => void campaignsQuery.refetch()} />
      ) : campaignsQuery.isLoading ? (
        <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading campaigns…</Text></Card>
      ) : campaignsQuery.data?.length ? (
        <View style={{ gap: 10 }}>
          {campaignsQuery.data.map((campaign) => (
            <Pressable
              key={campaign.id}
              accessibilityRole="button"
              accessibilityLabel={`Open campaign ${campaign.name}`}
              onPress={() => router.push(`/campaigns/${encodeURIComponent(campaign.id)}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Card style={{ gap: 9 }}>
                <View style={styles.campaignHeader}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.campaignTitle, { color: colors.foreground }]} numberOfLines={2}>{campaign.name}</Text>
                    <Text style={[styles.body, { color: colors.mutedForeground }]}>{campaign.campaign_type.replace(/_/g, ' ')}</Text>
                  </View>
                  <StatusBadge status={campaign.status} />
                </View>
                {campaign.description ? <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>{campaign.description}</Text> : null}
                <View style={styles.campaignMeta}>
                  <Meta icon="bar-chart-2" text={`${campaign.total_responses || 0} responses`} />
                  <Meta icon="users" text={`${campaign.assigned_worker_ids?.length || 0} workers`} />
                  {campaign.end_date ? <Meta icon="calendar" text={`Ends ${campaign.end_date}`} /> : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="flag"
          title={search ? 'No matching campaigns' : 'No campaigns yet'}
          body={user?.role === 'worker' ? 'When you are assigned to a campaign, it will appear here.' : 'Create a campaign to organize field work and data collection.'}
        />
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 }}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.metaItem}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
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

function Chips({ options, selected, onSelect, labels = {} }: { options: string[]; selected: string; onSelect: (value: string) => void; labels?: Record<string, string> }) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(option)} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
            <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>
              {labels[option] || option.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8 },
  statValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19 },
  hint: { fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 17 },
  dateRow: { flexDirection: 'row', gap: 9 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  multilineInput: { minHeight: 76, paddingTop: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10 },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  searchButton: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  campaignHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campaignTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  campaignMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
