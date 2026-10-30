import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, ErrorNotice, PageHeader, Screen, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Household = {
  id: string;
  household_code: string;
  family_head_name: string;
  house_number?: string;
  region_type?: string;
  address?: string;
  members_count?: number;
};
const DIRECTORY_ROLES = ['admin', 'pa', 'politician'];

export default function HouseholdsScreen() {
  const colors = useColors();
  const { user, token, loading } = useAuth();
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const householdsQuery = useQuery({
    queryKey: ['households', token, search],
    queryFn: () => apiRequest<Household[]>(`/households${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
    enabled: !!token && !!user && DIRECTORY_ROLES.includes(user.role),
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!DIRECTORY_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  return (
    <Screen contentStyle={{ gap: 15 }}>
      <PageHeader
        eyebrow="OFFICE DIRECTORY"
        title="Citizens & households"
        subtitle="Search by family name, household code, address, or member phone."
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
      <Card style={styles.searchCard}>
        <TextInput
          value={draftSearch}
          onChangeText={setDraftSearch}
          onSubmitEditing={() => setSearch(draftSearch.trim())}
          placeholder="Search households"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          accessibilityLabel="Search households"
          style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => setSearch(draftSearch.trim())}
          style={[styles.searchButton, { backgroundColor: colors.primary }]}
        >
          <Feather name="search" size={18} color={colors.primaryForeground} />
        </Pressable>
      </Card>

      {householdsQuery.isError ? (
        <ErrorNotice
          message={householdsQuery.error instanceof Error ? householdsQuery.error.message : 'Could not load households.'}
          onRetry={() => void householdsQuery.refetch()}
        />
      ) : householdsQuery.isLoading ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading households…</Text></Card>
      ) : householdsQuery.data?.length ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {householdsQuery.data.length}{householdsQuery.data.length === 200 ? '+' : ''} households
          </Text>
          {householdsQuery.data.map((household) => (
            <Pressable
              key={household.id}
              accessibilityRole="button"
              accessibilityLabel={`Open household ${household.family_head_name}`}
              accessibilityHint="View household members and service history"
              onPress={() => router.push(`/households/${encodeURIComponent(household.id)}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Card style={styles.householdCard}>
                <View style={[styles.houseIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="home" size={18} color={colors.primary} />
                </View>
                <View style={styles.householdCopy}>
                  <Text style={[styles.code, { color: colors.primary }]}>{household.household_code}</Text>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {household.family_head_name}
                  </Text>
                  <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {[household.house_number, household.region_type, household.address].filter(Boolean).join(' · ') || 'Address not recorded'}
                  </Text>
                </View>
                <View style={styles.trailing}>
                  <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
                    {household.members_count ?? 0} members
                  </Text>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="users"
          title={search ? 'No matching households' : 'No households found'}
          body={search ? 'Try another name, code, phone, or address.' : 'Households from your constituency will appear here.'}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchCard: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  searchInput: { flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  searchButton: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultCount: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, paddingHorizontal: 2 },
  householdCard: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  houseIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  householdCopy: { flex: 1, gap: 3 },
  code: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.3 },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  address: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 17 },
  trailing: { alignItems: 'flex-end', gap: 7 },
  memberCount: { fontFamily: 'Manrope_500Medium', fontSize: 10 },
});
