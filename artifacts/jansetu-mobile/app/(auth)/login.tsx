import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ActionButton, BrandMark, ErrorNotice } from '@/components/ui';
import { RepresentativeIdentity } from '@/components/RepresentativeIdentity';
import { apiRequest, type Portal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OFFICE_CODE_RE = /^JS\d{4,}$/i;

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [officeCode, setOfficeCode] = useState('');
  const [portal, setPortal] = useState<Portal | null>(null);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [step, setStep] = useState<'office' | 'mobile' | 'otp'>('office');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const dismissError = () => {
    setError('');
    setInfo('');
  };

  const continueWithOffice = async () => {
    const code = officeCode.trim().toUpperCase();
    if (!OFFICE_CODE_RE.test(code)) {
      setError('Enter the office code provided by your local JanSetu office.');
      return;
    }
    setLoading(true);
    dismissError();
    try {
      const details = await apiRequest<Portal>(`/portals/office/${encodeURIComponent(code)}`);
      setPortal(details);
      setOfficeCode(code);
      setStep('mobile');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Office not found. Check the code.');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    dismissError();
    try {
      const status = await apiRequest<{ exists: boolean; same_tenant?: boolean }>(
        '/auth/citizen/check-mobile',
        {
          method: 'POST',
          body: { mobile, tenant_slug: officeCode },
        },
      );
      if (!status.exists) {
        setError(
          'This number is not linked to a citizen account at this office. Contact the local office to activate your profile.',
        );
        return;
      }
      if (status.same_tenant === false) {
        setError(
          'This number belongs to another constituency. Please contact the office for help transferring your account.',
        );
        return;
      }
      const result = await apiRequest<{
        sent: boolean;
        mode: string;
        demo_otp?: string;
        reason?: string;
      }>('/auth/citizen/request-otp', {
        method: 'POST',
        body: { mobile, tenant_slug: officeCode },
      });
      if (!result.sent) {
        setError(result.reason || 'OTP delivery failed. Try again.');
        return;
      }
      setDemoOtp(result.mode === 'development' ? result.demo_otp || '' : '');
      setInfo(
        result.mode === 'development'
          ? 'Development mode is enabled. Use the demo code shown below.'
          : 'A one-time code was sent to your mobile number.',
      );
      setStep('otp');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the one-time code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit one-time code.');
      return;
    }
    setLoading(true);
    dismissError();
    try {
      const result = await apiRequest<{
        token?: string;
        user?: { id: string; name: string; role: string; [key: string]: unknown };
        new_user?: boolean;
        transferred_out?: boolean;
        message?: string;
      }>('/auth/citizen/verify-otp', {
        method: 'POST',
        body: { mobile, otp, tenant_slug: officeCode },
      });
      if (result.transferred_out) {
        setError(result.message || 'This account now belongs to another constituency.');
        return;
      }
      if (result.new_user || !result.token || !result.user) {
        setError(
          'Your number is not linked to an activated account at this office. Contact the local office to activate your profile.',
        );
        return;
      }
      await signIn(result.token, result.user);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be verified.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const officeName =
    portal?.politician_name || portal?.constituency_name || 'JanSetu citizen services';
  const markColor = portal?.theme_color || colors.primary;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || 0) + 28,
            paddingBottom: (insets.bottom || 0) + 28,
          },
        ]}
        bottomOffset={72}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <BrandMark size={48} />
          <View>
            <Text style={[styles.brandName, { color: colors.primary }]}>JANSETU</Text>
            <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
              Citizen services
            </Text>
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            YOUR LOCAL OFFICE, CONNECTED
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === 'office'
              ? 'Welcome to JanSetu'
              : step === 'mobile'
                ? 'Sign in to your office'
                : 'Verify your number'}
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {step === 'office'
              ? 'Enter your office code to access the right constituency services.'
              : step === 'mobile'
                ? `Continue with ${officeName}.`
                : `We sent a one-time code to +91 ${mobile}.`}
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {step === 'office' ? (
            <>
              <FieldLabel label="Office code" />
              <TextInput
                value={officeCode}
                onChangeText={(value) => {
                  setOfficeCode(value.toUpperCase());
                  dismissError();
                }}
                placeholder="For example, JS1045"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => void continueWithOffice()}
                style={[styles.input, { borderColor: colors.input, color: colors.foreground }]}
                accessibilityLabel="Office code"
                testID="office-code-input"
              />
              <ActionButton
                title="Continue"
                icon="arrow-right"
                onPress={() => void continueWithOffice()}
                loading={loading}
                style={{ marginTop: 16 }}
              />
            </>
          ) : null}

          {step === 'mobile' ? (
            <>
              <Pressable
                onPress={() => {
                  setStep('office');
                  setPortal(null);
                  dismissError();
                }}
                style={styles.backLink}
              >
                <Feather name="arrow-left" size={16} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>
                  Office {portal?.office_code || officeCode} · Change
                </Text>
              </Pressable>
              <RepresentativeIdentity
                name={portal?.politician_name || officeName}
                subtitle={
                  portal?.constituency_name ||
                  `Office ${portal?.office_code || officeCode}`
                }
                label="YOUR REPRESENTATIVE"
                accentColor={markColor}
                style={[styles.officePreview, { backgroundColor: colors.secondary }]}
              />
              <FieldLabel label="Mobile number" />
              <View style={[styles.phoneInput, { borderColor: colors.input }]}>
                <Text style={[styles.countryCode, { color: colors.foreground }]}>+91</Text>
                <TextInput
                  value={mobile}
                  onChangeText={(value) => {
                    setMobile(value.replace(/\D/g, '').slice(0, 10));
                    dismissError();
                  }}
                  placeholder="10-digit number"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  returnKeyType="go"
                  onSubmitEditing={() => void requestOtp()}
                  style={[styles.phoneTextInput, { color: colors.foreground }]}
                  accessibilityLabel="Mobile number"
                  testID="mobile-input"
                />
                <Feather name="phone" size={17} color={colors.mutedForeground} />
              </View>
              <ActionButton
                title="Send one-time code"
                icon="message-circle"
                onPress={() => void requestOtp()}
                loading={loading}
                style={{ marginTop: 16 }}
              />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <Pressable
                onPress={() => {
                  setStep('mobile');
                  setOtp('');
                  setDemoOtp('');
                  dismissError();
                }}
                style={styles.backLink}
              >
                <Feather name="arrow-left" size={16} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>
                  Change mobile number
                </Text>
              </Pressable>
              <FieldLabel label="6-digit code" />
              <TextInput
                value={otp}
                onChangeText={(value) => {
                  setOtp(value.replace(/\D/g, '').slice(0, 6));
                  dismissError();
                }}
                placeholder="••••••"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={() => void verifyOtp()}
                style={[
                  styles.input,
                  styles.otpInput,
                  { borderColor: colors.input, color: colors.foreground },
                ]}
                accessibilityLabel="One-time code"
                testID="otp-input"
              />
              <ActionButton
                title="Verify and continue"
                icon="shield"
                onPress={() => void verifyOtp()}
                loading={loading}
                style={{ marginTop: 16 }}
              />
            </>
          ) : null}

          {info ? (
            <View style={[styles.infoBox, { backgroundColor: colors.infoBackground }]}>
              <Feather name="info" size={16} color={colors.info} />
              <Text style={[styles.infoText, { color: colors.info }]}>{info}</Text>
            </View>
          ) : null}
          {demoOtp ? (
            <View style={[styles.demoBox, { borderColor: colors.border }]}>
              <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>
                DEVELOPMENT OTP
              </Text>
              <Text style={[styles.demoCode, { color: colors.primary }]}>{demoOtp}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={{ marginTop: 15 }}>
              <ErrorNotice message={error} />
            </View>
          ) : null}
        </View>

        <View style={styles.privacyRow}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Your number is used only to verify your citizen account.
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 37 },
  brandName: { fontFamily: 'Outfit_700Bold', fontSize: 18, letterSpacing: 1.1 },
  brandCaption: { fontFamily: 'Manrope_500Medium', fontSize: 11, marginTop: 2 },
  intro: { marginBottom: 23 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 31, lineHeight: 37 },
  description: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
  formCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  fieldLabel: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 8 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontFamily: 'Manrope_500Medium', fontSize: 15 },
  otpInput: { fontFamily: 'Outfit_600SemiBold', fontSize: 26, letterSpacing: 12, textAlign: 'center' },
  phoneInput: { minHeight: 52, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  countryCode: { fontFamily: 'Manrope_700Bold', fontSize: 15, paddingRight: 12, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  phoneTextInput: { flex: 1, paddingLeft: 12, fontFamily: 'Manrope_500Medium', fontSize: 15, minHeight: 50 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 19 },
  backText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  officePreview: { padding: 12, borderRadius: 12, marginBottom: 18 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 10, padding: 12, marginTop: 15 },
  infoText: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  demoBox: { alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 12 },
  demoLabel: { fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.3 },
  demoCode: { fontFamily: 'Outfit_700Bold', fontSize: 24, letterSpacing: 6, marginTop: 2 },
  privacyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  privacyText: { fontFamily: 'Manrope_400Regular', fontSize: 11 },
});
