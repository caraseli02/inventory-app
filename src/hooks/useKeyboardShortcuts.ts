import { useEffect, useRef } from 'react';

interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  // Keep ref updated without causing re-renders
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentShortcuts = shortcutsRef.current;

      for (const shortcut of currentShortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const metaMatch = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;
        const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          // Prevent default behavior for our shortcuts
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

// Preset shortcuts that can be reused
export const SHORTCUTS = {
  SEARCH: { key: 'k', metaKey: true, description: 'Focus search' },
  NEW_PRODUCT: { key: 'n', metaKey: true, description: 'New product' },
  SETTINGS: { key: ',', metaKey: true, description: 'Open settings' },
  ESCAPE: { key: 'Escape', description: 'Close dialog or escape' },
} as const;
