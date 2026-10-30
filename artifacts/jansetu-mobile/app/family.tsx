import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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

type FamilyMember = {
  id: string;
  other_name?: string;
  other_mobile?: string;
  relation: string;
};
type IncomingInvitation = {
  id: string;
  from_user_name?: string;
  from_user_mobile?: string;
  relation_type: string;
};
type OutgoingInvitation = {
  id: string;
  target_name?: string;
  target_mobile: string;
  relation_type: string;
};
type FamilyInvitations = {
  outgoing: OutgoingInvitation[];
  incoming: IncomingInvitation[];
};
type FamilyLinkResult = {
  linked: boolean;
  target?: { name?: string };
};

const RELATIONSHIPS = [
  'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister',
  'Husband', 'Wife', 'Grandfather', 'Grandmother', 'Grandson',
  'Granddaughter', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin', 'Other',
];
const DEFAULT_RELATION = 'Father';

export default function FamilyScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, token, loading } = useAuth();
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [relation, setRelation] = useState(DEFAULT_RELATION);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const membersQuery = useQuery({
    queryKey: ['family-members', token],
    queryFn: () => apiRequest<FamilyMember[]>('/family/members', { token }),
    enabled: !!token && user?.role === 'citizen',
  });
  const invitationsQuery = useQuery({
    queryKey: ['family-invitations', token],
    queryFn: () => apiRequest<FamilyInvitations>('/family/invitations', { token }),
    enabled: !!token && user?.role === 'citizen',
  });

  const refreshFamily = async () => {
    await Promise.all([membersQuery.refetch(), invitationsQuery.refetch()]);
  };
  const linkFamily = useMutation({
    mutationFn: () => {
      const normalizedMobile = mobile.replace(/\D/g, '');
      if (!/^\d{10}$/.test(normalizedMobile)) {
        throw new Error('Enter a valid 10-digit mobile number.');
      }
      if (
        anniversary &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(anniversary) ||
          Number.isNaN(new Date(`${anniversary}T00:00:00`).getTime()))
      ) {
        throw new Error('Enter the anniversary as YYYY-MM-DD.');
      }
      return apiRequest<FamilyLinkResult>('/family/link', {
        method: 'POST',
        token,
        body: {
          relation_type: relation,
          mobile: normalizedMobile,
          target_name: name.trim() || undefined,
          marriage_anniversary:
            relation === 'Husband' || relation === 'Wife' ? anniversary || undefined : undefined,
        },
      });
    },
    onSuccess: async (result) => {
      setFormError('');
      setSuccess(
        result.linked
          ? `Family link added${result.target?.name ? ` with ${result.target.name}` : ''}.`
          : 'Invitation sent. The link will be added when they register.',
      );
      setMobile('');
      setName('');
      setAnniversary('');
      setRelation(DEFAULT_RELATION);
      await refreshFamily();
    },
  });
  const resolveInvitation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'cancel' }) =>
      apiRequest<{ ok: boolean }>(`/family/invitations/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        token,
      }),
    onSuccess: async (_result, variables) => {
      setSuccess(
        variables.action === 'accept'
          ? 'Family invitation accepted.'
          : variables.action === 'decline'
            ? 'Family invitation declined.'
            : 'Pending invitation cancelled.',
      );
      await refreshFamily();
    },
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (user?.role !== 'citizen') return <Redirect href="/office" />;

  const isSpouse = relation === 'Husband' || relation === 'Wife';
  const isRefreshing = membersQuery.isRefetching || invitationsQuery.isRefetching;

  const submitLink = () => {
    setSuccess('');
    setFormError('');
    linkFamily.mutate();
  };
  const resolve = (id: string, action: 'accept' | 'decline' | 'cancel') => {
    setSuccess('');
    resolveInvitation.mutate({ id, action });
  };

  return (
    <Screen
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshFamily()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow="CITIZEN SERVICES"
        title="Family members"
        subtitle="Link relatives so family history stays connected when people move."
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            onPress={() => router.replace('/(tabs)/profile')}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      <Card style={styles.formCard}>
        <View style={styles.formHeading}>
          <View style={[styles.formIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="user-plus" size={18} color={colors.primary} />
          </View>
          <View style={styles.formHeadingCopy}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Link a relative</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Already registered relatives are linked now. Others receive a pending invitation.
            </Text>
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Relationship</Text>
        <View style={styles.relationGrid}>
          {RELATIONSHIPS.map((item) => {
            const selected = item === relation;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setRelation(item);
                  setFormError('');
                }}
                style={[
                  styles.relationChip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.secondary : colors.card,
                  },
                ]}
              >
                <Text style={[styles.relationText, { color: selected ? colors.primary : colors.foreground }]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Mobile number *</Text>
        <TextInput
          value={mobile}
          onChangeText={(value) => {
            setMobile(value.replace(/\D/g, '').slice(0, 10));
            setFormError('');
          }}
          placeholder="10-digit mobile"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          maxLength={10}
          accessibilityLabel="Family member mobile number"
          style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name (optional)</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Help them recognise the invitation"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          accessibilityLabel="Family member name"
          style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
        />

        {isSpouse ? (
          <>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Marriage anniversary (optional)</Text>
            <TextInput
              value={anniversary}
              onChangeText={setAnniversary}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Marriage anniversary"
              style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
            />
          </>
        ) : null}

        {formError ? <ErrorNotice message={formError} /> : null}
        {linkFamily.isError ? (
          <ErrorNotice
            message={linkFamily.error instanceof Error ? linkFamily.error.message : 'Could not link this family member.'}
          />
        ) : null}
        {success ? (
          <Text accessibilityRole="text" style={[styles.success, { color: colors.success }]}>{success}</Text>
        ) : null}
        <ActionButton
          title="Send family link"
          icon="send"
          onPress={submitLink}
          loading={linkFamily.isPending}
        />
      </Card>

      {membersQuery.isError ? (
        <ErrorNotice
          message={membersQuery.error instanceof Error ? membersQuery.error.message : 'Could not load family members.'}
          onRetry={() => void membersQuery.refetch()}
        />
      ) : membersQuery.isLoading ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading family links…</Text></Card>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Linked family ({membersQuery.data?.length || 0})
          </Text>
          {membersQuery.data?.length ? (
            membersQuery.data.map((member) => (
              <Card key={member.id} style={styles.memberCard}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.secondary }]}>
                  <Feather name="user" size={17} color={colors.primary} />
                </View>
                <View style={styles.memberCopy}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>
                    {member.other_name || 'Family member'}
                  </Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>
                    {member.relation}{member.other_mobile ? ` · ${member.other_mobile}` : ''}
                  </Text>
                </View>
                <Feather name="check-circle" size={17} color={colors.success} />
              </Card>
            ))
          ) : (
            <EmptyState
              icon="users"
              title="No linked family yet"
              body="Link a parent, spouse, child, or other relative above."
            />
          )}
        </View>
      )}

      {invitationsQuery.isError ? (
        <ErrorNotice
          message={invitationsQuery.error instanceof Error ? invitationsQuery.error.message : 'Could not load invitations.'}
          onRetry={() => void invitationsQuery.refetch()}
        />
      ) : null}

      {invitationsQuery.data?.incoming.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invitations for you</Text>
          {invitationsQuery.data.incoming.map((invitation) => (
            <Card key={invitation.id} style={styles.invitationCard}>
              <View style={styles.invitationCopy}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>
                  {invitation.from_user_name || 'A citizen'} wants to link with you
                </Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  As their {invitation.relation_type}
                  {invitation.from_user_mobile ? ` · ${invitation.from_user_mobile}` : ''}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <SmallAction
                  label="Decline invitation"
                  title="Decline"
                  color={colors.destructive}
                  border={colors.border}
                  onPress={() => resolve(invitation.id, 'decline')}
                  disabled={resolveInvitation.isPending}
                />
                <SmallAction
                  label="Accept invitation"
                  title="Accept"
                  color={colors.primary}
                  border={colors.primary}
                  onPress={() => resolve(invitation.id, 'accept')}
                  disabled={resolveInvitation.isPending}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {invitationsQuery.data?.outgoing.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pending invitations</Text>
          {invitationsQuery.data.outgoing.map((invitation) => (
            <Card key={invitation.id} style={styles.invitationCard}>
              <View style={styles.invitationCopy}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>
                  {invitation.target_name || invitation.target_mobile}
                </Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  {invitation.relation_type} · {invitation.target_mobile}
                </Text>
              </View>
              <SmallAction
                label="Cancel invitation"
                title="Cancel"
                color={colors.foreground}
                border={colors.border}
                onPress={() => resolve(invitation.id, 'cancel')}
                disabled={resolveInvitation.isPending}
              />
            </Card>
          ))}
        </View>
      ) : null}

      {resolveInvitation.isError ? (
        <ErrorNotice
          message={resolveInvitation.error instanceof Error ? resolveInvitation.error.message : 'Could not update this invitation.'}
        />
      ) : null}
    </Screen>
  );
}

function SmallAction({
  label,
  title,
  color,
  border,
  onPress,
  disabled,
}: {
  label: string;
  title: string;
  color: string;
  border: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallAction,
        { borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.smallActionText, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  formCard: { gap: 11 },
  formHeading: { flexDirection: 'row', gap: 11, alignItems: 'center', marginBottom: 3 },
  formIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  formHeadingCopy: { flex: 1, gap: 2 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase' },
  relationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  relationChip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12 },
  relationText: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  success: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 17 },
  section: { gap: 9 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberCopy: { flex: 1, gap: 2 },
  memberName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  invitationCard: { gap: 11 },
  invitationCopy: { gap: 3 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  smallAction: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  smallActionText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
});
