import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackButton,
  ActionButton,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

type Visit = {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  visit_type: string;
  target_audience?: string;
  visibility?: 'public' | 'internal';
  status: string;
};

type VisitForm = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  visit_type: string;
  target_audience: string;
  visibility: 'public' | 'internal';
};

const VISIT_TYPES = ['Public Meeting', 'Village Visit', 'Ward Inspection', 'Health Camp', 'Janata Darbar'];
const emptyForm: VisitForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  visit_type: 'Janata Darbar',
  target_audience: '',
  visibility: 'public',
};
const OFFICE_ROLES = ['admin', 'pa', 'politician'];

export default function VisitsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [form, setForm] = useState<VisitForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const isCitizen = user?.role === 'citizen';
  const canCreate = user?.role === 'admin' || user?.role === 'pa';
  const canApprove = user?.role === 'admin' || user?.role === 'politician';
  const visitsQuery = useQuery({
    queryKey: ['visits', token, user?.role],
    queryFn: () =>
      apiRequest<Visit[]>(`/visits${isCitizen ? '?upcoming=true' : ''}`, { token }),
    enabled: !!token && !!user,
  });

  const createVisit = useMutation({
    mutationFn: () => apiRequest<Visit>('/visits', { method: 'POST', token, body: form }),
    onSuccess: async () => {
      setForm(emptyForm);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['visits', token] });
    },
  });
  const approveVisit = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Visit>(`/visits/${encodeURIComponent(id)}/approve`, { method: 'POST', token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['visits', token] });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!isCitizen && !OFFICE_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const updateForm = (key: keyof VisitForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const submitVisit = () => {
    setFormError('');
    if (!form.title.trim() || !form.date.trim() || !form.time.trim() || !form.location.trim()) {
      setFormError('Add a title, date, time, and location before submitting.');
      return;
    }
    createVisit.mutate();
  };

  return (
    <Screen
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={visitsQuery.isRefetching}
          onRefresh={() => void visitsQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        eyebrow={isCitizen ? 'PUBLIC SERVICES' : 'OFFICE WORKSPACE'}
        title="Visits & camps"
        subtitle={
          isCitizen
            ? 'See upcoming public meetings and services in your constituency.'
            : 'Schedule, review, and publish office visits and camps.'
        }
        right={
          <BackButton
            fallback={isCitizen ? '/(tabs)/services' : '/office'}
            label={isCitizen ? 'Back to services' : 'Back to office'}
          />
        }
      />

      {canCreate ? (
        <Card style={styles.formCard}>
          <View style={styles.formHeading}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Schedule a visit</Text>
          </View>
          <Field label="Title *" value={form.title} onChangeText={(value) => updateForm('title', value)} />
          <View style={styles.twoColumns}>
            <Field label="Date *" placeholder="YYYY-MM-DD" value={form.date} onChangeText={(value) => updateForm('date', value)} />
            <Field label="Time *" placeholder="HH:MM" value={form.time} onChangeText={(value) => updateForm('time', value)} />
          </View>
          <Field label="Location *" value={form.location} onChangeText={(value) => updateForm('location', value)} />
          <Field label="Target audience" value={form.target_audience} onChangeText={(value) => updateForm('target_audience', value)} />
          <Field
            label="Description"
            value={form.description}
            onChangeText={(value) => updateForm('description', value)}
            multiline
          />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Visit type</Text>
          <ChoiceChips
            options={VISIT_TYPES}
            selected={form.visit_type}
            onSelect={(value) => updateForm('visit_type', value)}
          />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Visibility</Text>
          <ChoiceChips
            options={['public', 'internal']}
            selected={form.visibility}
            onSelect={(value) => updateForm('visibility', value as VisitForm['visibility'])}
            labels={{ public: 'Public', internal: 'Office only' }}
          />
          {user?.role === 'pa' ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Your visit will need representative approval before it is published.
            </Text>
          ) : null}
          {formError ? <ErrorNotice message={formError} /> : null}
          {createVisit.isError ? (
            <ErrorNotice
              message={createVisit.error instanceof Error ? createVisit.error.message : 'Could not schedule this visit.'}
              onRetry={submitVisit}
            />
          ) : null}
          <ActionButton
            title={user?.role === 'admin' ? 'Schedule and publish' : 'Submit for approval'}
            icon="send"
            onPress={submitVisit}
            loading={createVisit.isPending}
          />
        </Card>
      ) : null}

      {visitsQuery.isError ? (
        <ErrorNotice
          message={visitsQuery.error instanceof Error ? visitsQuery.error.message : 'Could not load visits.'}
          onRetry={() => void visitsQuery.refetch()}
        />
      ) : visitsQuery.isLoading ? (
        <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading visits…</Text></Card>
      ) : visitsQuery.data?.length ? (
        <View style={{ gap: 11 }}>
          {visitsQuery.data.map((visit) => (
            <Card key={visit.id} style={styles.visitCard}>
              <View style={styles.metaRow}>
                <Text style={[styles.type, { color: colors.primary }]}>{visit.visit_type}</Text>
                {!isCitizen ? <StatusBadge status={visit.status} /> : null}
              </View>
              <Text style={[styles.visitTitle, { color: colors.foreground }]}>{visit.title}</Text>
              <View style={styles.detailRow}>
                <Feather name="calendar" size={15} color={colors.mutedForeground} />
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{visit.date} · {visit.time}</Text>
              </View>
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={15} color={colors.mutedForeground} />
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{visit.location}</Text>
              </View>
              {visit.description ? (
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{visit.description}</Text>
              ) : null}
              {visit.target_audience ? (
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>Audience: {visit.target_audience}</Text>
              ) : null}
              {canApprove && visit.status === 'Pending Approval' ? (
                <ActionButton
                  title="Approve and publish"
                  icon="check-circle"
                  onPress={() => approveVisit.mutate(visit.id)}
                  loading={approveVisit.isPending && approveVisit.variables === visit.id}
                />
              ) : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="calendar"
          title="No visits scheduled"
          body={isCitizen ? 'Published public visits will appear here.' : 'New visits from your office will appear here.'}
        />
      )}
      {approveVisit.isError ? (
        <ErrorNotice
          message={approveVisit.error instanceof Error ? approveVisit.error.message : 'Could not approve this visit.'}
          onRetry={() => {
            if (approveVisit.variables) approveVisit.mutate(approveVisit.variables);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label.replace(' *', '')}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground },
        ]}
      />
    </View>
  );
}

function ChoiceChips({
  options,
  selected,
  onSelect,
  labels = {},
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  labels?: Record<string, string>;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
              {labels[option] || option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: 12 },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
  },
  multilineInput: { minHeight: 82, paddingTop: 12 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  chipText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  hint: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21 },
  visitCard: { gap: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  type: { fontFamily: 'Manrope_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  visitTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
