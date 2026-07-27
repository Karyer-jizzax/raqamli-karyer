/**
 * App-local helpers. The generic pieces that used to live here (Eyebrow,
 * CountPill, StatusDot, Field, ModalForm, ROW_ACTION*, TH) moved to
 * @karier/ui so web-department and web-quarry share them; they are re-exported
 * so this app's feature files keep importing from one place.
 */
export {
  CountPill,
  Eyebrow,
  Field,
  localizedName as districtName,
  ModalForm,
  ROW_ACTION,
  ROW_ACTION_DANGER,
  StatusDot,
  TH,
} from '@karier/ui';

/** Short unique-ish code derived from a name, for entities that need one client-side. */
export function slugCode(name: string): string {
  const base = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return (base || 'X') + suffix;
}
