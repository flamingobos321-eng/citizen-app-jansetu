import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

type Tab = 'areas' | 'staff' | 'taxonomy';
type Area = {
  id: string;
  constituency_id: string;
  name: string;
  kind: string;
  region_type: 'urban' | 'rural';
};
type Constituency = { id: string; name: string };
type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  mobile?: string;
};
type TaxonomyEntry = { id: string; name: string; code?: string; category?: string };
type AreaForm = {
  name: string;
  kind: 'city' | 'ward' | 'area' | 'booth' | 'taluka' | 'village' | 'wasti';
  region_type: 'urban' | 'rural';
  constituency_id: string;
};
type StaffForm = {
  name: string;
  email: string;
  password: string;
  role: 'worker' | 'pa' | 'politician' | 'admin';
  designation: string;
  mobile: string;
};

const ADMIN_ROLES = ['admin', 'pa'];
const AREA_KINDS: AreaForm['kind'][] = ['city', 'ward', 'area', 'booth', 'taluka', 'village', 'wasti'];
const STAFF_ROLES: StaffForm['role'][] = ['worker', 'pa', 'politician', 'admin'];
const CASTE_CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];

export default function OfficeAdminScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('areas');
  const [areaForm, setAreaForm] = useState<AreaForm>({
    name: '',
    kind: 'ward',
    region_type: 'urban',
    constituency_id: '',
  });
  const [staffForm, setStaffForm] = useState<StaffForm>({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    designation: '',
    mobile: '',
  });
  const [casteForm, setCasteForm] = useState({ name: '', code: '', category: 'General' });
  const [religionForm, setReligionForm] = useState({ name: '', code: '' });
  const [formError, setFormError] = useState('');

  const constituenciesQuery = useQuery({
    queryKey: ['admin-constituencies', token],
    queryFn: () => apiRequest<Constituency[]>('/constituencies', { token }),
    enabled: !!token && user?.role === 'admin',
  });
  const areasQuery = useQuery({
    queryKey: ['admin-areas', token],
    queryFn: () => apiRequest<Area[]>('/areas', { token }),
    enabled: !!token && user?.role === 'admin',
  });
  const staffQuery = useQuery({
    queryKey: ['admin-staff', token],
    queryFn: async () => {
      const users = await apiRequest<StaffMember[]>('/users', { token });
      return users.filter((member) => member.role !== 'citizen');
    },
    enabled: !!token && user?.role === 'admin',
  });
  const castesQuery = useQuery({
    queryKey: ['admin-castes', token],
    queryFn: () => apiRequest<TaxonomyEntry[]>('/castes', { token }),
    enabled: !!token && ADMIN_ROLES.includes(user?.role || ''),
  });
  const religionsQuery = useQuery({
    queryKey: ['admin-religions', token],
    queryFn: () => apiRequest<TaxonomyEntry[]>('/religions', { token }),
    enabled: !!token && ADMIN_ROLES.includes(user?.role || ''),
  });

  useEffect(() => {
    if (!areaForm.constituency_id && constituenciesQuery.data?.[0]) {
      setAreaForm((form) => ({ ...form, constituency_id: constituenciesQuery.data![0].id }));
    }
  }, [areaForm.constituency_id, constituenciesQuery.data]);
  useEffect(() => {
    if (user?.role === 'pa') setTab('taxonomy');
  }, [user?.role]);

  const refreshAll = async () => {
    await Promise.all([
      constituenciesQuery.refetch(),
      areasQuery.refetch(),
      staffQuery.refetch(),
      castesQuery.refetch(),
      religionsQuery.refetch(),
    ]);
  };
  const invalidate = async (...keys: string[]) => {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key, token] })));
  };
  const createArea = useMutation({
    mutationFn: () => {
      if (!areaForm.name.trim()) throw new Error('Enter an area name.');
      if (!areaForm.constituency_id) throw new Error('Select a constituency first.');
      return apiRequest<Area>('/areas', {
        method: 'POST',
        token,
        body: { ...areaForm, name: areaForm.name.trim() },
      });
    },
    onSuccess: async () => {
      setAreaForm((form) => ({ ...form, name: '' }));
      setFormError('');
      await invalidate('admin-areas');
    },
  });
  const deleteArea = useMutation({
    mutationFn: (areaId: string) => apiRequest(`/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE', token }),
    onSuccess: () => invalidate('admin-areas'),
  });
  const createStaff = useMutation({
    mutationFn: () => {
      const name = staffForm.name.trim();
      const email = staffForm.email.trim().toLowerCase();
      if (!name || !email || !staffForm.password) {
        throw new Error('Name, email, and a temporary password are required.');
      }
      if (email === 'admin@jansetu.in') {
        throw new Error('This email belongs to the platform super admin. Use a tenant staff email.');
      }
      return apiRequest<StaffMember>('/admin/staff', {
        method: 'POST',
        token,
        body: {
          ...staffForm,
          name,
          email,
          designation: staffForm.designation.trim() || null,
          mobile: staffForm.mobile.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      setStaffForm({ name: '', email: '', password: '', role: 'worker', designation: '', mobile: '' });
      setFormError('');
      await invalidate('admin-staff');
    },
  });
  const createTaxonomy = useMutation({
    mutationFn: async (kind: 'caste' | 'religion') => {
      const form = kind === 'caste' ? casteForm : religionForm;
      if (!form.name.trim()) throw new Error(`Enter a ${kind} name.`);
      const body = kind === 'caste'
        ? { name: form.name.trim(), code: casteForm.code.trim() || undefined, category: casteForm.category }
        : { name: form.name.trim(), code: religionForm.code.trim() || undefined };
      return apiRequest<TaxonomyEntry>(`/${kind === 'caste' ? 'castes' : 'religions'}`, {
        method: 'POST',
        token,
        body,
      });
    },
    onSuccess: async (_entry, kind) => {
      if (kind === 'caste') setCasteForm({ name: '', code: '', category: 'General' });
      else setReligionForm({ name: '', code: '' });
      setFormError('');
      await invalidate(kind === 'caste' ? 'admin-castes' : 'admin-religions');
    },
  });
  const deleteTaxonomy = useMutation({
    mutationFn: ({ kind, id }: { kind: 'caste' | 'religion'; id: string }) =>
      apiRequest(`/${kind === 'caste' ? 'castes' : 'religions'}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: (_result, variables) => invalidate(variables.kind === 'caste' ? 'admin-castes' : 'admin-religions'),
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!ADMIN_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const setErrorFrom = (error: unknown) => {
    setFormError(error instanceof Error ? error.message : 'The request could not be completed.');
  };
  const runMutation = (action: () => void) => {
    setFormError('');
    action();
  };
  const showConfirm = (title: string, message: string, confirm: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) confirm();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: confirm },
    ]);
  };
  const mutationError =
    createArea.error || deleteArea.error || createStaff.error || createTaxonomy.error || deleteTaxonomy.error;
  const anyLoading = constituenciesQuery.isLoading || areasQuery.isLoading || staffQuery.isLoading || castesQuery.isLoading || religionsQuery.isLoading;

  return (
    <Screen
      keyboardAware
      contentStyle={{ gap: 14 }}
      refreshControl={
        <RefreshControl refreshing={areasQuery.isRefetching || staffQuery.isRefetching} onRefresh={() => void refreshAll()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow="OFFICE WORKSPACE"
        title="Administration"
        subtitle="Manage constituency setup and office accounts."
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

      {user?.role === 'admin' ? (
        <View style={styles.tabs}>
          <TabButton label="Areas" value="areas" active={tab === 'areas'} onPress={() => setTab('areas')} />
          <TabButton label="Staff & roles" value="staff" active={tab === 'staff'} onPress={() => setTab('staff')} />
          <TabButton label="Taxonomy" value="taxonomy" active={tab === 'taxonomy'} onPress={() => setTab('taxonomy')} />
        </View>
      ) : (
        <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.paNote, { color: colors.primary }]}>PA access: caste and religion lists</Text>
          <TabButton label="Caste & religion" value="taxonomy" active onPress={() => setTab('taxonomy')} />
        </View>
      )}

      {formError ? <ErrorNotice message={formError} /> : null}
      {mutationError ? (
        <ErrorNotice message={mutationError instanceof Error ? mutationError.message : 'The request could not be completed.'} />
      ) : null}
      {anyLoading ? <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading administration data…</Text></Card> : null}

      {tab === 'areas' && user?.role === 'admin' ? (
        <View style={styles.section}>
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add a constituency area</Text>
            <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Choose an area type and region. Deleting an area may leave existing records without a matching area.</Text>
            <Field label="Name" value={areaForm.name} onChange={(value) => { setAreaForm((form) => ({ ...form, name: value })); setFormError(''); }} placeholder="Area name" />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Type</Text>
            <ChoiceRow values={AREA_KINDS} value={areaForm.kind} onChange={(kind) => setAreaForm((form) => ({ ...form, kind: kind as AreaForm['kind'] }))} />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Region</Text>
            <ChoiceRow values={['urban', 'rural']} value={areaForm.region_type} onChange={(region_type) => setAreaForm((form) => ({ ...form, region_type: region_type as AreaForm['region_type'] }))} />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Constituency</Text>
            {constituenciesQuery.data?.length ? (
              <View style={styles.choiceRow}>
                {constituenciesQuery.data.map((constituency) => (
                  <ChoiceChip key={constituency.id} label={constituency.name} active={areaForm.constituency_id === constituency.id} onPress={() => setAreaForm((form) => ({ ...form, constituency_id: constituency.id }))} />
                ))}
              </View>
            ) : (
              <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>No constituency is configured for this office.</Text>
            )}
            <ActionButton title="Add area" icon="plus" onPress={() => runMutation(() => createArea.mutate(undefined, { onError: setErrorFrom }))} loading={createArea.isPending} />
          </Card>

          {areasQuery.data?.length ? (
            <View style={styles.section}>
              {groupAreas(areasQuery.data).map(([kind, items]) => (
                <View key={kind} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{capitalize(kind)}s · {items.length}</Text>
                  {items.map((area) => (
                    <Card key={area.id} style={styles.rowCard}>
                      <View style={styles.rowCopy}>
                        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{area.name}</Text>
                        <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>{capitalize(area.region_type)}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete area ${area.name}`}
                        onPress={() => showConfirm('Delete area?', `${area.name} will be removed from this office’s area list. Existing records are not deleted, but area references may need correction.`, () => deleteArea.mutate(area.id))}
                        style={[styles.deleteButton, { borderColor: colors.border }]}
                      >
                        <Feather name="trash-2" size={16} color={colors.destructive} />
                      </Pressable>
                    </Card>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState icon="map" title="No areas configured" body="Add wards, villages, booths, or other divisions for this constituency." />
          )}
        </View>
      ) : null}

      {tab === 'staff' && user?.role === 'admin' ? (
        <View style={styles.section}>
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add staff member</Text>
            <Field label="Name" value={staffForm.name} onChange={(name) => setStaffForm((form) => ({ ...form, name }))} placeholder="Full name" />
            <Field label="Email" value={staffForm.email} onChange={(email) => setStaffForm((form) => ({ ...form, email }))} placeholder="name@your-portal.jansetu.in" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Temporary password" value={staffForm.password} onChange={(password) => setStaffForm((form) => ({ ...form, password }))} placeholder="Set a password for this new account" secureTextEntry />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Role</Text>
            <ChoiceRow values={STAFF_ROLES} value={staffForm.role} onChange={(role) => setStaffForm((form) => ({ ...form, role: role as StaffForm['role'] }))} />
            <Field label="Designation" value={staffForm.designation} onChange={(designation) => setStaffForm((form) => ({ ...form, designation }))} placeholder="Optional" />
            <Field label="Mobile" value={staffForm.mobile} onChange={(mobile) => setStaffForm((form) => ({ ...form, mobile }))} placeholder="Optional" keyboardType="phone-pad" />
            <ActionButton title="Create staff account" icon="user-plus" onPress={() => runMutation(() => createStaff.mutate(undefined, { onError: setErrorFrom }))} loading={createStaff.isPending} />
          </Card>
          {staffQuery.data?.length ? (
            <View style={styles.section}>
              {staffQuery.data.map((staff) => (
                <Card key={staff.id} style={styles.rowCard}>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{staff.name}</Text>
                    <Text style={[uiStyles.body, { color: colors.primary }]}>{staff.role}{staff.designation ? ` · ${staff.designation}` : ''}</Text>
                    <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>{staff.email}{staff.mobile ? ` · ${staff.mobile}` : ''}</Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState icon="users" title="No staff accounts yet" body="Create worker, PA, representative, or admin accounts for this office." />
          )}
        </View>
      ) : null}

      {tab === 'taxonomy' ? (
        <View style={styles.section}>
          <TaxonomyPanel
            title="Castes"
            entries={castesQuery.data || []}
            name={casteForm.name}
            code={casteForm.code}
            category={casteForm.category}
            categories={CASTE_CATEGORIES}
            canDelete={user?.role === 'admin'}
            onName={(name) => setCasteForm((form) => ({ ...form, name }))}
            onCode={(code) => setCasteForm((form) => ({ ...form, code }))}
            onCategory={(category) => setCasteForm((form) => ({ ...form, category }))}
            onAdd={() => runMutation(() => createTaxonomy.mutate('caste', { onError: setErrorFrom }))}
            adding={createTaxonomy.isPending && createTaxonomy.variables === 'caste'}
            onDelete={(entry) => showConfirm('Delete caste?', `${entry.name} will be removed from the caste list. Existing citizen profiles are not deleted.`, () => deleteTaxonomy.mutate({ kind: 'caste', id: entry.id }))}
          />
          <TaxonomyPanel
            title="Religions"
            entries={religionsQuery.data || []}
            name={religionForm.name}
            code={religionForm.code}
            canDelete={user?.role === 'admin'}
            onName={(name) => setReligionForm((form) => ({ ...form, name }))}
            onCode={(code) => setReligionForm((form) => ({ ...form, code }))}
            onAdd={() => runMutation(() => createTaxonomy.mutate('religion', { onError: setErrorFrom }))}
            adding={createTaxonomy.isPending && createTaxonomy.variables === 'religion'}
            onDelete={(entry) => showConfirm('Delete religion?', `${entry.name} will be removed from the religion list. Existing citizen profiles are not deleted.`, () => deleteTaxonomy.mutate({ kind: 'religion', id: entry.id }))}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function TaxonomyPanel({
  title,
  entries,
  name,
  code,
  category,
  categories,
  canDelete,
  onName,
  onCode,
  onCategory,
  onAdd,
  adding,
  onDelete,
}: {
  title: string;
  entries: TaxonomyEntry[];
  name: string;
  code: string;
  category?: string;
  categories?: string[];
  canDelete: boolean;
  onName: (value: string) => void;
  onCode: (value: string) => void;
  onCategory?: (value: string) => void;
  onAdd: () => void;
  adding: boolean;
  onDelete: (entry: TaxonomyEntry) => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.formCard}>
      <View style={styles.panelHeading}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>{entries.length}</Text>
      </View>
      <Field label="Name" value={name} onChange={onName} placeholder={`${title.slice(0, -1)} name`} />
      <Field label="Code (optional)" value={code} onChange={onCode} placeholder="Optional code" />
      {categories?.length && category && onCategory ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <ChoiceRow values={categories} value={category} onChange={onCategory} />
        </>
      ) : null}
      <ActionButton title={`Add ${title.toLowerCase().slice(0, -1)}`} icon="plus" onPress={onAdd} loading={adding} />
      {entries.length ? (
        <View style={[styles.entryList, { borderTopColor: colors.border }]}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{entry.name}</Text>
                <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
                  {[entry.code, entry.category].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              {canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${title.toLowerCase()} entry ${entry.name}`}
                  onPress={() => onDelete(entry)}
                  style={[styles.deleteButton, { borderColor: colors.border }]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>No entries yet.</Text>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
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
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
        style={[styles.input, { borderColor: colors.input, backgroundColor: colors.background, color: colors.foreground }]}
      />
    </View>
  );
}

function ChoiceRow({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
      {values.map((item) => <ChoiceChip key={item} label={capitalize(item)} active={value === item} onPress={() => onChange(item)} />)}
    </ScrollView>
  );
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.secondary : colors.card }]}
    >
      <Text style={[styles.choiceText, { color: active ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ label, value, active, onPress }: { label: string; value: Tab; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
    >
      <Text style={[styles.tabText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function groupAreas(areas: Area[]) {
  const grouped = new Map<string, Area[]>();
  for (const area of areas) grouped.set(area.kind, [...(grouped.get(area.kind) || []), area]);
  return [...grouped.entries()];
}

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tab: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
  paNote: { width: '100%', fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  formCard: { gap: 11 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: { gap: 5 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 3 },
  choice: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  choiceText: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  deleteButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  entryList: { borderTopWidth: 1, marginTop: 4 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
});
