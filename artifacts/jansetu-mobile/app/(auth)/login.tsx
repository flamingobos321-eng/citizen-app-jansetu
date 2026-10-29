import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandMark, ErrorNotice } from '@/components/ui';
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
  const stepIndex = step === 'office' ? 0 : step === 'mobile' ? 1 : 2;
  const heroTitle =
    step === 'office'
      ? 'A clear path to your local office.'
      : step === 'mobile'
        ? 'A direct line to local services.'
        : 'You’re almost there.';
  const heroDescription =
    step === 'office'
      ? 'Choose the right constituency first, then follow civic issues and office updates in one place.'
      : step === 'mobile'
        ? `Continue with ${officeName} to access your citizen services.`
        : `Enter the one-time code sent to +91 ${mobile}.`;
  const heroEyebrow =
    step === 'office'
      ? 'START WITH YOUR CONSTITUENCY'
      : step === 'mobile'
        ? 'OFFICE CONNECTED'
        : 'SECURE PHONE VERIFICATION';
  const formTitle =
    step === 'office'
      ? 'Where should we connect you?'
      : step === 'mobile'
        ? 'Confirm your mobile'
        : 'Enter your code';

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || 0) + 18,
            paddingBottom: (insets.bottom || 0) + 22,
          },
        ]}
        bottomOffset={72}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <BrandMark size={50} />
          <View>
            <Text style={[styles.brandName, { color: colors.primary }]}>JANSETU</Text>
            <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
              Your local office, connected
            </Text>
          </View>
          <View style={styles.secureMark} accessibilityLabel="Secure sign in">
            <Feather name="lock" size={16} color="#49654B" />
          </View>
        </View>

        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroRingLarge} />
          <View pointerEvents="none" style={styles.heroRingSmall} />
          <View style={styles.heroCopy}>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>{heroEyebrow}</Text>
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroDescription}>{heroDescription}</Text>
          </View>
          <View style={styles.progressRow} accessibilityLabel={`Sign in step ${stepIndex + 1} of 3`}>
            <ProgressStep label="Office" number={1} active={stepIndex === 0} complete={stepIndex > 0} />
            <View style={[styles.progressLine, stepIndex > 0 && styles.progressLineComplete]} />
            <ProgressStep label="Mobile" number={2} active={stepIndex === 1} complete={stepIndex > 1} />
            <View style={[styles.progressLine, stepIndex > 1 && styles.progressLineComplete]} />
            <ProgressStep label="Verify" number={3} active={stepIndex === 2} complete={false} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formEyebrow}>
              {step === 'office'
                ? 'OFFICE SIGN-IN'
                : step === 'mobile'
                  ? 'MOBILE SIGN-IN'
                  : 'VERIFY ACCESS'}
            </Text>
            <Text style={styles.formTitle}>{formTitle}</Text>
            <Text style={styles.formDescription}>
              {step === 'office'
                ? 'Use the code shared by your local constituency office.'
                : step === 'mobile'
                  ? 'Use the mobile number linked to your citizen account.'
                  : 'Enter the six-digit one-time code to continue.'}
            </Text>
          </View>

          {step === 'office' ? (
            <>
              <FieldLabel label="Office code" />
              <View style={styles.officeCodeWrap}>
                <TextInput
                  value={officeCode}
                  onChangeText={(value) => {
                    setOfficeCode(value.toUpperCase());
                    dismissError();
                  }}
                  placeholder="For example, JS1045"
                  placeholderTextColor="#88909B"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => void continueWithOffice()}
                  style={[styles.input, styles.officeCodeInput, { color: colors.foreground }]}
                  accessibilityLabel="Office code"
                  testID="office-code-input"
                />
                <Text pointerEvents="none" style={styles.codeSuffix}>CODE</Text>
              </View>
              <View style={styles.codeHelp}>
                <Feather name="info" size={14} color="#78876F" />
                <Text style={styles.codeHelpText}>
                  Not sure where to find it? Ask your local office for its JanSetu code.
                </Text>
              </View>
              <LoginActionButton
                title="Continue"
                icon="arrow-right"
                onPress={() => void continueWithOffice()}
                loading={loading}
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
                accessibilityRole="button"
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
                label="YOUR LOCAL REPRESENTATIVE"
                accentColor={markColor}
                style={styles.officePreview}
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
                  placeholderTextColor="#88909B"
                  keyboardType="phone-pad"
                  returnKeyType="go"
                  onSubmitEditing={() => void requestOtp()}
                  style={[styles.phoneTextInput, { color: colors.foreground }]}
                  accessibilityLabel="Mobile number"
                  testID="mobile-input"
                />
                <Feather name="phone" size={17} color="#78876F" />
              </View>
              <LoginActionButton
                title="Send one-time code"
                icon="arrow-right"
                onPress={() => void requestOtp()}
                loading={loading}
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
                accessibilityRole="button"
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
                  placeholder="······"
                  placeholderTextColor="#88909B"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={() => void verifyOtp()}
                style={[
                  styles.input,
                  styles.otpInput,
                  { color: colors.foreground },
                ]}
                accessibilityLabel="One-time code"
                testID="otp-input"
              />
              <LoginActionButton
                title="Verify and continue"
                icon="arrow-right"
                onPress={() => void verifyOtp()}
                loading={loading}
              />
            </>
          ) : null}

          {info ? (
            <View style={styles.infoBox}>
              <Feather name="info" size={16} color="#36577A" />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}
          {demoOtp ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoLabel}>
                DEVELOPMENT OTP
              </Text>
              <Text style={styles.demoCode}>{demoOtp}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={{ marginTop: 15 }}>
              <ErrorNotice message={error} />
            </View>
          ) : null}
        </View>

        <View style={styles.privacyRow}>
          <Feather name="shield" size={15} color="#526D52" />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Your number is used only to verify your citizen account.
          </Text>
        </View>
        <Text style={styles.bottomNote}>
          A direct connection to your constituency office
        </Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={styles.fieldLabel}>{label}</Text>
  );
}

