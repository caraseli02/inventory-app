import { useState } from 'react';
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
  error?: string;
}

export default function WhatsAppSimulatorPage({ onBack }: WhatsAppSimulatorPageProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [simPhone, setSimPhone] = useState('+34675167719');
  const [simName, setSimName] = useState('Simulator');
  const [simText, setSimText] = useState('');
  const [simReply, setSimReply] = useState('');

  const simulateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/whatsapp-simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notify-secret': import.meta.env.VITE_NOTIFY_SECRET ?? '',
        },
        body: JSON.stringify({
          phone: simPhone,
          name: simName,
          text: simText,
        }),
      });

      const payload = (await response.json()) as WhatsAppSimulateResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Simulation failed');
      }
      return payload.reply ?? '';
    },
    onSuccess: (reply) => {
      setSimReply(reply);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('success', 'Simulated message processed');
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
                />
                <p className="text-xs text-stone-500">
                  Tip: dacă nu ai ANTHROPIC_API_KEY local, trimite ORDER JSON (customer_name, customer_phone, items).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => simulateMutation.mutate()}
                  disabled={simulateMutation.isPending || !simText.trim()}
                  className="bg-stone-900 text-white hover:bg-stone-800"
                >
                  {simulateMutation.isPending ? 'Running…' : 'Run Simulation'}
                </Button>
                {simReply && <p className="text-xs text-stone-500">Last reply captured below</p>}
              </div>

              {simReply && (
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold text-stone-500 mb-1">Assistant reply</p>
                  <p className="text-sm text-stone-800 whitespace-pre-wrap">{simReply}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
