import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import OfflineIndicator from '@/components/OfflineIndicator';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Badge } from '@/components/ui/badge';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-[var(--color-cream)] text-stone-900 p-4 lg:p-8 pb-0 selection:bg-stone-200">
      <OfflineIndicator />

      <header className="mb-6 lg:mb-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge
              variant="outline"
              className="text-xs tracking-widest text-stone-400 uppercase font-bold bg-stone-50 border-stone-200 mb-2"
            >
              {t('app.subtitle')}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900">
              {t('app.title')}
            </h1>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="w-full flex-1 flex flex-col items-center">
        {children}
      </main>
    </div>
  );
}

