import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ErrorNotice } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

export default function IndexRoute() {
  const { user, loading, error, refreshSession } = useAuth();
  const colors = useColors();
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error && !user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <ErrorNotice message={error} onRetry={() => void refreshSession()} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.role === 'citizen' ? '/(tabs)' : '/office'} />;
}
