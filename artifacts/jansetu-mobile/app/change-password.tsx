import { Feather } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Card, ErrorNotice, PageHeader, Screen } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ChangePasswordScreen() {
  const colors = useColors();
  const { user, token, loading, refreshSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (loading) return null;
  if (!token || !user) return <Redirect href="/(auth)/login" />;

  const submit = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        token,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      await refreshSession();
      router.replace(user.role === 'citizen' ? '/(tabs)' : '/office');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboardAware contentStyle={styles.screen}>
      <View style={[styles.brandIcon, { backgroundColor: colors.infoBackground }]}>
        <Feather name="shield" size={22} color={colors.primary} />
      </View>
      <PageHeader
        eyebrow="ACCOUNT SECURITY"
        title={user.must_change_password ? 'Set your password' : 'Change password'}
        subtitle={
          user.must_change_password
            ? 'Replace the temporary password before continuing to your account.'
            : 'Choose a new password for your JanSetu account.'
        }
      />
      <Card style={styles.form}>
        <PasswordField
          label={user.must_change_password ? 'Temporary password' : 'Current password'}
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter current password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Enter the new password again"
        />
        {error ? <ErrorNotice message={error} /> : null}
        <ActionButton
          title="Save new password"
          icon="lock"
          onPress={() => void submit()}
          loading={saving}
        />
        {!user.must_change_password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel password change"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace(user.role === 'citizen' ? '/(tabs)/profile' : '/office');
            }}
            style={({ pressed }) => ({ alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={[styles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        ) : null}
      </Card>
    </Screen>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
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
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        textContentType="password"
        style={[styles.input, { borderColor: colors.input, backgroundColor: colors.background, color: colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center', gap: 16, paddingTop: 32 },
  brandIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontFamily: 'Manrope_500Medium', fontSize: 14 },
  cancel: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
});
