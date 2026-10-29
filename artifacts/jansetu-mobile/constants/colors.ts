/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#111827',
    tint: '#0A1128',
    background: '#F9FAFB',
    foreground: '#111827',
    card: '#FFFFFF',
    cardForeground: '#111827',
    primary: '#0A1128',
    primaryForeground: '#FFFFFF',
    secondary: '#F3F4F6',
    secondaryForeground: '#111827',
    muted: '#F3F4F6',
    mutedForeground: '#64748B',
    accent: '#F3F4F6',
    accentForeground: '#111827',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    border: '#E5E7EB',
    input: '#D1D5DB',
    success: '#065F46',
    successBackground: '#ECFDF5',
    warning: '#B45309',
    warningBackground: '#FFFBEB',
    info: '#1E40AF',
    infoBackground: '#EFF6FF',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
