import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import OfflineIndicator from '@/components/OfflineIndicator';
import { InvoiceJobsTray } from '@/components/invoice/InvoiceJobsTray';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvoiceBackgroundJobsProvider } from '@/hooks/useInvoiceBackgroundJobs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@/lib/logger';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const [dismissedUpdate, setDismissedUpdate] = useState(
    () => sessionStorage.getItem('pwa-update-dismissed') === '1',
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResettingCache, setIsResettingCache] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      logger.error('Service worker registration failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    },
  });

  const isUpdateModalOpen = needRefresh && !dismissedUpdate;

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    try {
      sessionStorage.removeItem('pwa-update-dismissed');
      setDismissedUpdate(false);
      await updateServiceWorker(true);
    } catch (error) {
      logger.error('Failed to apply service worker update', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      toast.error(t('pwa.updateFailedTitle'), {
        description: t('pwa.updateFailedDescription'),
      });
      setIsUpdating(false);
    }
  };

  const handleLater = () => {
    sessionStorage.setItem('pwa-update-dismissed', '1');
    setDismissedUpdate(true);
  };

  const handleResetCache = async () => {
    setIsResettingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      toast.success(t('pwa.resetSuccessTitle'), {
        description: t('pwa.resetSuccessDescription'),
      });

      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (error) {
      logger.error('Failed to reset PWA cache', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      toast.error(t('pwa.resetFailedTitle'), {
        description: t('pwa.resetFailedDescription'),
      });
      setIsResettingCache(false);
    }
  };

  return (
    <InvoiceBackgroundJobsProvider>
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
            <div className="flex items-center gap-2">
              <InvoiceJobsTray />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-2 border-stone-200 bg-white/80 backdrop-blur-sm hover:border-stone-300"
                onClick={handleResetCache}
                disabled={isResettingCache}
              >
                <RefreshCw className={`h-4 w-4 ${isResettingCache ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {isResettingCache ? t('pwa.resetting') : t('pwa.resetAction')}
                </span>
              </Button>
              <LanguageSelector />
            </div>
          </div>
        </header>

        <main className="w-full flex-1 flex flex-col items-center">
          {children}
        </main>

        <Dialog open={isUpdateModalOpen} onOpenChange={() => undefined}>
          <DialogContent
            className="sm:max-w-md [&>button]:hidden"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{t('pwa.updateTitle')}</DialogTitle>
              <DialogDescription className="text-stone-600">
                {t('pwa.updateDescription')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLater}
                disabled={isUpdating}
              >
                {t('pwa.updateLater')}
              </Button>
              <Button
                type="button"
                onClick={handleUpdateNow}
                disabled={isUpdating}
                className="bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white"
              >
                {isUpdating ? t('pwa.updating') : t('pwa.updateNow')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </InvoiceBackgroundJobsProvider>
  );
}
