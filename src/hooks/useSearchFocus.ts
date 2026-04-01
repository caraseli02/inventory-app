import { useEffect } from 'react';

/**
 * Hook to focus a search input when the global Cmd+K shortcut is pressed
 * @param inputRef - Ref to the search input element
 */
export function useSearchFocus(inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
  useEffect(() => {
    const handleFocusSearch = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Also select all text if there's any
        if (inputRef.current.value) {
          inputRef.current.select();
        }
      }
    };

    window.addEventListener('focus-search', handleFocusSearch);
    return () => window.removeEventListener('focus-search', handleFocusSearch);
  }, [inputRef]);
}
