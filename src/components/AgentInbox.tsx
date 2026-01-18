
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, X, Box } from 'lucide-react';
import { useAgentInbox } from '../hooks/useAgentInbox';

export function AgentInbox() {
  const { t } = useTranslation();
  const { items, loading, approve, reject } = useAgentInbox();

  if (loading) return null; // Or a spinner
  if (items.length === 0) return null; // Hide if empty

  return (
    <Card className="border-purple-200 bg-purple-50/50 mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-purple-900 flex items-center gap-2">
            <Box className="w-5 h-5" />
            {t('agentInbox.title')}
            <Badge className="bg-purple-600 hover:bg-purple-700 ml-2">
              {items.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-purple-100 gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {item.type === 'REORDER' ? t('agentInbox.reorder') : item.type}
                </span>
                <Badge variant="outline" className="text-xs font-normal text-gray-500 border-gray-200">
                  {t('agentInbox.confidence')}: {(item.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {item.productName}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                ID: {item.productId.split('-')[0]}...
              </p>
              <p className="text-xs text-gray-500 italic mt-1">
                "{item.reason}"
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => reject(item.id)}
              >
                <X className="w-4 h-4 mr-1" />
                {t('agentInbox.reject')}
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white border-none"
                onClick={() => approve(item.id)}
              >
                <Check className="w-4 h-4 mr-1" />
                {t('agentInbox.approve')}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
