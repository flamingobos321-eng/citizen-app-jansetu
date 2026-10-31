import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Screen,
  uiStyles,
} from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Area = { id: string; name: string; kind: string };
type Karyakarta = {
  id: string;
  name: string;
  mobile: string;
  designation?: string;
  ward_id?: string;
  village_id?: string;
  dob?: string;
  anniversary?: string;
  notes?: string;
};
type KaryakartaList = { linked: Karyakarta[]; pending: Karyakarta[] };
type KaryakartaDraft = Omit<Karyakarta, 'id'>;
type ImportResult = { linked: number; pending: number; total: number; errors: Array<{ row: KaryakartaDraft; error: string }> };

const STAFF_ROLES = ['admin', 'pa', 'politician'];
const WRITE_ROLES = ['admin', 'pa'];
const DESIGNATIONS = [
  'Booth Agent',
  'Ward President',
  'Village President',
  'Volunteer',
  'Field Coordinator',
  'Youth Wing',
  'Women Wing',
  'Other',
];
const CSV_TEMPLATE =
  'name,mobile,designation,ward,village,dob,anniversary,notes\n' +
  'Ravi Patil,9999900010,Booth Agent,,,1985-07-14,2010-06-18,Cluster A booth\n' +
  'Suresh Jadhav,9999900011,Ward President,,,,,\n';