function ProgressStep({
  label,
  number,
  active,
  complete,
}: {
  label: string;
  number: number;
  active: boolean;
  complete: boolean;
}) {
  return (
    <View style={styles.progressStep}>
      <View
        style={[
          styles.progressNumber,
          active && styles.progressNumberActive,
          complete && styles.progressNumberComplete,
        ]}
      >
        {complete ? (
          <Feather name="check" size={11} color="#FFFFFF" />
        ) : (
          <Text style={[styles.progressNumberText, active && styles.progressNumberTextActive]}>
            {number}
          </Text>
        )}
      </View>
      <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

function LoginActionButton({
  title,
  icon,
  onPress,
  loading,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      onPress={() => {
        if (loading) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={loading}
      style={({ pressed }) => [
        styles.primaryButton,
        { opacity: loading ? 0.65 : pressed ? 0.88 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#172743" />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{title}</Text>
          <Feather name={icon} size={18} color="#172743" />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4EFE5' },
  backgroundOrbTop: {
    position: 'absolute', width: 310, height: 310, borderRadius: 155,
    top: -150, right: -115, backgroundColor: '#E8D9BC', opacity: 0.55,
  },
  backgroundOrbBottom: {
    position: 'absolute', width: 290, height: 290, borderRadius: 145,
    bottom: -150, left: -115, backgroundColor: '#DFE8D0', opacity: 0.7,
  },
  content: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 27 },
  brandName: { fontFamily: 'Outfit_700Bold', fontSize: 18, letterSpacing: 1.15 },
  brandCaption: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, marginTop: 2 },
  secureMark: {
    marginLeft: 'auto', width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FBF8F1', borderWidth: 1, borderColor: '#D6D2C7',
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    overflow: 'hidden', position: 'relative', marginBottom: 23,
    paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18,
    borderRadius: 24, backgroundColor: '#122A50',
    shadowColor: '#12213B', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16, shadowRadius: 20, elevation: 5,
  },
  heroRingLarge: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    top: -40, right: -28, borderWidth: 1, borderColor: 'rgba(246,233,201,0.15)',
  },
  heroRingSmall: {
    position: 'absolute', width: 112, height: 112, borderRadius: 56,
    top: 2, right: -1, borderWidth: 1, borderColor: 'rgba(246,233,201,0.15)',
  },
  heroCopy: { maxWidth: 300 },
  heroBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 13,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(246,233,201,0.2)',
    backgroundColor: 'rgba(255,248,233,0.1)',
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F2C875' },
  heroBadgeText: {
    color: '#F2C875', fontFamily: 'Manrope_700Bold', fontSize: 9,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFF8E9', fontFamily: 'Outfit_700Bold', fontSize: 29,
    lineHeight: 33, letterSpacing: -0.45,
  },
  heroDescription: {
    maxWidth: 280, marginTop: 10, color: '#D8E0ED',
    fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 19,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressNumber: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,248,233,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  progressNumberActive: { borderColor: '#F2C875', backgroundColor: '#F2C875' },
  progressNumberComplete: { borderColor: '#8FA27D', backgroundColor: '#8FA27D' },
  progressNumberText: { color: '#D8E0ED', fontFamily: 'Manrope_700Bold', fontSize: 9 },
  progressNumberTextActive: { color: '#122A50' },
  progressLabel: { color: '#D8E0ED', fontFamily: 'Manrope_600SemiBold', fontSize: 9 },
  progressLabelActive: { color: '#FFF8E9' },
  progressLine: {
    flex: 1, height: 1, marginHorizontal: 7, backgroundColor: 'rgba(255,248,233,0.25)',
  },
  progressLineComplete: { backgroundColor: '#8FA27D' },
  formCard: {
    padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: '#E2DDD2', backgroundColor: '#FFFDF8',
    shadowColor: '#323634', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07, shadowRadius: 18, elevation: 3,
  },
  formHeader: { marginBottom: 18 },
  formEyebrow: {
    color: '#71806C', fontFamily: 'Manrope_700Bold', fontSize: 9,
    letterSpacing: 1.3, textTransform: 'uppercase',
  },
  formTitle: {
    marginTop: 5, color: '#172743', fontFamily: 'Outfit_700Bold',
    fontSize: 21, lineHeight: 27,
  },
  formDescription: {
    marginTop: 3, color: '#687487', fontFamily: 'Manrope_400Regular',
    fontSize: 11, lineHeight: 17,
  },
  fieldLabel: {
    marginBottom: 7, color: '#39465A', fontFamily: 'Manrope_700Bold',
    fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase',
  },
  officeCodeWrap: { position: 'relative' },
  input: {
    minHeight: 56, borderWidth: 1, borderColor: '#C9CFC8', borderRadius: 12,
    backgroundColor: '#FBFAF5', paddingHorizontal: 15,
    fontFamily: 'Manrope_600SemiBold', fontSize: 14,
  },
  officeCodeInput: { paddingRight: 58 },
  codeSuffix: {
    position: 'absolute', top: 21, right: 15, color: '#8A927F',
    fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1,
  },
  codeHelp: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
  codeHelpText: {
    flex: 1, color: '#6F7987', fontFamily: 'Manrope_400Regular',
    fontSize: 10, lineHeight: 15,
  },
  primaryButton: {
    minHeight: 54, marginTop: 17, paddingHorizontal: 20,
    borderRadius: 12, backgroundColor: '#D8912C',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#B97721', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  primaryButtonText: {
    color: '#172743', fontFamily: 'Manrope_700Bold',
    fontSize: 13, letterSpacing: 0.1,
  },
  phoneInput: {
    minHeight: 56, borderWidth: 1, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    backgroundColor: '#FBFAF5',
  },
  countryCode: {
    fontFamily: 'Manrope_700Bold', fontSize: 14, paddingRight: 12,
    borderRightWidth: 1, borderRightColor: '#DEDCD2',
  },
  phoneTextInput: {
    flex: 1, paddingLeft: 12, fontFamily: 'Manrope_500Medium',
    fontSize: 14, minHeight: 54,
  },
  otpInput: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 25, letterSpacing: 10,
    textAlign: 'center',
  },
  backLink: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    gap: 7, marginBottom: 15, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: '#F2F0E9',
  },
  backText: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
  officePreview: {
    padding: 12, borderRadius: 14, marginBottom: 18,
    backgroundColor: '#F2F0E9',
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14,
    borderRadius: 11, padding: 12, backgroundColor: '#EDF2F5',
  },
  infoText: { flex: 1, color: '#36577A', fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 17 },
  demoBox: {
    alignItems: 'center', marginTop: 12, padding: 12,
    borderWidth: 1, borderColor: '#E9D6A8', borderRadius: 11,
    backgroundColor: '#FBF1DB',
  },
  demoLabel: { color: '#8C6B29', fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.2 },
  demoCode: { color: '#172743', fontFamily: 'Outfit_700Bold', fontSize: 24, letterSpacing: 6, marginTop: 3 },
  privacyRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
    gap: 8, marginTop: 18, paddingHorizontal: 8,
  },
  privacyText: {
    flex: 1, textAlign: 'center', fontFamily: 'Manrope_500Medium',
    fontSize: 10, lineHeight: 15,
  },
  bottomNote: {
    marginTop: 17, textAlign: 'center', color: '#999B94',
    fontFamily: 'Manrope_600SemiBold', fontSize: 9, letterSpacing: 0.3,
  },
});
