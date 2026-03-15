#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { computeTwilioSignature } from '../api/lib/twilio-signature.js';
import { resetConversationHistory } from '../lib/whatsapp/conversation-state.js';
import {
  clearReplayCapture,
  readReplayCapture,
  type ReplayTransportEvent,
} from '../lib/whatsapp/replay-context.js';

type ReplayStep = {
  body?: string;
  buttonPayload?: string;
  note?: string;
  pauseMs?: number;
  expectStatus?: number;
  expectTwimlIncludes?: string | string[];
  expectAsyncBodyIncludes?: string | string[];
  expectAsyncTemplateSid?: string;
  /** Expected number of ContentVariables keys — catches Twilio error 21656 locally */
  expectTemplateVariableCount?: number;
};

type ReplayFixture = {
  name: string;
  description?: string;
  phone: string;
  profileName?: string;
  to?: string;
  resetConversation?: boolean;
  steps: ReplayStep[];
};

type CliOptions = {
  fixture: string | null;
  list: boolean;
};

const FIXTURE_DIR = path.resolve(process.cwd(), 'fixtures/whatsapp-replay');
const DEFAULT_BASE_URL = process.env.WHATSAPP_REPLAY_BASE_URL ?? 'http://localhost:5173';

function parseArgs(argv: string[]): CliOptions {
  let fixture: string | null = null;
  let list = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') {
      list = true;
      continue;
    }

    if (arg === '--fixture' || arg === '-f') {
      fixture = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (!fixture) fixture = arg;
  }

  return { fixture, list };
}

async function listFixtures(): Promise<void> {
  const entries = await fs.readdir(FIXTURE_DIR);
  const jsonFiles = entries.filter((entry) => entry.endsWith('.json')).sort();

  if (!jsonFiles.length) {
    console.log(`No replay fixtures found in ${FIXTURE_DIR}`);
    return;
  }

  console.log('Available replay fixtures:');
  for (const file of jsonFiles) {
    console.log(`- ${file.replace(/\.json$/, '')}`);
  }
}

function resolveFixturePath(fixtureArg: string): string {
  if (fixtureArg.endsWith('.json') && path.isAbsolute(fixtureArg)) return fixtureArg;
  if (fixtureArg.includes(path.sep)) return path.resolve(process.cwd(), fixtureArg);
  const fileName = fixtureArg.endsWith('.json') ? fixtureArg : `${fixtureArg}.json`;
  return path.join(FIXTURE_DIR, fileName);
}

async function loadFixture(fixtureArg: string): Promise<ReplayFixture> {
  const fixturePath = resolveFixturePath(fixtureArg);
  const raw = await fs.readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw) as ReplayFixture;

  if (!parsed.phone || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error(`Invalid replay fixture: ${fixturePath}`);
  }

  return parsed;
}

function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTwimlMessage(xml: string): string | null {
  const match = xml.match(/<Message>([\s\S]*?)<\/Message>/i);
  if (!match) return null;
  return decodeXmlText(match[1].trim());
}