export default function KaryakartasScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [form, setForm] = useState<KaryakartaDraft>({
    name: '',
    mobile: '',
    designation: DESIGNATIONS[0],
  });
  const [csvRows, setCsvRows] = useState<KaryakartaDraft[]>([]);
  const [csvSkipped, setCsvSkipped] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [feedback, setFeedback] = useState('');

  const listQuery = useQuery({
    queryKey: ['karyakartas', token],
    queryFn: () => apiRequest<KaryakartaList>('/karyakartas', { token }),
    enabled: !!token && STAFF_ROLES.includes(user?.role || ''),
  });
  const areasQuery = useQuery({
    queryKey: ['karyakarta-areas', token],
    queryFn: () => apiRequest<Area[]>('/areas', { token }),
    enabled: !!token && STAFF_ROLES.includes(user?.role || ''),
  });
  const canWrite = WRITE_ROLES.includes(user?.role || '');
  const existingMobiles = new Set(
    [...(listQuery.data?.linked || []), ...(listQuery.data?.pending || [])]
      .map((person) => person.mobile.replace(/\D/g, ''))
      .filter(Boolean),
  );

  const addKaryakarta = useMutation({
    mutationFn: () => {
      const name = form.name.trim();
      const mobile = form.mobile.replace(/\D/g, '');
      if (!name) throw new Error('Enter the person’s name.');
      if (!/^\d{10}$/.test(mobile)) throw new Error('Enter a valid 10-digit mobile number.');
      if (existingMobiles.has(mobile)) throw new Error('A karyakarta with this mobile number is already listed.');
      const payload = compactDraft({ ...form, name, mobile });
      validateDates(payload);
      return apiRequest<{ linked: boolean }>('/karyakartas', { method: 'POST', token, body: payload });
    },
    onSuccess: async (result) => {
      setForm({ name: '', mobile: '', designation: DESIGNATIONS[0] });
      setFeedback(result.linked ? 'Added and linked to the existing citizen account.' : 'Saved as pending. It will link when the person registers.');
      await queryClient.invalidateQueries({ queryKey: ['karyakartas', token] });
    },
  });
  const removeKaryakarta = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/karyakartas/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['karyakartas', token] }),
  });
  const importKaryakartas = useMutation({
    mutationFn: () =>
      apiRequest<ImportResult>('/karyakartas/bulk-import', {
        method: 'POST',
        token,
        body: csvRows,
      }),
    onSuccess: async (result) => {
      setImportResult(result);
      setCsvRows([]);
      setFeedback(`Import complete: ${result.linked} linked, ${result.pending} pending${result.errors.length ? `, ${result.errors.length} failed` : ''}.`);
      await queryClient.invalidateQueries({ queryKey: ['karyakartas', token] });
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!STAFF_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const areas = areasQuery.data || [];
  const wards = areas.filter((area) => area.kind === 'ward');
  const villages = areas.filter((area) => area.kind === 'village');
  const areaName = (id?: string) => areas.find((area) => area.id === id)?.name;
  const refresh = () => Promise.all([listQuery.refetch(), areasQuery.refetch()]);
  const confirmRemove = (person: Karyakarta) => {
    const message = `Remove ${person.name} from the karyakarta list? Their citizen account and service history will remain; only their karyakarta role will be removed.`;
    const remove = () => removeKaryakarta.mutate(person.id);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) remove();
      return;
    }
    Alert.alert('Remove karyakarta?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  };
  const parseAndSetCsv = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const text = await new File(picked.assets[0].uri).text();
      const parsed = parseCsv(text, areas);
      const uniqueRows: KaryakartaDraft[] = [];
      const seen = new Set(existingMobiles);
      let skipped = parsed.invalidRows;
      for (const row of parsed.rows) {
        if (seen.has(row.mobile)) {
          skipped += 1;
          continue;
        }
        seen.add(row.mobile);
        uniqueRows.push(row);
      }
      setCsvRows(uniqueRows);
      setCsvSkipped(skipped);
      setImportResult(null);
      setFeedback('');
      if (!uniqueRows.length) {
        setFeedback('No new valid rows found. Check the CSV columns and mobile numbers.');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? `Could not read the CSV: ${error.message}` : 'Could not read this CSV file.');
    }
  };
  const downloadTemplate = async () => {
    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
        link.download = 'karyakarta_template.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }
      const template = new File(Paths.cache, 'karyakarta_template.csv');
      template.write(CSV_TEMPLATE);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(template.uri, { mimeType: 'text/csv', dialogTitle: 'Save CSV template' });
      } else {
        setFeedback(`Template saved to ${template.uri}`);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not create the CSV template.');
    }
  };
  const startImport = () => {
    if (!csvRows.length) return;
    const message = `Import ${csvRows.length} new karyakarta records? ${csvSkipped} duplicate or invalid rows will be skipped. Existing citizens may be assigned the karyakarta role; other records will be kept pending until they register.`;
    const run = () => importKaryakartas.mutate();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) run();
      return;
    }
    Alert.alert('Confirm CSV import', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Import', onPress: run },
    ]);
  };
  const queryError = listQuery.error || areasQuery.error;
  const mutationError = addKaryakarta.error || removeKaryakarta.error || importKaryakartas.error;

  return (
    <Screen
      keyboardAware
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={listQuery.isRefetching || areasQuery.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow="OFFICE WORKSPACE"
        title="Karyakartas"
        subtitle="Track party workers and volunteers. Pending records link when they register."
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

      {queryError ? (
        <ErrorNotice
          message={queryError instanceof Error ? queryError.message : 'Could not load karyakarta records.'}
          onRetry={() => void refresh()}
        />
      ) : null}
      {mutationError ? <ErrorNotice message={mutationError instanceof Error ? mutationError.message : 'Could not complete this action.'} /> : null}
      {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: colors.primary }]}>{feedback}</Text> : null}

      {canWrite ? (
        <>
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add a karyakarta</Text>
            <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
              If this number belongs to a citizen in this office, the role is linked now. Otherwise the record stays pending.
            </Text>
            <Field label="Name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} placeholder="Full name" />
            <Field label="Mobile" value={form.mobile} onChange={(mobile) => setForm((current) => ({ ...current, mobile: mobile.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile number" keyboardType="phone-pad" />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Designation</Text>
            <View style={styles.chips}>
              {DESIGNATIONS.map((designation) => (
                <Chip key={designation} label={designation} selected={form.designation === designation} onPress={() => setForm((current) => ({ ...current, designation }))} />
              ))}
            </View>
            <AreaPicker title="Ward" areas={wards} value={form.ward_id} onChange={(ward_id) => setForm((current) => ({ ...current, ward_id }))} />
            <AreaPicker title="Village" areas={villages} value={form.village_id} onChange={(village_id) => setForm((current) => ({ ...current, village_id }))} />
            <Field label="Date of birth" value={form.dob || ''} onChange={(dob) => setForm((current) => ({ ...current, dob }))} placeholder="YYYY-MM-DD (optional)" />
            <Field label="Anniversary" value={form.anniversary || ''} onChange={(anniversary) => setForm((current) => ({ ...current, anniversary }))} placeholder="YYYY-MM-DD (optional)" />
            <Field label="Notes" value={form.notes || ''} onChange={(notes) => setForm((current) => ({ ...current, notes }))} placeholder="Optional" multiline />
            <ActionButton
              title="Add karyakarta"
              icon="user-plus"
              onPress={() => addKaryakarta.mutate()}
              loading={addKaryakarta.isPending}
            />
          </Card>

          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bulk import CSV</Text>
            <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
              Import a CSV with name and mobile columns. Existing phone numbers are skipped to avoid duplicate records.
            </Text>
            <Text selectable style={[styles.template, { color: colors.mutedForeground, borderColor: colors.border }]}>
              name,mobile,designation,ward,village,dob,anniversary,notes
            </Text>
            <View style={styles.buttonRow}>
              <ActionButton title="Get CSV template" icon="download" variant="outline" onPress={() => void downloadTemplate()} />
              <ActionButton title="Choose CSV" icon="upload" variant="outline" onPress={() => void parseAndSetCsv()} />
            </View>
            {csvRows.length ? (
              <View style={styles.preview}>
                <Text style={[styles.previewTitle, { color: colors.foreground }]}>
                  {csvRows.length} new rows ready · {csvSkipped} skipped
                </Text>
                {csvRows.slice(0, 3).map((row) => (
                  <Text key={`${row.mobile}-${row.name}`} style={[styles.previewLine, { color: colors.mutedForeground }]}>
                    {row.name} · {row.mobile} · {row.designation || 'No designation'}
                  </Text>
                ))}
                {csvRows.length > 3 ? <Text style={[styles.previewLine, { color: colors.mutedForeground }]}>and {csvRows.length - 3} more…</Text> : null}
                <ActionButton
                  title={`Import ${csvRows.length} rows`}
                  icon="upload"
                  onPress={startImport}
                  loading={importKaryakartas.isPending}
                />
              </View>
            ) : null}
            {importResult?.errors.length ? (
              <View style={styles.preview}>
                <Text style={[styles.previewTitle, { color: colors.destructive }]}>Rows that could not be imported</Text>
                {importResult.errors.slice(0, 5).map((item, index) => (
                  <Text key={`${item.row.mobile}-${index}`} style={[styles.previewLine, { color: colors.mutedForeground }]}>
                    {item.row.name || item.row.mobile}: {item.error}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {listQuery.isLoading ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading karyakarta list…</Text></Card>
      ) : (
        <>
          <Section title="Linked karyakartas" count={listQuery.data?.linked.length || 0} icon="check-circle">
            {listQuery.data?.linked.length ? listQuery.data.linked.map((person) => (
              <PersonCard key={person.id} person={person} status="Linked" areaName={areaName} canWrite={canWrite} onDelete={() => confirmRemove(person)} />
            )) : <EmptyState icon="users" title="No linked karyakartas" body="People already registered with this office appear here." />}
          </Section>
          <Section title="Pending karyakartas" count={listQuery.data?.pending.length || 0} icon="clock">
            {listQuery.data?.pending.length ? listQuery.data.pending.map((person) => (
              <PersonCard key={person.id} person={person} status="Pending registration" areaName={areaName} canWrite={canWrite} onDelete={() => confirmRemove(person)} />
            )) : <EmptyState icon="clock" title="No pending records" body="People who have not registered yet will appear here." />}
          </Section>
        </>
      )}
    </Screen>
  );
}

function Section({ title, count, icon, children }: { title: string; count: number; icon: 'check-circle' | 'clock'; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Feather name={icon} size={16} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

function PersonCard({
  person,
  status,
  areaName,
  canWrite,
  onDelete,
}: {
  person: Karyakarta;
  status: string;
  areaName: (id?: string) => string | undefined;
  canWrite: boolean;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.personCard}>
      <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{person.name.trim().charAt(0).toUpperCase() || 'K'}</Text>
      </View>
      <View style={styles.personCopy}>
        <Text style={[styles.personName, { color: colors.foreground }]} numberOfLines={1}>{person.name}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{person.mobile} · {person.designation || 'No designation'}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
          {[areaName(person.ward_id) ? `Ward: ${areaName(person.ward_id)}` : '', areaName(person.village_id) ? `Village: ${areaName(person.village_id)}` : '', status]
            .filter(Boolean).join(' · ')}
        </Text>
        {person.dob || person.anniversary ? (
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {[person.dob ? `DOB ${person.dob}` : '', person.anniversary ? `Anniversary ${person.anniversary}` : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {person.notes ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{person.notes}</Text> : null}
      </View>
      {canWrite ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.name}`} onPress={onDelete} style={[styles.deleteButton, { borderColor: colors.border }]}>
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      ) : null}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
      />
    </View>
  );
}

function AreaPicker({ title, areas, value, onChange }: { title: string; areas: Area[]; value?: string; onChange: (id: string | undefined) => void }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{title} (optional)</Text>
      <View style={styles.chips}>
        <Chip label="None" selected={!value} onPress={() => onChange(undefined)} />
        {areas.map((area) => <Chip key={area.id} label={area.name} selected={value === area.id} onPress={() => onChange(area.id)} />)}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.secondary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function parseCsv(text: string, areas: Area[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [] as KaryakartaDraft[], invalidRows: 0 };
  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: KaryakartaDraft[] = [];
  let invalidRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = cells[index]?.trim() || ''; });
    const mobile = (row.mobile || row['mobile number'] || '').replace(/\D/g, '');
    const ward = areas.find((area) => area.kind === 'ward' && area.name.toLowerCase() === (row.ward || '').toLowerCase());
    const village = areas.find((area) => area.kind === 'village' && area.name.toLowerCase() === (row.village || '').toLowerCase());
    const candidate: KaryakartaDraft = compactDraft({
      name: row.name || '',
      mobile,
      designation: row.designation || row.role || undefined,
      ward_id: row.ward_id || ward?.id,
      village_id: row.village_id || village?.id,
      dob: row.dob || row['date of birth'] || undefined,
      anniversary: row.anniversary || row['marriage anniversary'] || undefined,
      notes: row.notes || undefined,
    });
    if (!candidate.name || !/^\d{10}$/.test(candidate.mobile)) {
      invalidRows += 1;
      continue;
    }
    rows.push(candidate);
  }
  return { rows, invalidRows };
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function compactDraft<T extends Record<string, unknown>>(draft: T): T {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '' && value !== undefined && value !== null)) as T;
}

function validateDates(draft: KaryakartaDraft) {
  for (const [label, value] of [['Date of birth', draft.dob], ['Anniversary', draft.anniversary]] as const) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${label} must use YYYY-MM-DD format.`);
    }
  }
}

const styles = StyleSheet.create({
  backButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  formCard: { gap: 11 },
  section: { gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  count: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  field: { gap: 5 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  multiline: { minHeight: 84, paddingTop: 10, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 },
  buttonRow: { gap: 8 },
  template: { borderWidth: 1, borderRadius: 10, padding: 10, fontFamily: 'Manrope_500Medium', fontSize: 10 },
  preview: { gap: 7, paddingTop: 8 },
  previewTitle: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  previewLine: { fontFamily: 'Manrope_400Regular', fontSize: 11 },
  feedback: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  personCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Outfit_700Bold', fontSize: 17 },
  personCopy: { flex: 1, gap: 3 },
  personName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 16 },
  deleteButton: { width: 37, height: 37, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
