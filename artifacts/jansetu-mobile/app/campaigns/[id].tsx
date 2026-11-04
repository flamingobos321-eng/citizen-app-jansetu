import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, BackButton, Card, EmptyState, ErrorNotice, PageHeader, Screen, StatusBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest, uploadIssuePhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type FormField = {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  min_val?: number;
  max_val?: number;
  order?: number;
};
type CampaignAnalytics = {
  daily_responses?: Array<{ date: string; responses: number }>;
  worker_performance?: Array<{ worker: string; responses: number }>;
  task_status_counts?: Record<string, number>;
  total_responses?: number;
  completed_responses?: number;
  active_workers?: number;
};
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
  form_fields?: FormField[];
  assigned_worker_ids?: string[];
  total_responses?: number;
  completed_responses?: number;
};
type Worker = { id: string; name: string; designation?: string };
type Citizen = { id: string; name: string; mobile?: string };
type CampaignTask = {
  id: string;
  title: string;
  description?: string;
  priority: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  location?: string;
  status: string;
};
type CampaignResponse = {
  id: string;
  worker_name?: string;
  citizen_name?: string;
  submitted_at?: string;
  responses?: Record<string, unknown>;
  status: string;
};
type PickedFile = { uri: string; name: string; type: string; file?: File };
type ResponsePayload = {
  citizen_id?: string;
  citizen_name?: string;
  responses: Record<string, unknown>;
  attachments: string[];
  status: string;
  location?: { lat: number; lng: number };
};

const OFFICE_ROLES = ['admin', 'pa', 'politician'];
const CAMPAIGN_ROLES = [...OFFICE_ROLES, 'worker'];
const TASK_STATUSES = ['accepted', 'in_progress', 'on_hold', 'completed'];
const FIELD_TYPES = [
  ['short_text', 'Short text'],
  ['long_text', 'Long text'],
  ['number', 'Number'],
  ['mobile', 'Mobile'],
  ['email', 'Email'],
  ['date', 'Date'],
  ['time', 'Time'],
  ['address', 'Address'],
  ['yes_no', 'Yes / No'],
  ['single_choice', 'Single choice'],
  ['multiple_choice', 'Multiple choice'],
  ['dropdown', 'Dropdown'],
  ['rating', 'Rating'],
  ['photo', 'Photo upload'],
  ['file', 'File upload'],
  ['gps', 'GPS location'],
] as const;
const OPTION_FIELD_TYPES = ['single_choice', 'multiple_choice', 'dropdown'];

function createFieldId() {
  return `${Date.now().toString()}${Math.random().toString(36).slice(2, 11)}`;
}