function getExpectationList(value: ReplayStep['expectTwimlIncludes']): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function assertStep(args: {
  step: ReplayStep;
  status: number;
  twimlMessage: string | null;
  replayEvents: ReplayTransportEvent[];
}): void {
  const expectedStatus = args.step.expectStatus ?? 200;
  if (args.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, got ${args.status}`);
  }

  for (const expectedText of getExpectationList(args.step.expectTwimlIncludes)) {
    if (!args.twimlMessage?.includes(expectedText)) {
      throw new Error(`Expected TwiML message to include "${expectedText}"`);
    }
  }

  for (const expectedText of getExpectationList(args.step.expectAsyncBodyIncludes)) {
    const matched = args.replayEvents.some((event) => event.kind === 'rest' && event.body.includes(expectedText));
    if (!matched) {
      throw new Error(`Expected async REST message to include "${expectedText}"`);
    }
  }

  if (args.step.expectAsyncTemplateSid) {
    // Support "env:VAR_NAME" syntax to resolve SID from environment
    let expectedSid = args.step.expectAsyncTemplateSid;
    if (expectedSid.startsWith('env:')) {
      const envVar = expectedSid.slice(4);
      expectedSid = process.env[envVar] ?? '';
      if (!expectedSid) {
        throw new Error(`expectAsyncTemplateSid references env var "${envVar}" but it is not set`);
      }
    }

    const templateEvent = args.replayEvents.find((event) => event.kind === 'template' && event.contentSid === expectedSid);
    if (!templateEvent) {
      const actualSids = args.replayEvents
        .filter((e): e is ReplayTransportEvent & { kind: 'template' } => e.kind === 'template')
        .map((e) => e.contentSid);
      throw new Error(`Expected async template send with ContentSid "${expectedSid}"${actualSids.length ? `, got: ${actualSids.join(', ')}` : ', but no template events captured'}`);
    }

    // Validate template variable count matches expected slots (catches Twilio error 21656)
    if (args.step.expectTemplateVariableCount && templateEvent.kind === 'template' && templateEvent.variables) {
      const actualCount = Object.keys(templateEvent.variables).length;
      if (actualCount !== args.step.expectTemplateVariableCount) {
        throw new Error(`Expected ${args.step.expectTemplateVariableCount} template variables, got ${actualCount}: ${JSON.stringify(templateEvent.variables)}`);
      }
    }
  }
}

function buildTwilioParams(args: {
  phone: string;
  profileName: string;
  to: string;
  step: ReplayStep;
  stepIndex: number;
}): Record<string, string> {
  const params: Record<string, string> = {
    From: `whatsapp:${args.phone}`,
    To: args.to,
    Body: args.step.body ?? '',
    ProfileName: args.profileName,
    MessageSid: `SM${Date.now()}${String(args.stepIndex).padStart(2, '0')}`,
  };

  if (args.step.buttonPayload) {
    params.ButtonPayload = args.step.buttonPayload;
  }

  return params;
}

async function postReplayStep(args: {
  baseUrl: string;
  authToken: string;
  params: Record<string, string>;
  replayId: string;
}): Promise<{ status: number; body: string }> {
  const webhookUrl = `${args.baseUrl.replace(/\/$/, '')}/api/whatsapp`;
  const signature = computeTwilioSignature({
    authToken: args.authToken,
    url: webhookUrl,
    params: args.params,
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': signature,
      'x-whatsapp-replay-id': args.replayId,
      'x-forwarded-host': webhookUrl.replace(/^https?:\/\//, '').split('/')[0] ?? 'localhost:5173',
      'x-forwarded-proto': webhookUrl.startsWith('https://') ? 'https' : 'http',
    },
    body: new URLSearchParams(args.params).toString(),
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

async function maybeResetConversation(phone: string, resetConversation: boolean | undefined): Promise<void> {
  if (!resetConversation) return;
  await resetConversationHistory(phone);
}

async function waitForReplayEvents(replayId: string, timeoutMs: number): Promise<ReplayTransportEvent[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const events = await readReplayCapture(replayId);
    if (events.length > 0 || Date.now() >= deadline) return events;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function runFixture(fixture: ReplayFixture): Promise<void> {
  const baseUrl = DEFAULT_BASE_URL.replace(/\/$/, '');
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? 'test-token-12345';
  const phone = normalizePhone(fixture.phone);
  const profileName = fixture.profileName?.trim() || 'Replay Tester';
  const to = fixture.to ?? 'whatsapp:+1234567890';

  console.log(`Fixture: ${fixture.name}`);
  if (fixture.description) console.log(`Description: ${fixture.description}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Phone: ${phone}`);
  console.log('');

  await maybeResetConversation(phone, fixture.resetConversation);
  if (fixture.resetConversation) {
    console.log('Conversation reset before replay.');
    console.log('');
  }

  for (let index = 0; index < fixture.steps.length; index += 1) {
    const step = fixture.steps[index];
    const replayId = `${phone.replace(/[^\d+]/g, '')}-${Date.now()}-${index + 1}`;
    await clearReplayCapture(replayId);
    const params = buildTwilioParams({
      phone,
      profileName,
      to,
      step,
      stepIndex: index + 1,
    });

    console.log(`Step ${index + 1}/${fixture.steps.length}`);
    if (step.note) console.log(`Note: ${step.note}`);
    console.log(`Incoming Body: ${step.body ?? '(empty)'}`);
    if (step.buttonPayload) console.log(`ButtonPayload: ${step.buttonPayload}`);

    const result = await postReplayStep({
      baseUrl,
      authToken,
      params,
      replayId,
    });

    const twimlMessage = extractTwimlMessage(result.body);
    const replayEvents = await waitForReplayEvents(replayId, step.pauseMs ?? 1200);
    assertStep({
      step,
      status: result.status,
      twimlMessage,
      replayEvents,
    });

    console.log(`HTTP ${result.status}`);
    if (twimlMessage) {
      console.log(`TwiML Message: ${twimlMessage}`);
    } else {
      console.log('TwiML Message: (none)');
    }
    if (replayEvents.length) {
      console.log('Async Events:');
      for (const event of replayEvents) {
        if (event.kind === 'typing') {
          console.log(`- typing: ${event.messageSid || '(empty MessageSid)'}`);
          continue;
        }
        if (event.kind === 'template') {
          const varCount = event.variables ? Object.keys(event.variables).length : 0;
          console.log(`- template: ${event.contentSid} -> ${event.to} (${varCount} variables)`);
          if (event.variables) {
            for (const [key, value] of Object.entries(event.variables)) {
              console.log(`    ${key}: ${value}`);
            }
          }
          continue;
        }
        console.log(`- rest: ${event.body}`);
      }
    } else {
      console.log('Async Events: (none captured)');
    }
    console.log('');

    const pauseMs = step.pauseMs ?? 1200;
    if (pauseMs > 0 && index < fixture.steps.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }

  console.log('Replay complete.');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    await listFixtures();
    return;
  }

  if (!options.fixture) {
    console.log('Usage: pnpm whatsapp:replay --fixture <name>');
    console.log('Example: pnpm whatsapp:replay --fixture inventory-qa');
    console.log('Use --list to see available fixtures.');
    process.exitCode = 1;
    return;
  }

  const fixture = await loadFixture(options.fixture);
  await runFixture(fixture);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Replay failed: ${message}`);
  process.exitCode = 1;
});
