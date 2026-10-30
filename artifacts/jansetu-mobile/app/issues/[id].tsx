import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ActionButton,
  Card,
  ErrorNotice,
  PageHeader,
  Screen,
  StatusBadge,
  uiStyles,
} from '@/components/ui';
import { apiRequest, uploadIssuePhoto, type Issue } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

type IssueDetailResponse = { issue: Issue };
type Worker = { id: string; name: string; designation?: string; mobile?: string };
const WORKFLOW_STATUSES = ['Under Review', 'In Progress', 'Resolved'];
const MAX_COMPLETION_PHOTOS = 5;

export default function IssueDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { token, user, loading: authLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['citizen-issue', id, token],
    queryFn: () => apiRequest<IssueDetailResponse>(`/issues/${encodeURIComponent(id)}`, { token }),
    enabled: !!id && !!token,
  });
  const issue = query.data?.issue;
  const canAssign = user?.role === 'pa' || user?.role === 'admin';
  const isAssignee = user?.role === 'worker' && issue?.assigned_to === user.id;
  const canUpdateStatus = canAssign || isAssignee;
  const [statusUpdate, setStatusUpdate] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [photoError, setPhotoError] = useState('');
  const workersQuery = useQuery({
    queryKey: ['office-workers', token],
    queryFn: () => apiRequest<Worker[]>('/users?role=worker', { token }),
    enabled: !!token && canAssign,
  });
  const addCompletionPhotos = async (source: 'library' | 'camera') => {
    setPhotoError('');
    if (completionPhotos.length >= MAX_COMPLETION_PHOTOS) {
      setPhotoError(`You can attach up to ${MAX_COMPLETION_PHOTOS} completion photos.`);
      return;
    }
    try {
      if (source === 'library') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPhotoError('Photo library access was not granted. Allow access in settings to attach photos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: MAX_COMPLETION_PHOTOS - completionPhotos.length,
          quality: 0.8,
        });
        if (!result.canceled) {
          setCompletionPhotos((current) => [...current, ...result.assets].slice(0, MAX_COMPLETION_PHOTOS));
        }
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPhotoError('Camera access was not granted. Allow access in settings to take a photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!result.canceled) {
          setCompletionPhotos((current) => [...current, ...result.assets].slice(0, MAX_COMPLETION_PHOTOS));
        }
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? `Could not add a photo: ${error.message}` : 'Could not open the photo picker.');
    }
  };
  const chooseCompletionPhotos = () => {
    Alert.alert('Add completion photos', 'Choose where to get the photos.', [
      { text: 'Take a photo', onPress: () => void addCompletionPhotos('camera') },
      { text: 'Choose from library', onPress: () => void addCompletionPhotos('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const refreshIssue = async () => {
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ['office-issues', token] }),
    ]);
  };
  const updateIssueStatus = useMutation({
    mutationFn: async () => {
      if (!statusUpdate) throw new Error('Choose a status first.');
      const uploadedPhotos = statusUpdate === 'Resolved'
        ? await Promise.all(
            completionPhotos.map(async (photo, index) => {
              const extension = photo.mimeType?.split('/')[1] || 'jpg';
              const name = photo.fileName || `completion-photo-${index + 1}.${extension}`;
              const uploaded = await uploadIssuePhoto(
                { uri: photo.uri, name, type: photo.mimeType || 'image/jpeg', file: photo.file },
                token,
              );
              return uploaded.path;
            }),
          )
        : [];
      return apiRequest<Issue>(`/issues/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        token,
        body: {
          status: statusUpdate,
          remarks: statusNote.trim() || undefined,
          completion_notes: statusUpdate === 'Resolved' ? statusNote.trim() || undefined : undefined,
          completion_photos: uploadedPhotos,
        },
      });
    },
    onSuccess: async () => {
      setStatusNote('');
      setCompletionPhotos([]);
      setPhotoError('');
      await refreshIssue();
    },
  });
  const assignIssue = useMutation({
    mutationFn: () => {
      if (!assignTo) throw new Error('Choose a field worker first.');
      return apiRequest<Issue>(`/issues/${encodeURIComponent(id)}/assign`, {
        method: 'POST',
        token,
        body: {
          assigned_to: assignTo,
          due_date: dueDate.trim() || null,
          remarks: assignmentNote.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      setAssignmentNote('');
      await refreshIssue();
    },
  });
  const requestReassignment = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean }>(
        `/issues/${encodeURIComponent(id)}/request-reassign?reason=${encodeURIComponent(statusNote.trim())}`,
        { method: 'POST', token },
      ),
    onSuccess: async () => {
      setStatusNote('');
      await refreshIssue();
    },
  });
  const approveReassignment = useMutation({
    mutationFn: () => {
      if (!assignTo) throw new Error('Choose a field worker first.');
      return apiRequest<Issue>(
        `/issues/${encodeURIComponent(id)}/approve-reassign?new_worker_id=${encodeURIComponent(assignTo)}`,
        { method: 'POST', token },
      );
    },
    onSuccess: refreshIssue,
  });
  const rejectReassignment = useMutation({
    mutationFn: () =>
      apiRequest<Issue>(
        `/issues/${encodeURIComponent(id)}/reject-reassign?note=${encodeURIComponent(assignmentNote.trim())}`,
        { method: 'POST', token },
      ),
    onSuccess: refreshIssue,
  });
  const submitFeedback = useMutation({
    mutationFn: (verified: boolean) =>
      apiRequest<Issue>(`/issues/${encodeURIComponent(id)}/feedback`, {
        method: 'POST',
        token,
        body: { rating, comment: feedbackComment.trim() || null, verified },
      }),
    onSuccess: refreshIssue,
  });

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(user?.role === 'citizen' ? '/(tabs)/issues' : '/office');
  };

  if (authLoading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Screen>
      <View style={styles.topline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={18} color={colors.primary} />
          <Text style={[styles.back, { color: colors.primary }]}>Back to issues</Text>
        </Pressable>
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

          {user?.role === 'politician' ? (
            <Card>
              <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
                Representative access is monitoring-only. A PA or office admin handles assignment and status changes.
              </Text>
            </Card>
          ) : null}

          {canAssign ? (
            <Card style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Assign to field staff</Text>
              {issue.assigned_to_name ? (
                <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                  Currently assigned to {issue.assigned_to_name}
                </Text>
              ) : null}
              {workersQuery.isError ? (
                <ErrorNotice message="Could not load office workers." onRetry={() => void workersQuery.refetch()} />
              ) : workersQuery.isLoading ? (
                <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>Loading field staff…</Text>
              ) : (
                <WorkerChoices
                  workers={workersQuery.data || []}
                  selected={assignTo}
                  onSelect={setAssignTo}
                />
              )}
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="Due date (YYYY-MM-DD, optional)"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Issue due date"
                style={[styles.actionInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <TextInput
                value={assignmentNote}
                onChangeText={setAssignmentNote}
                placeholder="Assignment instructions (optional)"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Assignment instructions"
                multiline
                style={[styles.actionInput, styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              {assignIssue.isError ? (
                <ErrorNotice message={assignIssue.error instanceof Error ? assignIssue.error.message : 'Could not assign this issue.'} />
              ) : null}
              <ActionButton
                title="Assign issue"
                icon="user-plus"
                onPress={() => assignIssue.mutate()}
                loading={assignIssue.isPending}
                disabled={!assignTo || workersQuery.isLoading}
              />
            </Card>
          ) : null}

          {canAssign && issue.status === 'Reassignment Requested' ? (
            <Card style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Review reassignment request</Text>
              <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                {issue.reassignment_request?.requested_by_name || 'Field worker'} requested a handoff.
                {issue.reassignment_request?.reason ? ` Reason: ${issue.reassignment_request.reason}` : ''}
              </Text>
              <WorkerChoices
                workers={(workersQuery.data || []).filter((worker) => worker.id !== issue.assigned_to)}
                selected={assignTo}
                onSelect={setAssignTo}
              />
              <TextInput
                value={assignmentNote}
                onChangeText={setAssignmentNote}
                placeholder="Optional note for the decision"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Reassignment decision note"
                style={[styles.actionInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <View style={styles.buttonRow}>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    title="Approve"
                    icon="check"
                    onPress={() => approveReassignment.mutate()}
                    loading={approveReassignment.isPending}
                    disabled={!assignTo || workersQuery.isLoading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    title="Reject"
                    icon="x"
                    variant="outline"
                    onPress={() => rejectReassignment.mutate()}
                    loading={rejectReassignment.isPending}
                  />
                </View>
              </View>
              {approveReassignment.isError || rejectReassignment.isError ? (
                <ErrorNotice message="Could not process this reassignment request." />
              ) : null}
            </Card>
          ) : null}

          {canUpdateStatus ? (
            <Card style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Update issue progress</Text>
              <StatusChoices
                statuses={WORKFLOW_STATUSES}
                selected={statusUpdate}
                onSelect={setStatusUpdate}
              />
              {statusUpdate === 'Resolved' ? (
                <View style={styles.photoSection}>
                  <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                    Completion photos are recommended when marking work resolved.
                  </Text>
                  <View style={styles.photoRow}>
                    {completionPhotos.map((photo) => (
                      <View key={photo.uri} style={styles.photoWrap}>
                        <Image source={{ uri: photo.uri }} style={styles.photoThumb} accessibilityLabel="Completion photo preview" />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove completion photo"
                          onPress={() => setCompletionPhotos((current) => current.filter((item) => item.uri !== photo.uri))}
                          style={[styles.removePhoto, { backgroundColor: colors.foreground }]}
                        >
                          <Feather name="x" size={12} color={colors.background} />
                        </Pressable>
                      </View>
                    ))}
                    {completionPhotos.length < MAX_COMPLETION_PHOTOS ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add completion photos"
                        onPress={chooseCompletionPhotos}
                        style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                      >
                        <Feather name="plus" size={18} color={colors.primary} />
                        <Text style={[styles.photoLabel, { color: colors.primary }]}>Add</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {photoError ? <ErrorNotice message={photoError} /> : null}
                </View>
              ) : null}
              <TextInput
                value={statusNote}
                onChangeText={setStatusNote}
                placeholder="Progress note"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Issue progress note"
                multiline
                style={[styles.actionInput, styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              {updateIssueStatus.isError ? (
                <ErrorNotice message={updateIssueStatus.error instanceof Error ? updateIssueStatus.error.message : 'Could not update issue status.'} />
              ) : null}
              <ActionButton
                title="Save progress"
                icon="save"
                onPress={() => updateIssueStatus.mutate()}
                loading={updateIssueStatus.isPending}
                disabled={!statusUpdate}
              />
            </Card>
          ) : null}

          {isAssignee && issue.status !== 'Reassignment Requested' ? (
            <Card style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Need another worker?</Text>
              <TextInput
                value={statusNote}
                onChangeText={setStatusNote}
                placeholder="Reason for handoff (optional)"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Reassignment reason"
                style={[styles.actionInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <ActionButton
                title="Request reassignment"
                icon="corner-up-right"
                variant="outline"
                onPress={() => requestReassignment.mutate()}
                loading={requestReassignment.isPending}
              />
              {requestReassignment.isError ? (
                <ErrorNotice message={requestReassignment.error instanceof Error ? requestReassignment.error.message : 'Could not request reassignment.'} />
              ) : null}
            </Card>
          ) : null}

          {user?.role === 'citizen' && issue.status === 'Resolved' ? (
            <Card style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Was this issue resolved?</Text>
              <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
                Confirm the fix or reopen the issue if more work is needed.
              </Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate resolution ${value} out of 5`}
                    accessibilityState={{ selected: rating === value }}
                    onPress={() => setRating(value)}
                    style={[
                      styles.ratingButton,
                      { backgroundColor: rating === value ? colors.primary : colors.secondary },
                    ]}
                  >
                    <Text style={{ color: rating === value ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold' }}>
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={feedbackComment}
                onChangeText={setFeedbackComment}
                placeholder="Add a comment (optional)"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Resolution feedback"
                multiline
                style={[styles.actionInput, styles.multilineInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              {submitFeedback.isError ? (
                <ErrorNotice message={submitFeedback.error instanceof Error ? submitFeedback.error.message : 'Could not save your feedback.'} />
              ) : null}
              <ActionButton
                title="Confirm resolution"
                icon="check-circle"
                onPress={() => submitFeedback.mutate(true)}
                loading={submitFeedback.isPending}
              />
              <ActionButton
                title="Reopen issue"
                icon="rotate-ccw"
                variant="outline"
                onPress={() => submitFeedback.mutate(false)}
                disabled={submitFeedback.isPending}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topline: { marginLeft: -2 },
  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  back: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.8 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  meta: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 19, marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 80 },
  timelineRail: { alignItems: 'center', width: 13 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 },
  timelineLine: { width: 1.5, flex: 1, marginTop: 4, marginBottom: -2 },
  timelineCard: { flex: 1, padding: 13, gap: 5, marginBottom: 8 },
  eventStatus: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  note: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
  actionCard: { gap: 12 },
  actionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  actionHint: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19 },
  actionInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
  },
  multilineInput: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  workerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workerChoice: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  ratingRow: { flexDirection: 'row', gap: 10 },
  ratingButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  photoSection: { gap: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  photoWrap: { width: 64, height: 64, position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 11 },
  removePhoto: { position: 'absolute', top: -5, right: -5, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 64, height: 64, borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoLabel: { fontFamily: 'Manrope_700Bold', fontSize: 10 },
});

function WorkerChoices({
  workers,
  selected,
  onSelect,
}: {
  workers: Worker[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  if (!workers.length) {
    return <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>No field workers are available.</Text>;
  }
  return (
    <View style={styles.workerChoices}>
      {workers.map((worker) => {
        const active = selected === worker.id;
        return (
          <Pressable
            key={worker.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Assign to ${worker.name}${worker.designation ? `, ${worker.designation}` : ''}`}
            onPress={() => onSelect(worker.id)}
            style={[
              styles.workerChoice,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>
              {worker.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatusChoices({
  statuses,
  selected,
  onSelect,
}: {
  statuses: string[];
  selected: string;
  onSelect: (status: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.workerChoices}>
      {statuses.map((status) => {
        const active = selected === status;
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(status)}
            style={[
              styles.workerChoice,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>
              {status}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