export default function CampaignDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<'overview' | 'tasks' | 'form' | 'responses' | 'analytics'>('overview');
  const [workerSelection, setWorkerSelection] = useState<string[] | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskWorker, setTaskWorker] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskLocation, setTaskLocation] = useState('');
  const [taskError, setTaskError] = useState('');
  const isStaff = OFFICE_ROLES.includes(user?.role || '');
  const isWorker = user?.role === 'worker';
  const campaignQuery = useQuery({
    queryKey: ['campaign-detail', token, id],
    queryFn: () => apiRequest<Campaign>(`/campaigns/${encodeURIComponent(id)}`, { token }),
    enabled: !!token && !!id && !!user && CAMPAIGN_ROLES.includes(user.role),
  });
  const campaign = campaignQuery.data;
  const tasksQuery = useQuery({
    queryKey: ['campaign-tasks', token, id],
    queryFn: () => apiRequest<CampaignTask[]>(`/campaigns/${encodeURIComponent(id)}/tasks`, { token }),
    enabled: !!token && !!id && !!user && CAMPAIGN_ROLES.includes(user.role),
  });
  const responsesQuery = useQuery({
    queryKey: ['campaign-responses', token, id],
    queryFn: () => apiRequest<{ total: number; items: CampaignResponse[] }>(`/campaigns/${encodeURIComponent(id)}/responses`, { token }),
    enabled: !!token && !!id && !!user && CAMPAIGN_ROLES.includes(user.role),
  });
  const analyticsQuery = useQuery({
    queryKey: ['campaign-analytics', token, id],
    queryFn: () => apiRequest<CampaignAnalytics>(`/campaigns/${encodeURIComponent(id)}/analytics`, { token }),
    enabled: !!token && !!id && !!user && isStaff && tab === 'analytics',
  });
  const workersQuery = useQuery({
    queryKey: ['campaign-workers', token],
    queryFn: () => apiRequest<Worker[]>('/users?role=worker', { token }),
    enabled: !!token && !!user && isStaff,
  });
  const citizensQuery = useQuery({
    queryKey: ['campaign-citizens', token],
    queryFn: () => apiRequest<Citizen[]>('/users?role=citizen', { token }),
    enabled: !!token && !!user && isWorker && !!campaign && campaign.response_mode !== 'anonymous',
  });

  const refreshCampaign = async () => {
    await Promise.all([
      campaignQuery.refetch(),
      tasksQuery.refetch(),
      responsesQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['campaigns', token] }),
      queryClient.invalidateQueries({ queryKey: ['campaign-stats', token] }),
      queryClient.invalidateQueries({ queryKey: ['campaign-analytics', token, id] }),
    ]);
  };
  const saveFormFields = useMutation({
    mutationFn: (formFields: FormField[]) =>
      apiRequest<Campaign>(`/campaigns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        token,
        body: { form_fields: formFields.map((field, order) => ({ ...field, order })) },
      }),
    onSuccess: async () => {
      await campaignQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['campaigns', token] });
    },
  });
  const updateCampaign = useMutation({
    mutationFn: (status: string) =>
      apiRequest<Campaign>(`/campaigns/${encodeURIComponent(id)}`, { method: 'PUT', token, body: { status } }),
    onSuccess: refreshCampaign,
  });
  const assignWorkers = useMutation({
    mutationFn: (workerIds: string[]) =>
      apiRequest(`/campaigns/${encodeURIComponent(id)}/workers`, { method: 'PUT', token, body: { worker_ids: workerIds } }),
    onSuccess: async () => {
      setWorkerSelection(null);
      await refreshCampaign();
    },
  });
  const createTask = useMutation({
    mutationFn: () =>
      apiRequest<CampaignTask>(`/campaigns/${encodeURIComponent(id)}/tasks`, {
        method: 'POST',
        token,
        body: {
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          assigned_to: taskWorker || null,
          due_date: taskDueDate.trim() || null,
          location: taskLocation.trim() || null,
          priority: 'medium',
        },
      }),
    onSuccess: async () => {
      setTaskTitle('');
      setTaskDescription('');
      setTaskWorker('');
      setTaskDueDate('');
      setTaskLocation('');
      setTaskError('');
      await tasksQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['campaign-analytics', token, id] });
    },
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      apiRequest<CampaignTask>(`/campaigns/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PUT',
        token,
        body: { status },
      }),
    onSuccess: async () => {
      await tasksQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['campaign-analytics', token, id] });
    },
  });
  const submitResponse = useMutation({
    mutationFn: (payload: ResponsePayload) =>
      apiRequest<CampaignResponse>(`/campaigns/${encodeURIComponent(id)}/responses`, { method: 'POST', token, body: payload }),
    onSuccess: async () => {
      await responsesQuery.refetch();
      await campaignQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['campaigns', token] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-stats', token] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-analytics', token, id] });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!CAMPAIGN_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;
  const selectedWorkers = workerSelection ?? campaign?.assigned_worker_ids ?? [];
  const toggleWorker = (workerId: string) => {
    setWorkerSelection((current) => {
      const base = current ?? campaign?.assigned_worker_ids ?? [];
      return base.includes(workerId) ? base.filter((id) => id !== workerId) : [...base, workerId];
    });
  };
  const submitTask = () => {
    setTaskError('');
    if (!taskTitle.trim()) {
      setTaskError('Task title is required.');
      return;
    }
    createTask.mutate();
  };

  return (
    <Screen keyboardAware contentStyle={{ gap: 14 }}>
      <PageHeader
        eyebrow={isWorker ? 'FIELD CAMPAIGN' : 'OFFICE CAMPAIGN'}
        title={campaign?.name || 'Campaign'}
        subtitle={campaign ? campaign.campaign_type.replace(/_/g, ' ') : 'Loading campaign details'}
        right={
          <BackButton fallback="/campaigns" label="Back to campaigns" testID="campaign-detail-back" />
        }
      />
      {campaignQuery.isError ? (
        <ErrorNotice message={campaignQuery.error instanceof Error ? campaignQuery.error.message : 'Could not load this campaign.'} onRetry={() => void campaignQuery.refetch()} />
      ) : campaignQuery.isLoading || !campaign ? (
        <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading campaign…</Text></Card>
      ) : (
        <>
          <View style={styles.tabRow}>
            {(isStaff ? ['overview', 'tasks', 'form', 'responses', 'analytics'] as const : ['overview', 'tasks', 'responses'] as const).map((key) => {
              const active = tab === key;
              return (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setTab(key)} style={[styles.tab, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
                  <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>
                    {key === 'overview' ? 'Overview' : key === 'tasks' ? `Tasks (${tasksQuery.data?.length || 0})` : key === 'form' ? 'Form' : key === 'analytics' ? 'Analytics' : `Responses (${responsesQuery.data?.total || 0})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'overview' ? (
            <>
              <Card style={{ gap: 10 }}>
                <View style={styles.statusRow}>
                  <StatusBadge status={campaign.status} />
                  <StatusBadge status={campaign.priority} />
                </View>
                {campaign.description ? <Text style={[styles.body, { color: colors.foreground }]}>{campaign.description}</Text> : null}
                {campaign.objectives ? <InfoRow label="Objectives" value={campaign.objectives} /> : null}
                <InfoRow label="Response mode" value={campaign.response_mode.replace(/_/g, ' ')} />
                <InfoRow label="Schedule" value={[campaign.start_date, campaign.end_date].filter(Boolean).join(' — ') || 'Not set'} />
                <InfoRow label="Responses" value={String(campaign.total_responses || 0)} />
                <InfoRow label="Workers assigned" value={String(campaign.assigned_worker_ids?.length || 0)} />
              </Card>
              {isStaff && campaign.status === 'draft' ? (
                <ActionButton title="Activate campaign" icon="play" onPress={() => updateCampaign.mutate('active')} loading={updateCampaign.isPending} />
              ) : null}
              {isStaff && campaign.status === 'active' ? (
                <ActionButton title="Mark campaign complete" icon="check-circle" variant="outline" onPress={() => updateCampaign.mutate('completed')} loading={updateCampaign.isPending} />
              ) : null}
              {updateCampaign.isError ? <ErrorNotice message="Could not update campaign status." /> : null}

              {isStaff ? (
                <Card style={{ gap: 11 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Assign campaign workers</Text>
                  {workersQuery.isError ? (
                    <ErrorNotice message="Could not load field workers." onRetry={() => void workersQuery.refetch()} />
                  ) : workersQuery.isLoading ? (
                    <Text style={[styles.body, { color: colors.mutedForeground }]}>Loading workers…</Text>
                  ) : workersQuery.data?.length ? (
                    <View style={styles.chips}>
                      {workersQuery.data.map((worker) => {
                        const selected = selectedWorkers.includes(worker.id);
                        return (
                          <Pressable key={worker.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => toggleWorker(worker.id)} style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                            <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>{worker.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : <Text style={[styles.body, { color: colors.mutedForeground }]}>No field workers are available.</Text>}
                  <ActionButton title="Save worker assignments" icon="users" variant="outline" disabled={workerSelection === null || workersQuery.isLoading} loading={assignWorkers.isPending} onPress={() => assignWorkers.mutate(selectedWorkers)} />
                  {assignWorkers.isError ? <ErrorNotice message="Could not save worker assignments." /> : null}
                </Card>
              ) : null}
              {isWorker && campaign.status === 'active' ? (
                <ActionButton title="Submit campaign response" icon="edit-3" onPress={() => setTab('responses')} />
              ) : null}
            </>
          ) : null}

          {tab === 'form' && isStaff ? (
            <CampaignFormBuilder
              key={campaign.id}
              fields={campaign.form_fields || []}
              onSave={(fields) => saveFormFields.mutateAsync(fields)}
              saving={saveFormFields.isPending}
              saveError={saveFormFields.error instanceof Error ? saveFormFields.error.message : saveFormFields.isError ? 'Could not save campaign questions.' : ''}
            />
          ) : null}

          {tab === 'tasks' ? (
            <View style={{ gap: 10 }}>
              {isStaff ? (
                <Card style={{ gap: 10 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create field task</Text>
                  <Field label="Task title *" value={taskTitle} onChangeText={setTaskTitle} />
                  <Field label="Instructions" value={taskDescription} onChangeText={setTaskDescription} multiline />
                  <Field label="Location" value={taskLocation} onChangeText={setTaskLocation} />
                  <Field label="Due date" value={taskDueDate} onChangeText={setTaskDueDate} placeholder="YYYY-MM-DD" />
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Assign to</Text>
                  <View style={styles.chips}>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: !taskWorker }} onPress={() => setTaskWorker('')} style={[styles.chip, { backgroundColor: !taskWorker ? colors.primary : colors.card, borderColor: !taskWorker ? colors.primary : colors.border }]}>
                      <Text style={{ color: !taskWorker ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>Unassigned</Text>
                    </Pressable>
                    {(workersQuery.data || []).map((worker) => {
                      const selected = taskWorker === worker.id;
                      return (
                        <Pressable key={worker.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setTaskWorker(worker.id)} style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                          <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>{worker.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {taskError ? <ErrorNotice message={taskError} /> : null}
                  {createTask.isError ? <ErrorNotice message={createTask.error instanceof Error ? createTask.error.message : 'Could not create task.'} /> : null}
                  <ActionButton title="Create task" icon="plus" onPress={submitTask} loading={createTask.isPending} />
                </Card>
              ) : null}
              {tasksQuery.isError ? <ErrorNotice message={tasksQuery.error instanceof Error ? tasksQuery.error.message : 'Could not load campaign tasks.'} onRetry={() => void tasksQuery.refetch()} /> : null}
              {tasksQuery.data?.length ? tasksQuery.data.map((task) => (
                <TaskCard key={task.id} task={task} isWorker={isWorker} onUpdate={(status) => updateTask.mutate({ taskId: task.id, status })} pending={updateTask.isPending && updateTask.variables?.taskId === task.id} />
              )) : !tasksQuery.isLoading ? (
                <EmptyState icon="check-square" title="No tasks assigned" body={isWorker ? 'Campaign tasks assigned to you will appear here.' : 'Create a task to coordinate field work.'} />
              ) : null}
              {updateTask.isError ? <ErrorNotice message="Could not update task status." /> : null}
            </View>
          ) : null}

          {tab === 'responses' ? (
            <View style={{ gap: 10 }}>
              {!isWorker ? (
                <View style={styles.statsRow}>
                  <Stat label="Responses" value={responsesQuery.data?.total || 0} />
                  <Stat label="Completed" value={campaign.completed_responses || 0} />
                </View>
              ) : null}
              {isWorker && campaign.status === 'active' ? (
                <CampaignResponseForm
                  campaign={campaign}
                  token={token}
                  citizens={citizensQuery.data || []}
                  citizensLoading={citizensQuery.isLoading}
                  onSubmit={(payload) => submitResponse.mutateAsync(payload)}
                  submitting={submitResponse.isPending}
                />
              ) : null}
              {isWorker && campaign.status !== 'active' ? (
                <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Responses can only be submitted while the campaign is active.</Text></Card>
              ) : null}
              {responsesQuery.isError ? <ErrorNotice message={responsesQuery.error instanceof Error ? responsesQuery.error.message : 'Could not load responses.'} onRetry={() => void responsesQuery.refetch()} /> : null}
              {responsesQuery.data?.items?.length ? (
                <View style={{ gap: 9 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Submitted responses</Text>
                  {responsesQuery.data.items.slice(0, 30).map((response) => (
                    <Card key={response.id} style={styles.responseCard}>
                      <View style={[styles.responseIcon, { backgroundColor: colors.secondary }]}>
                        <Feather name="clipboard" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[styles.memberName, { color: colors.foreground }]}>{response.citizen_name || 'Anonymous response'}</Text>
                        <Text style={[styles.body, { color: colors.mutedForeground }]}>
                          {response.worker_name || 'Field staff'} · {response.submitted_at || 'Date unavailable'}
                        </Text>
                        <Text style={[styles.body, { color: colors.mutedForeground }]}>
                          {Object.keys(response.responses || {}).length} fields completed · {response.status}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : !responsesQuery.isLoading ? (
                <EmptyState icon="clipboard" title="No responses yet" body="Campaign submissions will appear here." />
              ) : null}
            </View>
          ) : null}

          {tab === 'analytics' && isStaff ? (
            <CampaignAnalyticsPanel
              analytics={analyticsQuery.data}
              loading={analyticsQuery.isLoading}
              error={analyticsQuery.error instanceof Error ? analyticsQuery.error.message : analyticsQuery.isError ? 'Could not load campaign analytics.' : ''}
              onRetry={() => void analyticsQuery.refetch()}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function CampaignFormBuilder({
  fields: initialFields,
  onSave,
  saving,
  saveError,
}: {
  fields: FormField[];
  onSave: (fields: FormField[]) => Promise<unknown>;
  saving: boolean;
  saveError: string;
}) {
  const colors = useColors();
  const [fields, setFields] = useState<FormField[]>(() => [...initialFields].sort((a, b) => (a.order || 0) - (b.order || 0)));
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [formError, setFormError] = useState('');

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((field, order) => ({ ...field, order }));
    });
  };
  const saveQuestion = (field: FormField) => {
    const label = field.label.trim();
    if (!label) {
      setFormError('Enter a question label before saving.');
      return;
    }
    if (field.type === 'rating' && (field.min_val ?? 1) > (field.max_val ?? 5)) {
      setFormError('The minimum rating must be lower than the maximum rating.');
      return;
    }
    if (OPTION_FIELD_TYPES.includes(field.type) && (field.options || []).some((option) => !option.label.trim() || !option.value.trim())) {
      setFormError('Complete or remove each blank option before saving.');
      return;
    }
    setFields((current) => {
      const index = current.findIndex((item) => item.id === field.id);
      const next = [...current];
      if (index < 0) next.push({ ...field, label, order: next.length });
      else next[index] = { ...field, label };
      return next.map((item, order) => ({ ...item, order }));
    });
    setEditingField(null);
    setFormError('');
  };
  const save = async () => {
    setFormError('');
    if (editingField) {
      setFormError('Save or cancel the question you are editing first.');
      return;
    }
    try {
      await onSave(fields.map((field, order) => ({ ...field, order })));
    } catch {
      // The mutation error is rendered below so users can retry without losing edits.
    }
  };
  const addField = () => {
    if (editingField) {
      setFormError('Save or cancel the question you are editing first.');
      return;
    }
    setFormError('');
    setEditingField({
      id: createFieldId(),
      type: 'short_text',
      label: 'New Field',
      required: false,
      options: [],
      order: fields.length,
    });
  };

  return (
    <View style={{ gap: 10 }}>
      <Card style={{ gap: 10 }}>
        <View style={styles.builderHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Response form</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{fields.length} {fields.length === 1 ? 'question' : 'questions'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add question"
            testID="add-campaign-question"
            onPress={addField}
            style={styles.iconButton}
          >
            <Feather name="plus" size={20} color={colors.primary} />
          </Pressable>
        </View>
        {fields.length ? fields.map((field, index) => (
          <View key={field.id} style={[styles.questionRow, { borderColor: colors.border }]}>
            <View style={styles.orderControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${field.label} up`}
                testID={`move-question-up-${field.id}`}
                disabled={index === 0}
                onPress={() => moveField(index, -1)}
                style={[styles.iconButton, index === 0 && styles.disabledIconButton]}
              >
                <Feather name="chevron-up" size={19} color={index === 0 ? colors.mutedForeground : colors.foreground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${field.label} down`}
                testID={`move-question-down-${field.id}`}
                disabled={index === fields.length - 1}
                onPress={() => moveField(index, 1)}
                style={[styles.iconButton, index === fields.length - 1 && styles.disabledIconButton]}
              >
                <Feather name="chevron-down" size={19} color={index === fields.length - 1 ? colors.mutedForeground : colors.foreground} />
              </Pressable>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={2}>{field.label}</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>{field.type.replace(/_/g, ' ')}{field.required ? ' · Required' : ''}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${field.label}`}
              testID={`edit-question-${field.id}`}
              onPress={() => { setFormError(''); setEditingField({ ...field, options: [...(field.options || [])] }); }}
              style={styles.iconButton}
            >
              <Feather name="edit-2" size={17} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${field.label}`}
              testID={`remove-question-${field.id}`}
              onPress={() => {
                setFields((current) => current.filter((item) => item.id !== field.id).map((item, order) => ({ ...item, order })));
                if (editingField?.id === field.id) setEditingField(null);
              }}
              style={styles.iconButton}
            >
              <Feather name="trash-2" size={17} color={colors.destructive} />
            </Pressable>
          </View>
        )) : (
          <EmptyState icon="file-text" title="No questions yet" body="Add questions to define what field teams collect." />
        )}
        {formError ? <ErrorNotice message={formError} /> : null}
        {saveError ? <ErrorNotice message={saveError} /> : null}
        <ActionButton
          title="Save response form"
          icon="save"
          onPress={() => void save()}
          loading={saving}
          testID="save-campaign-form"
        />
      </Card>
      {editingField ? (
        <CampaignQuestionEditor
          key={editingField.id}
          field={editingField}
          isNew={!fields.some((field) => field.id === editingField.id)}
          onCancel={() => { setEditingField(null); setFormError(''); }}
          onSave={saveQuestion}
        />
      ) : null}
    </View>
  );
}

function CampaignQuestionEditor({
  field,
  isNew,
  onCancel,
  onSave,
}: {
  field: FormField;
  isNew: boolean;
  onCancel: () => void;
  onSave: (field: FormField) => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<FormField>(() => ({ ...field, options: [...(field.options || [])] }));
  const updateOption = (index: number, label: string) => {
    setDraft((current) => {
      const options = [...(current.options || [])];
      const value = label.toLowerCase().trim().replace(/\s+/g, '_');
      options[index] = { label, value };
      return { ...current, options };
    });
  };
  const optionFields = OPTION_FIELD_TYPES.includes(draft.type);

  return (
    <Card style={{ gap: 11 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isNew ? 'Add question' : 'Edit question'}</Text>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Question type</Text>
      <View style={styles.chips}>
        {FIELD_TYPES.map(([value, label]) => {
          const selected = draft.type === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`question-type-${value}`}
              onPress={() => setDraft((current) => ({ ...current, type: value, options: [] }))}
              style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
            >
              <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Question label *" value={draft.label} onChangeText={(label) => setDraft((current) => ({ ...current, label }))} />
      <Field label="Placeholder" value={draft.placeholder || ''} onChangeText={(placeholder) => setDraft((current) => ({ ...current, placeholder }))} />
      <Field label="Help text" value={draft.help_text || ''} onChangeText={(help_text) => setDraft((current) => ({ ...current, help_text }))} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!draft.required }}
        onPress={() => setDraft((current) => ({ ...current, required: !current.required }))}
        style={styles.requiredToggle}
      >
        <Feather name={draft.required ? 'check-square' : 'square'} size={19} color={draft.required ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.body, { color: colors.foreground }]}>Required question</Text>
      </Pressable>
      {optionFields ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Options</Text>
          {(draft.options || []).map((option, index) => (
            <View key={`${draft.id}-option-${index}`} style={styles.optionRow}>
              <TextInput
                value={option.label}
                onChangeText={(label) => updateOption(index, label)}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={`Option ${index + 1} label`}
                testID={`campaign-option-${index}`}
                style={[styles.input, { flex: 1, backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${index + 1}`}
                onPress={() => setDraft((current) => ({ ...current, options: (current.options || []).filter((_, optionIndex) => optionIndex !== index) }))}
                style={styles.iconButton}
              >
                <Feather name="x" size={19} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
          <ActionButton
            title="Add option"
            icon="plus"
            variant="outline"
            onPress={() => setDraft((current) => ({ ...current, options: [...(current.options || []), { label: '', value: '' }] }))}
          />
        </View>
      ) : null}
      {draft.type === 'rating' ? (
        <View style={styles.ratingRow}>
          <View style={{ flex: 1 }}>
            <Field label="Minimum rating" value={String(draft.min_val ?? 1)} keyboardType="numeric" onChangeText={(value) => setDraft((current) => ({ ...current, min_val: Number(value) }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Maximum rating" value={String(draft.max_val ?? 5)} keyboardType="numeric" onChangeText={(value) => setDraft((current) => ({ ...current, max_val: Number(value) }))} />
          </View>
        </View>
      ) : null}
      <View style={styles.editorActions}>
        <ActionButton title="Cancel" icon="x" variant="outline" onPress={onCancel} style={{ flex: 1 }} />
        <ActionButton title="Save question" icon="check" onPress={() => onSave(draft)} style={{ flex: 1 }} />
      </View>
    </Card>
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

function CampaignAnalyticsPanel({
  analytics,
  loading,
  error,
  onRetry,
}: {
  analytics?: CampaignAnalytics;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  if (loading && !analytics) return <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>Loading campaign analytics…</Text></Card>;
  if (error && !analytics) return <ErrorNotice message={error} onRetry={onRetry} />;
  if (!analytics) return null;
  const dailyResponses = [...(analytics.daily_responses || [])].sort((a, b) => b.date.localeCompare(a.date));
  const workerPerformance = analytics.worker_performance || [];
  const taskStatuses = Object.entries(analytics.task_status_counts || {});
  const hasActivity = dailyResponses.length > 0 || workerPerformance.length > 0 || taskStatuses.length > 0;

  return (
    <View style={{ gap: 10 }}>
      {error ? <ErrorNotice message={error} onRetry={onRetry} /> : null}
      <View style={styles.statsRow}>
        <Stat label="Responses" value={analytics.total_responses || 0} />
        <Stat label="Completed" value={analytics.completed_responses || 0} />
        <Stat label="Active workers" value={analytics.active_workers || 0} />
      </View>
      {dailyResponses.length ? (
        <Card style={{ gap: 9 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily responses</Text>
          {dailyResponses.map((day) => (
            <View key={day.date} style={styles.analyticsRow}>
              <Text style={[styles.body, { color: colors.foreground }]}>{day.date}</Text>
              <Text style={[styles.analyticsValue, { color: colors.primary }]}>{day.responses}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {workerPerformance.length ? (
        <Card style={{ gap: 9 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Worker performance</Text>
          {workerPerformance.map((worker) => (
            <View key={worker.worker} style={styles.analyticsRow}>
              <Text style={[styles.body, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{worker.worker}</Text>
              <Text style={[styles.analyticsValue, { color: colors.primary }]}>{worker.responses}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {taskStatuses.length ? (
        <Card style={{ gap: 9 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Task status</Text>
          {taskStatuses.map(([status, count]) => (
            <View key={status} style={styles.analyticsRow}>
              <Text style={[styles.body, { color: colors.foreground, textTransform: 'capitalize' }]}>{status.replace(/_/g, ' ')}</Text>
              <Text style={[styles.analyticsValue, { color: colors.primary }]}>{count}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {!hasActivity ? (
        <EmptyState icon="bar-chart-2" title="No campaign activity yet" body="Response and task analytics will appear here as field work comes in." />
      ) : null}
    </View>
  );
}

function CampaignResponseForm({
  campaign,
  token,
  citizens,
  citizensLoading,
  onSubmit,
  submitting,
}: {
  campaign: Campaign;
  token: string;
  citizens: Citizen[];
  citizensLoading: boolean;
  onSubmit: (payload: ResponsePayload) => Promise<unknown>;
  submitting: boolean;
}) {
  const colors = useColors();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, PickedFile>>({});
  const [citizenSearch, setCitizenSearch] = useState('');
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [location, setLocation] = useState<ResponsePayload['location']>();
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const fields = [...(campaign.form_fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const needsCitizen = campaign.response_mode === 'linked_citizen';
  const canLinkCitizen = campaign.response_mode === 'linked_citizen' || campaign.response_mode === 'optional';
  const filteredCitizens = citizens
    .filter((citizen) => `${citizen.name} ${citizen.mobile || ''}`.toLowerCase().includes(citizenSearch.toLowerCase()))
    .slice(0, 12);

  const setAnswer = (fieldId: string, value: unknown) => setAnswers((current) => ({ ...current, [fieldId]: value }));
  const chooseFieldFile = async (field: FormField) => {
    setFormError('');
    try {
      if (field.type === 'photo') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setFormError('Photo library permission is needed to attach this image.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!result.canceled) {
          const asset = result.assets[0];
          const picked: PickedFile = {
            uri: asset.uri,
            name: asset.fileName || `${field.id}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            file: asset.file,
          };
          setFiles((current) => ({ ...current, [field.id]: picked }));
          setAnswer(field.id, picked.name);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (!result.canceled) {
          const asset = result.assets[0];
          const picked: PickedFile = {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            file: asset.file,
          };
          setFiles((current) => ({ ...current, [field.id]: picked }));
          setAnswer(field.id, picked.name);
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not open the file picker.');
    }
  };
  const captureLocation = async () => {
    setFormError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setFormError('Location permission was not granted.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: current.coords.latitude, lng: current.coords.longitude };
      setLocation(coords);
      // The GPS answer belongs to its form-field ID and follows the web app's lat/lng shape.
      return coords;
    } catch {
      setFormError('Could not capture your location.');
    }
  };
  const submit = async () => {
    setFormError('');
    if (needsCitizen && !selectedCitizen) {
      setFormError('Select a citizen before submitting this campaign response.');
      return;
    }
    const missing = fields.find((field) => field.required && (answers[field.id] === undefined || answers[field.id] === null || answers[field.id] === '' || (Array.isArray(answers[field.id]) && (answers[field.id] as unknown[]).length === 0)));
    if (missing) {
      setFormError(`${missing.label} is required.`);
      return;
    }
    try {
      const responses: Record<string, unknown> = { ...answers };
      const attachments: string[] = [];
      for (const [fieldId, file] of Object.entries(files)) {
        const uploaded = await uploadIssuePhoto(file, token);
        responses[fieldId] = uploaded.path;
        attachments.push(uploaded.path);
      }
      await onSubmit({
        citizen_id: selectedCitizen?.id,
        citizen_name: selectedCitizen?.name,
        responses,
        attachments,
        status: 'completed',
        location,
      });
      setAnswers({});
      setFiles({});
      setSelectedCitizen(null);
      setSuccess(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not submit this response.');
    }
  };

  if (success) {
    return (
      <Card style={{ gap: 10, alignItems: 'center' }}>
        <Feather name="check-circle" size={28} color={colors.success} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Response submitted</Text>
        <Text style={[styles.body, { color: colors.mutedForeground, textAlign: 'center' }]}>The campaign response has been saved.</Text>
        <ActionButton title="Submit another response" icon="plus" variant="outline" onPress={() => setSuccess(false)} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Submit a field response</Text>
      {canLinkCitizen ? (
        <View style={{ gap: 7 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{needsCitizen ? 'Link to citizen *' : 'Link to citizen (optional)'}</Text>
          {selectedCitizen ? (
            <Card style={styles.selectedCitizen}>
              <Feather name="user-check" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>{selectedCitizen.name}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{selectedCitizen.mobile || ''}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear selected citizen" onPress={() => setSelectedCitizen(null)}>
                <Feather name="x-circle" size={19} color={colors.mutedForeground} />
              </Pressable>
            </Card>
          ) : (
            <>
              <TextInput
                value={citizenSearch}
                onChangeText={setCitizenSearch}
                placeholder="Search by citizen name or mobile"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Search citizens"
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
              />
              {citizensLoading ? <Text style={[styles.body, { color: colors.mutedForeground }]}>Loading citizens…</Text> : null}
              {filteredCitizens.map((citizen) => (
                <Pressable key={citizen.id} accessibilityRole="button" onPress={() => setSelectedCitizen(citizen)} style={[styles.citizenChoice, { borderColor: colors.border }]}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{citizen.name}</Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>{citizen.mobile || ''}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      ) : null}

      {fields.map((field) => (
        <CampaignField
          key={field.id}
          field={field}
          value={answers[field.id]}
          file={files[field.id]}
          onChange={(value) => setAnswer(field.id, value)}
          onPick={() => void chooseFieldFile(field)}
          location={location}
          onCaptureLocation={async () => {
            const coords = await captureLocation();
            if (coords) setAnswer(field.id, coords);
          }}
        />
      ))}
      {formError ? <ErrorNotice message={formError} /> : null}
      <ActionButton title="Submit response" icon="send" onPress={() => void submit()} loading={submitting} />
    </Card>
  );
}

function CampaignField({
  field,
  value,
  file,
  onChange,
  onPick,
  location,
  onCaptureLocation,
}: {
  field: FormField;
  value: unknown;
  file?: PickedFile;
  onChange: (value: unknown) => void;
  onPick: () => void;
  location?: { lat: number; lng: number };
  onCaptureLocation: () => void;
}) {
  const colors = useColors();
  const choices = field.options || [];
  if (field.type === 'photo' || field.type === 'file') {
    return (
      <View style={{ gap: 6 }}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}{field.required ? ' *' : ''}</Text>
        {field.help_text ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{field.help_text}</Text> : null}
        <ActionButton title={file ? file.name : field.type === 'photo' ? 'Choose photo' : 'Choose file'} icon={field.type === 'photo' ? 'image' : 'paperclip'} variant="outline" onPress={onPick} />
      </View>
    );
  }
  if (field.type === 'gps') {
    return (
      <View style={{ gap: 6 }}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}{field.required ? ' *' : ''}</Text>
        {field.help_text ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{field.help_text}</Text> : null}
        <ActionButton
          title={location ? 'Location captured' : 'Capture location'}
          icon="map-pin"
          variant="outline"
          onPress={onCaptureLocation}
          disabled={!!location}
        />
        {location ? <Text style={[styles.body, { color: colors.success }]}>Lat: {location.lat.toFixed(5)} · Lng: {location.lng.toFixed(5)}</Text> : null}
      </View>
    );
  }
  if (field.type === 'yes_no' || field.type === 'single_choice' || field.type === 'dropdown' || field.type === 'rating' || field.type === 'multiple_choice') {
    const options = field.type === 'yes_no'
      ? [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }]
      : field.type === 'rating'
        ? Array.from({ length: Math.max(1, (field.max_val || 5) - (field.min_val || 1) + 1) }, (_, index) => {
            const rating = (field.min_val || 1) + index;
            return { label: String(rating), value: String(rating) };
          })
        : choices;
    const currentValues = Array.isArray(value) ? value.map(String) : [];
    return (
      <View style={{ gap: 6 }}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}{field.required ? ' *' : ''}</Text>
        {field.help_text ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{field.help_text}</Text> : null}
        <View style={styles.chips}>
          {options.map((option) => {
            const active = field.type === 'multiple_choice' ? currentValues.includes(option.value) : String(value ?? '') === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (field.type === 'multiple_choice') {
                    onChange(active ? currentValues.filter((item) => item !== option.value) : [...currentValues, option.value]);
                  } else if (field.type === 'rating') {
                    onChange(Number(option.value));
                  } else {
                    onChange(option.value);
                  }
                }}
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  const keyboardType = field.type === 'number' ? 'decimal-pad' : field.type === 'mobile' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default';
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}{field.required ? ' *' : ''}</Text>
      {field.help_text ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{field.help_text}</Text> : null}
      <TextInput
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChangeText={onChange}
        placeholder={field.placeholder || field.label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        multiline={field.type === 'long_text' || field.type === 'address'}
        textAlignVertical={field.type === 'long_text' || field.type === 'address' ? 'top' : 'center'}
        accessibilityLabel={field.label}
        style={[styles.input, (field.type === 'long_text' || field.type === 'address') && styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />
    </View>
  );
}

function TaskCard({ task, isWorker, onUpdate, pending }: { task: CampaignTask; isWorker: boolean; onUpdate: (status: string) => void; pending: boolean }) {
  const colors = useColors();
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.taskHeader}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.memberName, { color: colors.foreground }]}>{task.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{task.description || 'No additional instructions'}</Text>
        </View>
        <StatusBadge status={task.status} />
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {[task.assigned_to_name, task.location, task.due_date].filter(Boolean).join(' · ') || 'Unassigned task'}
      </Text>
      {isWorker && task.status !== 'completed' && task.status !== 'cancelled' ? (
        <View style={styles.chips}>
          {TASK_STATUSES.filter((status) => status !== task.status).map((status) => (
            <Pressable key={status} accessibilityRole="button" onPress={() => onUpdate(status)} disabled={pending} style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pending ? 0.5 : 1 }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>{status.replace(/_/g, ' ')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric' }) {
  const colors = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} accessibilityLabel={label} style={[styles.input, multiline && styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  statsRow: { flexDirection: 'row', gap: 8 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tab: { flexGrow: 1, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 11 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19 },
  memberName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  hint: { fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  multilineInput: { minHeight: 76, paddingTop: 11 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Manrope_600SemiBold', fontSize: 13, textTransform: 'capitalize' },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  responseCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  responseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectedCitizen: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  citizenChoice: { borderWidth: 1, borderRadius: 10, padding: 9, gap: 2 },
  builderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 11, padding: 6 },
  orderControls: { gap: 0 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  disabledIconButton: { opacity: 0.4 },
  requiredToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', gap: 9 },
  editorActions: { flexDirection: 'row', gap: 9 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  analyticsValue: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
});
