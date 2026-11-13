import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { CUT, createVoiceServer, SILENCE, type VoiceTools } from '../../src/server.js';

async function connect(tools: VoiceTools) {
  const server = createVoiceServer(tools);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}

const textOf = (result: Awaited<ReturnType<Client['callTool']>>) =>
  (result.content as { text: string }[]).map((c) => c.text).join('\n');

describe('voice server', () => {
  it('gives instructions to converse in a loop, and the listen and speak tools', async () => {
    const client = await connect({ listen: async () => '', speak: async () => {}, stop: () => {} });
    assert.match(client.getInstructions() ?? '', /listen → do what they ask → speak/);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['listen', 'stop', 'speak']);
  });

  it('listen returns what the user said, or a notice when they said nothing', async () => {
    const heard = ['which page am I on?', ''];
    const client = await connect({ listen: async () => heard.shift()!, speak: async () => {}, stop: () => {} });
    assert.equal(textOf(await client.callTool({ name: 'listen', arguments: {} })), 'which page am I on?');
    assert.equal(textOf(await client.callTool({ name: 'listen', arguments: {} })), SILENCE);
  });

  it('stop closes the microphone', async () => {
    let stopped = 0;
    const client = await connect({ listen: async () => '', speak: async () => {}, stop: () => void stopped++ });
    assert.equal(textOf(await client.callTool({ name: 'stop', arguments: {} })), 'Microphone closed');
    assert.equal(stopped, 1);
  });

  it('speak reads the text; without text, an error', async () => {
    const said: string[] = [];
    const client = await connect({ listen: async () => '', speak: async (t) => void said.push(t), stop: () => {} });
    assert.equal((await client.callTool({ name: 'speak', arguments: { text: 'You are on Home' } })).isError, undefined);
    assert.deepEqual(said, ['You are on Home']);
    assert.equal((await client.callTool({ name: 'speak', arguments: { text: ' ' } })).isError, true);
  });

  it('a failure (e.g. no microphone) arrives as an error with the reason', async () => {
    const client = await connect({
      listen: async () => {
        throw new Error('Cannot use the microphone: there is none');
      },
      speak: async () => {},
      stop: () => {},
    });
    const result = await client.callTool({ name: 'listen', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /there is none/);
  });

  it('one tool at a time: it does not listen while it speaks', async () => {
    const log: string[] = [];
    let endSpeak = () => {};
    const client = await connect({
      listen: async () => (log.push('listen'), 'hello'),
      speak: () => new Promise<void>((resolve) => (log.push('speak start'), (endSpeak = () => (log.push('speak end'), resolve())))),
      stop: () => {},
    });
    const speaking = client.callTool({ name: 'speak', arguments: { text: 'Hello' } });
    const listening = client.callTool({ name: 'listen', arguments: {} });
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(log, ['speak start']);
    endSpeak();
    await Promise.all([speaking, listening]);
    assert.deepEqual(log, ['speak start', 'speak end', 'listen']);
  });

  it('each new call ends the waiting listen, so speak is not left unplayed', async () => {
    let release = () => {};
    const said: string[] = [];
    const client = await connect({
      listen: () => new Promise<string>((resolve) => (release = () => resolve(''))),
      interrupt: () => release(),
      speak: async (t) => void said.push(t),
      stop: () => {},
    });
    const listening = client.callTool({ name: 'listen', arguments: {} });
    await new Promise((r) => setTimeout(r, 20));
    await client.callTool({ name: 'speak', arguments: { text: 'Here I am' } });
    assert.deepEqual(said, ['Here I am']);
    assert.equal(textOf(await listening), SILENCE);
  });

  it('speak returns right away (Playing); with wait, when playback ends (Said)', async () => {
    const calls: { text: string; wait?: boolean }[] = [];
    const client = await connect({ listen: async () => '', speak: async (text, _language, wait) => void calls.push({ text, wait }), stop: () => {} });
    assert.equal(textOf(await client.callTool({ name: 'speak', arguments: { text: 'Hello' } })), 'Playing');
    assert.equal(textOf(await client.callTool({ name: 'speak', arguments: { text: 'Your appointment is on Saturday', wait: true } })), 'Said');
    assert.deepEqual(calls, [{ text: 'Hello', wait: false }, { text: 'Your appointment is on Saturday', wait: true }]);
  });

  it('speak with wait tells whether the user cut it off while playing', async () => {
    const client = await connect({ listen: async () => '', speak: async () => false, stop: () => {} });
    const cut = await client.callTool({ name: 'speak', arguments: { text: 'Fasting glucose: 112', wait: true } });
    assert.equal(cut.isError, true);
    assert.equal(textOf(cut), CUT);
  });
});
