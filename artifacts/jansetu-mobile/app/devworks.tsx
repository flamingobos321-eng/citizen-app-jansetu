import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import {
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

type ProgressUpdate = { at: string; by: string; note: string };
type DevWork = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: string;
  budget?: number | null;
  approved: boolean;
  progress_updates?: ProgressUpdate[];
};
type DevWorkForm = { title: string; description: string; category: string; location: string; budget: string };
type MetaResponse = { dev_statuses: string[] };

const OFFICE_ROLES = ['admin', 'pa', 'politician'];
const CATEGORIES = [
  'Road Construction',
  'Water Tank',
  'School Building',
  'Street Light Installation',
  'Drainage Project',
  'Hospital Upgrade',
];
const emptyForm: DevWorkForm = { title: '', description: '', category: CATEGORIES[0], location: '', budget: '' };

export default function DevelopmentWorksScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [form, setForm] = useState<DevWorkForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const isCitizen = user?.role === 'citizen';
  const canManage = user?.role === 'admin' || user?.role === 'pa';
  const canApprove = user?.role === 'admin' || user?.role === 'politician';
  const queryKey = ['development-works', token, user?.role] as const;
  const worksQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest<DevWork[]>('/devworks', { token }),
    enabled: !!token && !!user,
  });
  const metaQuery = useQuery({
    queryKey: ['mobile-meta'],
    queryFn: () => apiRequest<MetaResponse>('/meta/categories', { token }),
    enabled: !!token && !!user && !isCitizen,
  });
  const statuses = metaQuery.data?.dev_statuses || ['Planned', 'Approved', 'Tender Issued', 'Work Started', 'Completed'];
  const refresh = () => Promise.all([worksQuery.refetch(), metaQuery.refetch()]);

  const createWork = useMutation({
    mutationFn: () =>
      apiRequest<DevWork>('/devworks', {
        method: 'POST',
        token,
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          location: form.location.trim(),
          budget: form.budget.trim() ? Number(form.budget) : null,
          status: 'Planned',
        },
      }),
    onSuccess: async () => {
      setForm(emptyForm);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const approveWork = useMutation({
    mutationFn: (id: string) =>
      apiRequest<DevWork>(`/devworks/${encodeURIComponent(id)}/approve`, { method: 'POST', token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest<DevWork>(`/devworks/${encodeURIComponent(id)}/status?status=${encodeURIComponent(status)}`, {
        method: 'POST',
        token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const addProgress = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest<DevWork>(`/devworks/${encodeURIComponent(id)}/progress?note=${encodeURIComponent(note)}`, {
        method: 'POST',
        token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!isCitizen && !OFFICE_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const updateForm = (key: keyof DevWorkForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const submitWork = () => {
    setFormError('');
    if (!form.title.trim() || !form.description.trim() || !form.location.trim()) {
      setFormError('Add a title, description, and location before submitting.');
      return;
    }
    if (form.budget.trim() && (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 0)) {
      setFormError('Enter a valid project budget.');
      return;
    }
    createWork.mutate();
  };

  return (
    <Screen
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={worksQuery.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow={isCitizen ? 'PUBLIC SERVICES' : 'OFFICE WORKSPACE'}
        title="Development works"
        subtitle={
          isCitizen
            ? 'Track approved projects and progress in your constituency.'
            : 'Manage project status, approval, and progress updates.'
        }
      />

      {canManage ? (
        <Card style={styles.formCard}>
          <View style={styles.formHeading}>
            <Feather name="tool" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add a project</Text>
          </View>
          <Field label="Project title *" value={form.title} onChangeText={(value) => updateForm('title', value)} />
          <Field label="Location *" value={form.location} onChangeText={(value) => updateForm('location', value)} />
          <Field
            label="Description *"
            value={form.description}
            onChangeText={(value) => updateForm('description', value)}
            multiline
          />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((category) => {
              const selected = category === form.category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => updateForm('category', category)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="Budget (₹)" value={form.budget} onChangeText={(value) => updateForm('budget', value)} keyboardType="decimal-pad" />
          {user?.role === 'pa' ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Projects you create remain pending until approved by the representative.
            </Text>
          ) : null}
          {formError ? <ErrorNotice message={formError} /> : null}
          {createWork.isError ? (
            <ErrorNotice
              message={createWork.error instanceof Error ? createWork.error.message : 'Could not create this project.'}
              onRetry={submitWork}
            />
          ) : null}
          <ActionButton
            title={user?.role === 'admin' ? 'Add and approve project' : 'Add project'}
            icon="plus"
            onPress={submitWork}
            loading={createWork.isPending}
          />
        </Card>
      ) : null}

      {worksQuery.isError ? (
        <ErrorNotice
          message={worksQuery.error instanceof Error ? worksQuery.error.message : 'Could not load development works.'}
          onRetry={() => void worksQuery.refetch()}
        />
      ) : worksQuery.isLoading ? (
        <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading projects…</Text></Card>
      ) : worksQuery.data?.length ? (
        <View style={{ gap: 11 }}>
          {worksQuery.data.map((work) => (
            <DevelopmentWorkCard
              key={work.id}
              work={work}
              isCitizen={isCitizen}
              canManage={canManage}
              canApprove={canApprove}
              statuses={statuses}
              onApprove={() => approveWork.mutate(work.id)}
              onStatusChange={(status) => updateStatus.mutate({ id: work.id, status })}
              onAddProgress={(note) => addProgress.mutate({ id: work.id, note })}
              actionPending={
                (approveWork.isPending && approveWork.variables === work.id) ||
                (updateStatus.isPending && updateStatus.variables?.id === work.id) ||
                (addProgress.isPending && addProgress.variables?.id === work.id)
              }
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="tool"
          title="No development works yet"
          body={isCitizen ? 'Approved projects will appear here when your office shares them.' : 'Projects added by your office will appear here.'}
        />
      )}
      {approveWork.isError || updateStatus.isError || addProgress.isError ? (
        <ErrorNotice message="That project update could not be saved. Refresh and try again." />
      ) : null}
    </Screen>
  );
}

function DevelopmentWorkCard({
  work,
  isCitizen,
  canManage,
  canApprove,
  statuses,
  onApprove,
  onStatusChange,
  onAddProgress,
  actionPending,
}: {
  work: DevWork;
  isCitizen: boolean;
  canManage: boolean;
  canApprove: boolean;
  statuses: string[];
  onApprove: () => void;
  onStatusChange: (status: string) => void;
  onAddProgress: (note: string) => void;
  actionPending: boolean;
}) {
  const colors = useColors();
  const [showStatuses, setShowStatuses] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Card style={styles.workCard}>
      <View style={styles.statusRow}>
        <StatusBadge status={work.status} />
        {!isCitizen ? (
          <Text style={[styles.approval, { color: work.approved ? colors.success : colors.warning }]}>
            {work.approved ? 'Approved' : 'Pending approval'}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.workTitle, { color: colors.foreground }]}>{work.title}</Text>
      <Text style={[styles.meta, { color: colors.mutedForeground }]}>{work.category} · {work.location}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{work.description}</Text>
      {work.budget ? (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Budget: ₹{work.budget.toLocaleString('en-IN')}</Text>
      ) : null}
      {work.progress_updates?.length ? (
        <View style={styles.progress}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Recent progress</Text>
          {work.progress_updates.slice(-3).reverse().map((update, index) => (
            <Text key={`${update.at}-${index}`} style={[styles.meta, { color: colors.mutedForeground }]}>
              {update.at ? `${new Date(update.at).toLocaleDateString()} · ` : ''}{update.note}
            </Text>
          ))}
        </View>
      ) : null}
      {canManage ? (
        <>
          <ActionButton
            title={showStatuses ? 'Hide status options' : `Update status · ${work.status}`}
            icon="edit-2"
            variant="outline"
            onPress={() => setShowStatuses((value) => !value)}
          />
          {showStatuses ? (
            <View style={styles.chips}>
              {statuses.map((status) => (
                <Pressable
                  key={status}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${status}`}
                  onPress={() => {
                    onStatusChange(status);
                    setShowStatuses(false);
                  }}
                  style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{status}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a progress note"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Progress note"
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
          />
          <ActionButton
            title="Add progress note"
            icon="message-circle"
            variant="outline"
            disabled={!note.trim()}
            loading={actionPending}
            onPress={() => {
              onAddProgress(note.trim());
              setNote('');
            }}
          />
        </>
      ) : null}
      {canApprove && !work.approved ? (
        <ActionButton title="Approve project" icon="check-circle" onPress={onApprove} loading={actionPending} />
      ) : null}
    </Card>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label.replace(' *', '')}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  chipText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  hint: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21 },
  workCard: { gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  approval: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  workTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  meta: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  progress: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8DEE8', paddingTop: 10 },
});
