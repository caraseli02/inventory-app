import { useEffect, useMemo } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppShell } from '@/layouts/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { logger } from '@/lib/logger';

export default function RootRouteError() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError();

  const message = useMemo(() => {
    if (isRouteErrorResponse(error)) {
      return `${error.status} ${error.statusText}`;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }, [error]);

  useEffect(() => {
    logger.error('Route error boundary triggered', {
      message,
      error: error instanceof Error ? { name: error.name, stack: error.stack } : String(error),
    });
  }, [error, message]);

  return (
    <AppShell>
      <div className="w-full max-w-3xl">
        <Card className="rounded-2xl border-2 border-stone-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-stone-900">
            {t('errors.somethingWentWrong', 'Something went wrong')}
          </h2>
          <p className="mt-2 text-sm text-stone-600 break-words">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-br from-stone-900 to-stone-800 hover:opacity-90 text-white h-11 px-5 rounded-xl font-bold shadow-lg transition-all active:scale-95"
            >
              {t('actions.backToHome', 'Back to Home')}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="h-11 px-5 rounded-xl border-2 border-stone-300"
            >
              {t('actions.reload', 'Reload')}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
