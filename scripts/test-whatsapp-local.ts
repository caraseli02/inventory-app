#!/usr/bin/env node

/**
 * Local WhatsApp Agent Testing Script
 *
 * Interactive CLI for testing all WhatsApp agent features
 * Run: pnpm tsx scripts/test-whatsapp-local.ts
 *
 * Features:
 * 1. Product Q&A
 * 2. Order creation
 * 3. Multi-turn context
 * 4. Natural date parsing
 * 5. Cancellation
 * 6. Store info
 */

import readline from 'readline';

const BASE_URL = 'http://localhost:5173/api/whatsapp-simulate';
const PHONE = '+40123456789';
const NAME = 'Test Customer';

interface SimulateResponse {
  ok: boolean;
  reply?: string;
  error?: string;
  provider?: string;
  debug?: {
    intent?: string;
    searchCandidatesUsed?: string[];
  };
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

async function simulateMessage(
  text: string,
  options: { reset?: boolean; debug?: boolean } = {}
): Promise<SimulateResponse> {
  const payload = {
    phone: PHONE,
    name: NAME,
    text: options.reset ? undefined : text,
    reset: options.reset ? true : undefined,
    mode: 'agent',
    debug: options.debug ? true : undefined,
  };

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return response.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function testFeature(number: number): Promise<void> {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  switch (number) {
    case 1:
      await testProductQA();
      break;
    case 2:
      await testOrderCreation();
      break;
    case 3:
      await testMultiTurnContext();
      break;
    case 4:
      await testNaturalDates();
      break;
    case 5:
      await testCancellation();
      break;
    case 6:
      await testStoreInfo();
      break;
    default:
      console.log(`${colors.red}Invalid feature number${colors.reset}`);
  }

  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

async function testProductQA(): Promise<void> {
  console.log(`${colors.green}Feature 1: Product Q&A${colors.reset}\n`);

  const queries = ['Aveti lapte?', 'Cat costa zaharul?', 'Aveti caviar?', 'Do you have milk?'];

  for (const query of queries) {
    console.log(`${colors.yellow}You:${colors.reset} ${query}`);
    const result = await simulateMessage(query);

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}\n`);
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}\n`);
    }
  }
}

async function testOrderCreation(): Promise<void> {
  console.log(`${colors.green}Feature 2: Order Creation${colors.reset}\n`);

  // Reset history
  await simulateMessage('', { reset: true });

  const orders = ['Vreau 2 lapte maine 12:00', 'Vreau 1 paine maine 14:30'];

  for (const order of orders) {
    console.log(`${colors.yellow}You:${colors.reset} ${order}`);
    const result = await simulateMessage(order, { debug: true });

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}`);
      if (result.debug?.intent) {
        console.log(`${colors.gray}Intent: ${result.debug.intent}${colors.reset}`);
      }
      console.log();
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}\n`);
    }
  }
}

async function testMultiTurnContext(): Promise<void> {
  console.log(`${colors.green}Feature 3: Multi-Turn Context${colors.reset}\n`);

  // Reset history
  await simulateMessage('', { reset: true });

  const turns = [
    'Aveti lapte?',
    'Vreau 2, maine 15:00',
    'Cat costa?',
    'OK, confirm',
  ];

  for (const turn of turns) {
    console.log(`${colors.yellow}You:${colors.reset} ${turn}`);
    const result = await simulateMessage(turn);

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}\n`);
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}\n`);
    }
  }
}

async function testNaturalDates(): Promise<void> {
  console.log(`${colors.green}Feature 4: Natural Date Parsing${colors.reset}\n`);

  const dates = [
    'Vreau 1 lapte maine 10:00',
    'Vreau 1 paine vineri 14:00',
    'Vreau 1 branza maine la 10.30',
    'Vreau 1 paine maine la 14',
  ];

  for (const dateMsg of dates) {
    console.log(`${colors.yellow}You:${colors.reset} ${dateMsg}`);
    const result = await simulateMessage(dateMsg);

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}\n`);
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}\n`);
    }
  }
}

async function testCancellation(): Promise<void> {
  console.log(`${colors.green}Feature 5: Cancellation Intent${colors.reset}\n`);

  // Reset and create an order
  await simulateMessage('', { reset: true });
  console.log(`${colors.yellow}You:${colors.reset} Vreau 2 lapte maine 12:00`);
  await simulateMessage('Vreau 2 lapte maine 12:00');

  const cancels = ['Anuleaza comanda!', 'Nu mai vreau', 'Anulez'];

  for (const cancel of cancels) {
    console.log(`\n${colors.yellow}You:${colors.reset} ${cancel}`);
    const result = await simulateMessage(cancel, { debug: true });

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}`);
      if (result.debug?.intent) {
        console.log(`${colors.gray}Intent: ${result.debug.intent}${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}`);
    }
  }
}

async function testStoreInfo(): Promise<void> {
  console.log(`${colors.green}Feature 6: Store Info${colors.reset}\n`);

  const queries = ['Care e adresa?', 'Care e programul?', 'Ce numar aveti?'];

  for (const query of queries) {
    console.log(`${colors.yellow}You:${colors.reset} ${query}`);
    const result = await simulateMessage(query);

    if (result.ok && result.reply) {
      console.log(`${colors.green}Bot:${colors.reset} ${result.reply}\n`);
    } else {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}\n`);
    }
  }
}

async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => rl.question(prompt, resolve));
  };

  console.log(`\n${colors.blue}WhatsApp Agent Local Testing${colors.reset}`);
  console.log(`${colors.gray}Tests all features via /api/whatsapp-simulate${colors.reset}\n`);

  let running = true;
  while (running) {
    console.log('Choose a feature to test:');
    console.log('  1. Product Q&A');
    console.log('  2. Order Creation');
    console.log('  3. Multi-Turn Context');
    console.log('  4. Natural Date Parsing');
    console.log('  5. Cancellation Intent');
    console.log('  6. Store Info');
    console.log('  0. Exit\n');

    const choice = await question(`${colors.yellow}Enter choice (0-6):${colors.reset} `);

    if (choice === '0') {
      running = false;
      console.log('${colors.green}Goodbye!${colors.reset}');
    } else {
      const num = parseInt(choice, 10);
      if (num >= 1 && num <= 6) {
        await testFeature(num);
      } else {
        console.log(`${colors.red}Invalid choice${colors.reset}\n`);
      }
    }
  }

  rl.close();
}

// Run interactive mode
interactiveMode().catch(err => {
  console.error(`${colors.red}Error:${colors.reset}`, err);
  process.exit(1);
});
