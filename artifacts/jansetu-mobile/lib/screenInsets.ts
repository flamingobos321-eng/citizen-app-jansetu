/**
 * iOS ScrollViews use automatic content insets (also enforced by NativeTabs),
 * so UIKit already reserves the status bar / Dynamic Island space.
 * Android and web need their reported safe area added manually.
 */
export function screenTopPadding(platform: string, safeAreaTop: number): number {
  return 14 + (platform === 'ios' ? 0 : Math.max(safeAreaTop, 0));
}
