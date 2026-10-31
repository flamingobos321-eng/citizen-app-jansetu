import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Card, ErrorNotice, PageHeader, Screen, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { apiRequest, apiRequestText } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ReportSummary = {
  citizens: number;
  households: number;
  issues: number;
  issues_resolved: number;
  devworks: number;
  visits: number;
};
const REPORTS = [
  { file: 'citizens.csv', title: 'Citizens', description: 'Registered citizens and contact records.', icon: 'users' as const },
  { file: 'households.csv', title: 'Households', description: 'Family-head records, addresses, and member counts.', icon: 'home' as const },
  { file: 'issues.csv', title: 'Issues', description: 'Issue status, assignments, and citizen ratings.', icon: 'file-text' as const },
  { file: 'devworks.csv', title: 'Development works', description: 'Project status, locations, and budgets.', icon: 'tool' as const },
  { file: 'visits.csv', title: 'Visits & camps', description: 'Public meetings, health camps, and inspections.', icon: 'calendar' as const },
];
const REPORT_ROLES = ['admin', 'pa', 'politician'];

export default function ReportsScreen() {
  const colors = useColors();
  const { user, token, loading } = useAuth();
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const summaryQuery = useQuery({
    queryKey: ['reports-summary', token],
    queryFn: () => apiRequest<ReportSummary>('/reports/summary', { token }),
    enabled: !!token && !!user && REPORT_ROLES.includes(user.role),
  });

  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!REPORT_ROLES.includes(user?.role || '')) return <Redirect href="/office" />;

  const downloadReport = async (file: string) => {
    setDownloading(file);
    try {
      const csv = await apiRequestText(`/reports/${file}`, token);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = file;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!directory) throw new Error('No local folder is available to save the report.');
      const uri = `${directory}${file}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('The share sheet is not available on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Share ${file}` });
    } catch (error) {
      // Keep report failures visible and retryable instead of silently failing.
      setDownloadError(error instanceof Error ? error.message : 'Could not export this report.');
    } finally {
      setDownloading('');
    }
  };
  return (
    <Screen
      contentStyle={{ gap: 15 }}
      refreshControl={
        <RefreshControl refreshing={summaryQuery.isRefetching} onRefresh={() => void summaryQuery.refetch()} tintColor={colors.primary} />
      }
    >
      <PageHeader
        eyebrow="OFFICE WORKSPACE"
        title="Reports & exports"
        subtitle="Constituency totals and CSV reports. Exports are scoped to your office."
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Back to office" onPress={() => router.replace('/office')} style={[styles.backButton, { borderColor: colors.border }]}>
            <Feather name="arrow-left" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      {summaryQuery.isError ? (
        <ErrorNotice message={summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Could not load report totals.'} onRetry={() => void summaryQuery.refetch()} />
      ) : summaryQuery.isLoading ? (
        <Card><Text style={[uiStyles.body, { color: colors.mutedForeground }]}>Loading constituency totals…</Text></Card>
      ) : summaryQuery.data ? (
        <View style={styles.summaryGrid}>
          <SummaryMetric label="Citizens" value={summaryQuery.data.citizens} />
          <SummaryMetric label="Households" value={summaryQuery.data.households} />
          <SummaryMetric label="Issues" value={summaryQuery.data.issues} />
          <SummaryMetric label="Resolved" value={summaryQuery.data.issues_resolved} />
          <SummaryMetric label="Projects" value={summaryQuery.data.devworks} />
          <SummaryMetric label="Visits" value={summaryQuery.data.visits} />
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Export data</Text>
      {downloadError ? <ErrorNotice message={downloadError} /> : null}
      {REPORTS.map((report) => (
        <Card key={report.file} style={styles.reportCard}>
          <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
            <Feather name={report.icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.reportCopy}>
            <Text style={[styles.reportTitle, { color: colors.foreground }]}>{report.title}</Text>
            <Text style={[styles.reportDescription, { color: colors.mutedForeground }]}>{report.description}</Text>
          </View>
          <ActionButton
            title={downloading === report.file ? 'Preparing' : 'Export'}
            icon="download"
            variant="outline"
            loading={downloading === report.file}
            disabled={!!downloading && downloading !== report.file}
            onPress={() => {
              setDownloadError('');
              void downloadReport(report.file);
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <Card style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '31%', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 11 },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  metricLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  reportCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reportCopy: { flex: 1, gap: 3 },
  reportTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  reportDescription: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
});
