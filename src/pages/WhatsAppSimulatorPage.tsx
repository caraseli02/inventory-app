import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';

interface WhatsAppSimulatorPageProps {
  onBack: () => void;
}

interface WhatsAppSimulateResponse {
  ok: boolean;
  reply?: string;
  provider?: string;
  debug?: unknown;
  error?: string;
}

export default function WhatsAppSimulatorPage({ onBack }: WhatsAppSimulatorPageProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [simPhone, setSimPhone] = useState('+34675167719');
  const [simName, setSimName] = useState('Simulator');
  const [simText, setSimText] = useState('');

  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string; provider?: string; debug?: unknown }>>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const lastProvider = useMemo(() => {
    for (let i = chat.length - 1; i >= 0; i -= 1) {
      const msg = chat[i];
      if (msg?.role === 'assistant' && msg.provider) return msg.provider;
    }
    return null;
  }, [chat]);

  const simulateMutation = useMutation({
    mutationFn: async (input: { phone: string; name: string; text: string }) => {
      const response = await fetch('/api/whatsapp-simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notify-secret': import.meta.env.VITE_NOTIFY_SECRET ?? '',
        },
        body: JSON.stringify({
          phone: input.phone,
          name: input.name,
          text: input.text,
          debug: debugEnabled,
        }),
      });

      const payload = (await response.json()) as WhatsAppSimulateResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Simulation failed');
      }
      return { reply: payload.reply ?? '', provider: payload.provider, debug: payload.debug };
    },
    onMutate: (input) => {
      setChat((prev) => [...prev, { role: 'user', content: input.text }]);
    },
    onSuccess: (data) => {
      setChat((prev) => [...prev, { role: 'assistant', content: data.reply, provider: data.provider, debug: data.debug }]);
      setSimText('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('success', 'Simulated message processed');
    },
    onError: (error: Error) => {
      showToast('error', error.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/whatsapp-simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notify-secret': import.meta.env.VITE_NOTIFY_SECRET ?? '',
        },
        body: JSON.stringify({
          phone: simPhone,
          reset: true,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Reset failed');
      }
    },
    onSuccess: () => {
      setChat([]);
      setSimText('');
      showToast('success', 'Conversation reset');
    },
    onError: (error: Error) => {
      showToast('error', error.message);
    },
  });

  const simulatorEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_WHATSAPP_SIMULATOR === 'true';

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="WhatsApp Simulator" onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4">
        {!simulatorEnabled ? (
          <Card className="border-2 border-stone-200">
            <CardContent className="p-4">
              <p className="text-sm text-stone-600">
                Simulator is disabled. Set VITE_ENABLE_WHATSAPP_SIMULATOR=true or use local dev mode.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-lavender-200 bg-lavender-50/40">
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold text-stone-800">Internal Testing Only</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sim-phone">Phone</Label>
                  <Input
                    id="sim-phone"
                    value={simPhone}
                    onChange={(event) => setSimPhone(event.target.value)}
                    placeholder="+40123456789"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sim-name">Name</Label>
                  <Input
                    id="sim-name"
                    value={simName}
                    onChange={(event) => setSimName(event.target.value)}
                    placeholder="Simulator"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sim-text">Message</Label>
                <Input
                  id="sim-text"
                  value={simText}
                  onChange={(event) => setSimText(event.target.value)}
                  placeholder="Example: Vreau 2 sticle de lapte"
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (!simText.trim() || simulateMutation.isPending) return;
                    simulateMutation.mutate({ phone: simPhone, name: simName, text: simText });
                  }}
                />
                <p className="text-xs text-stone-500">
                  Tip: dacă nu ai OPENAI_API_KEY / ANTHROPIC_API_KEY local, trimite ORDER JSON (customer_name, customer_phone, items).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => simulateMutation.mutate({ phone: simPhone, name: simName, text: simText })}
                  disabled={simulateMutation.isPending || !simText.trim() || resetMutation.isPending}
                  className="bg-stone-900 text-white hover:bg-stone-800"
                >
                  {simulateMutation.isPending ? 'Sending…' : 'Send'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending || simulateMutation.isPending}
                >
                  {resetMutation.isPending ? 'Resetting…' : 'Reset conversation'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDebugEnabled((v) => !v)}
                  disabled={simulateMutation.isPending || resetMutation.isPending}
                >
                  {debugEnabled ? 'Debug: on' : 'Debug: off'}
                </Button>
                {lastProvider && (
                  <p className="text-xs text-stone-500">
                    Provider: <span className="font-semibold text-stone-700">{lastProvider}</span>
                  </p>
                )}
              </div>

              {chat.length > 0 && (
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold text-stone-500 mb-2">Conversation</p>
                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {chat.map((m, idx) => (
                      <div
                        key={`${m.role}-${idx}`}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={[
                            'max-w-[85%] rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap',
                            m.role === 'user'
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-stone-50 text-stone-800 border-stone-200',
                          ].join(' ')}
                        >
                          {m.role === 'assistant' && m.provider && (
                            <p className="text-[10px] font-semibold opacity-70 mb-1">
                              {m.provider}
                            </p>
                          )}
                          {m.content}
                          {debugEnabled && m.role === 'assistant' && m.debug != null && (
                            <pre className="mt-2 text-[10px] leading-snug whitespace-pre-wrap rounded-md border border-stone-200/70 bg-white/70 p-2 text-stone-700">
                              {JSON.stringify(m.debug, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
