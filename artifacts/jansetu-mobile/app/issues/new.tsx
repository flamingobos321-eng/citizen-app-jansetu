import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ActionButton,
  Card,
  ErrorNotice,
  PageHeader,
  Screen,
  uiStyles,
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

type CategoryResponse = { issue_categories: string[] };
type CreatedIssue = { id: string; issue_code: string };

export default function NewIssueScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{
    gps_lat: number;
    gps_lng: number;
    location_address: string;
  } | null>(null);
  const [formError, setFormError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const categories = useQuery({
    queryKey: ['issue-categories'],
    queryFn: () => apiRequest<CategoryResponse>('/meta/categories'),
  });
  const submitIssue = useMutation({
    mutationFn: () =>
      apiRequest<CreatedIssue>('/issues', {
        method: 'POST',
        token,
        body: {
          category,
          title: title.trim(),
          description: description.trim(),
          photos: [],
          gps_lat: location?.gps_lat ?? null,
          gps_lng: location?.gps_lng ?? null,
          location_address: location?.location_address || '',
        },
      }),
    onSuccess: (created) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/issues/${created.id}`);
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Issue could not be submitted.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const captureLocation = async () => {
    setLocationLoading(true);
    setFormError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setFormError('Location permission was not granted. You can still submit without a location.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const reverse = await Location.reverseGeocodeAsync(coordinates).catch(() => []);
      const place = reverse[0];
      const address = place
        ? [
            place.name,
            place.street,
            place.district,
            place.city,
            place.region,
          ]
            .filter((part, index, all) => part && all.indexOf(part) === index)
            .join(', ')
        : '';
      setLocation({
        gps_lat: coordinates.latitude,
        gps_lng: coordinates.longitude,
        location_address: address,
      });
    } catch {
      setFormError('Could not capture your location. You can still submit without it.');
    } finally {
      setLocationLoading(false);
    }
  };

  const submit = () => {
    setFormError('');
    if (!category) return setFormError('Choose a category.');
    if (title.trim().length < 5) return setFormError('Add a short title of at least 5 characters.');
    if (description.trim().length < 10) {
      return setFormError('Please describe the issue in at least 10 characters.');
    }
    submitIssue.mutate();
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={19} color={colors.foreground} />
      </Pressable>
      <PageHeader
        eyebrow="CITIZEN SERVICES"
        title="Raise an issue"
        subtitle="Tell your office what needs attention in your community."
      />

      {categories.isError ? (
        <ErrorNotice
          message={categories.error instanceof Error ? categories.error.message : 'Could not load issue categories.'}
          onRetry={() => void categories.refetch()}
        />
      ) : null}

      <View style={{ gap: 10 }}>
        <Text style={[uiStyles.inputLabel, { color: colors.mutedForeground }]}>Category</Text>
        {categories.isLoading ? (
          <Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading categories…</Text>
        ) : (
          <View style={styles.categoryGrid}>
            {(categories.data?.issue_categories || []).map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setCategory(item);
                    setFormError('');
                  }}
                  style={[
                    styles.category,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      { color: selected ? '#FFFFFF' : colors.foreground },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[uiStyles.inputLabel, { color: colors.mutedForeground }]}>Issue title</Text>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setFormError('');
          }}
          placeholder="For example, pothole near the market"
          placeholderTextColor={colors.mutedForeground}
          style={[uiStyles.textInput, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          maxLength={100}
          accessibilityLabel="Issue title"
          testID="issue-title"
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[uiStyles.inputLabel, { color: colors.mutedForeground }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            setFormError('');
          }}
          placeholder="Describe the issue and how it affects your area."
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          style={[
            uiStyles.textInput,
            styles.description,
            { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card },
          ]}
          maxLength={2000}
          accessibilityLabel="Issue description"
          testID="issue-description"
        />
        <Text style={[styles.counter, { color: colors.mutedForeground }]}>
          {description.length}/2000
        </Text>
      </View>

      <Card style={styles.locationCard}>
        <View style={[styles.locationIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="map-pin" size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.locationTitle, { color: colors.foreground }]}>
            Add issue location
          </Text>
          <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
            Optional. Your exact location is attached only to this report.
          </Text>
          {location ? (
            <Text style={[styles.locationText, { color: colors.success, marginTop: 5 }]}>
              {location.location_address ||
                `${location.gps_lat.toFixed(4)}, ${location.gps_lng.toFixed(4)}`}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={location ? 'Update issue location' : 'Add issue location'}
          onPress={() => void captureLocation()}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <Text style={{ color: colors.primary, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>
              …
            </Text>
          ) : (
            <Feather
              name={location ? 'check-circle' : 'crosshair'}
              size={20}
              color={location ? colors.success : colors.primary}
            />
          )}
        </Pressable>
      </Card>

      {formError ? <ErrorNotice message={formError} /> : null}

      <ActionButton
        title="Submit issue"
        icon="send"
        onPress={submit}
        loading={submitIssue.isPending}
        disabled={categories.isError || categories.isLoading}
      />
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
        Your report will be shared with the office responsible for your constituency.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginLeft: -9 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  categoryText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  description: { minHeight: 128, paddingTop: 14 },
  counter: { fontFamily: 'Manrope_500Medium', fontSize: 10, textAlign: 'right' },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  locationIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locationTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  locationText: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  privacy: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: -5 },
});
