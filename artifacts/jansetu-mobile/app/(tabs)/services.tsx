import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, PageHeader, Screen, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

const SERVICES = [
  {
    route: '/visits',
    icon: 'calendar' as const,
    title: 'Visits & camps',
    description: 'See upcoming public meetings, health camps, and office visits.',
  },
  {
    route: '/devworks',
    icon: 'tool' as const,
    title: 'Development works',
    description: 'Follow approved projects and their latest progress in your area.',
  },
] as const;

export default function ServicesScreen() {
  const colors = useColors();

  return (
    <Screen contentStyle={{ gap: 16 }}>
      <PageHeader
        eyebrow="YOUR CONSTITUENCY"
        title="Services"
        subtitle="Local programs and public projects from your office."
      />
      {SERVICES.map((service) => (
        <Pressable
          key={service.route}
          accessibilityRole="button"
          accessibilityLabel={`Open ${service.title}`}
          accessibilityHint={service.description}
          onPress={() => router.push(service.route)}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Card style={styles.card}>
            <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
              <Feather name={service.icon} size={19} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>{service.title}</Text>
              <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>
                {service.description}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
});
