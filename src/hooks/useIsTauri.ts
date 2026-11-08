/**
 * True when the UI runs inside the Tauri desktop window (native dialogs and
 * notifications available), false in a browser / on the phone.
 * The value cannot change during the page's life, so it is read once.
 */
import { useState } from 'react';
import { isTauri } from '@/api';

export function useIsTauri(): boolean {
  const [value] = useState(() => isTauri());
  return value;
}
