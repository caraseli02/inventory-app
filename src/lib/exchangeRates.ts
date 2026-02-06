export interface BnmRateResult {
  rate: number; // MDL per 1 EUR
  date: string; // DD.MM.YYYY from BNM
  isFallback: boolean;
}

const BNM_XML_ENDPOINT = 'https://bnm.md/md/official_exchange_rates';
const EUR_CODE = 'EUR';

const formatBnmDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const parseNumber = (value: string | null): number | null => {
  if (!value) return null;
  const normalized = value.replace(',', '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const extractText = (node: Element | null, tagName: string): string | null => {
  if (!node) return null;
  const child = node.getElementsByTagName(tagName)[0];
  return child?.textContent?.trim() ?? null;
};

const parseBnmXml = (xmlText: string): { rate: number; date: string } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Failed to parse BNM XML response');
  }

  const root = doc.getElementsByTagName('ValCurs')[0];
  const date = root?.getAttribute('Date') ?? '';

  const nodes = Array.from(doc.getElementsByTagName('Valute'));
  const eurNode = nodes.find((node) => extractText(node, 'CharCode') === EUR_CODE) || null;
  if (!eurNode) {
    throw new Error('EUR rate not found in BNM response');
  }

  const nominal = parseNumber(extractText(eurNode, 'Nominal')) ?? 1;
  const value = parseNumber(extractText(eurNode, 'Value'));

  if (!value || value <= 0 || !Number.isFinite(nominal) || nominal <= 0) {
    throw new Error('Invalid EUR rate in BNM response');
  }

  const rate = value / nominal;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid EUR rate value');
  }

  if (!date) {
    throw new Error('Missing rate date in BNM response');
  }

  return { rate, date };
};

const fetchBnmXml = async (date?: Date): Promise<{ rate: number; date: string }> => {
  const params = new URLSearchParams({ get_xml: '1' });
  if (date) {
    params.set('date', formatBnmDate(date));
  }

  const url = `${BNM_XML_ENDPOINT}?${params.toString()}`;
  const response = await fetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`BNM request failed: ${response.status}`);
  }

  const text = await response.text();
  return parseBnmXml(text);
};

const subtractDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
};

export const getBnmEurRate = async (
  invoiceDate?: Date | null,
  maxLookbackDays = 7
): Promise<BnmRateResult> => {
  if (!invoiceDate) {
    const latest = await fetchBnmXml();
    return { ...latest, isFallback: false };
  }

  for (let offset = 0; offset <= maxLookbackDays; offset++) {
    try {
      const dateToTry = offset === 0 ? invoiceDate : subtractDays(invoiceDate, offset);
      const result = await fetchBnmXml(dateToTry);
      return { ...result, isFallback: offset > 0 };
    } catch (error) {
      if (offset === maxLookbackDays) {
        throw error;
      }
    }
  }

  throw new Error('BNM rate unavailable');
};
