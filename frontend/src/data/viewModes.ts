// The four viewer modes (VII.1), in display order — one source of truth.
//
// The mode picker, the Settings default-mode picker, and the validation of the
// persisted setting all read this. They previously each carried their own copy,
// where a renamed label drifts silently and a fifth mode added to two of the
// three is coerced back to the default on load with no type error.
import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { ViewMode } from '../components/MoleculeViewer';

export interface ViewModeOption {
  key: ViewMode;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const VIEW_MODES: ViewModeOption[] = [
  { key: 'ballStick', label: 'Ball & Stick', icon: 'chart-bubble' },
  { key: 'spaceFilling', label: 'Space-Filling', icon: 'circle' },
  { key: 'stick', label: 'Stick', icon: 'grid' },
  { key: 'wireframe', label: 'Wireframe', icon: 'vector-line' },
];

export const isViewMode = (value: unknown): value is ViewMode =>
  VIEW_MODES.some((m) => m.key === value);
