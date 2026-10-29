import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

const rajeshPatilPortrait = require('../assets/images/rajesh-patil.jpg');

export function RepresentativeIdentity({
  name,
  subtitle,
  label = 'YOUR REPRESENTATIVE',
  accentColor,
  style,
}: {
  name: string;
  subtitle?: string;
  label?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const normalizedName = name.toLocaleLowerCase().replace(/[^a-z]/g, '');
  const hasRajeshPatilPortrait = normalizedName.includes('rajeshpatil');

  return (
    <View style={[styles.row, style]}>
      {hasRajeshPatilPortrait ? (
        <Image
          source={rajeshPatilPortrait}
          accessibilityLabel={`Photo of ${name}`}
          resizeMode="cover"
          style={[styles.portrait, { backgroundColor: colors.secondary }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: accentColor || colors.primary },
          ]}
          accessibilityLabel={`${name} profile`}
        >
          <Feather name="user" size={22} color="#FFFFFF" />
        </View>
      )}
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  portrait: { width: 58, height: 58, borderRadius: 16 },
  placeholder: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1 },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 20 },
  subtitle: { fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 16 },
});
