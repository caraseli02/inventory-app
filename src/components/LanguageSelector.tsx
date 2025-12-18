import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/i18n';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger
        className="w-auto min-w-[140px] h-9 border-2 border-stone-200 bg-white/80 backdrop-blur-sm hover:border-stone-300 focus:ring-[var(--color-lavender)] transition-colors"
        aria-label="Select language"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-stone-500" />
          <SelectValue>
            {languageNames[i18n.language as SupportedLanguage] || i18n.language}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map((lang) => (
          <SelectItem
            key={lang}
            value={lang}
            className="cursor-pointer"
          >
            {languageNames[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default LanguageSelector;
