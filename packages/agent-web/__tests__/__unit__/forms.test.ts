import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { z } from 'zod';

import { type ActionContext, type ConfirmationState } from '../../src/index.js';
import { Confirmation } from '../../src/confirmation.js';
import { formActions, type FormSpec, withConfirmation } from '../../src/forms.js';
import { defineAction } from '../../src/action.js';
import { flush, readyAgent } from '../socket.fake.js';

const context: ActionContext = { route: '/contact', title: 'Contact', page: 1, actions: [], content: undefined };

const fields = z.object({
  name: z.string().min(1).describe('Name'),
  email: z.email().describe('Email address'),
  message: z.string().min(10).describe('Message'),
});

const dictated = { name: 'Ana', email: 'ana@example.com', message: 'Hello, a question' };

/** A test form: the values live here, as they would in the app. */
function testForm() {
  const values: Record<string, string> = { name: '', email: '', message: '' };
  const sent: unknown[] = [];
  const spec: FormSpec<typeof fields> = {
    name: 'contact',
    description: 'Write to the newsroom',
    fields,
    fill: (v) => Object.assign(values, v),
    values: () => ({ ...values }),
    submit: (v) => {
      sent.push(v);
      return { ticket: 42 };
    },
  };
  return { values, sent, spec };
}

/** Runs an action the way the pipeline does: validates and calls run. */
const run = async (action: ReturnType<typeof formActions>[number], params: unknown = {}) =>
  action.run(action.params.parse(params), context);

describe('Confirmation', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
  afterEach(() => mock.timers.reset());

  const make = () => {
    const states: ConfirmationState[] = [];
    const confirmation = new Confirmation((s) => states.push(s), () => '4712');
    return { confirmation, states };
  };

  it('requests confirmation: a 4-digit code, 3 attempts and a notice to the app', () => {
    const { confirmation, states } = make();
    confirmation.request('contact', [], () => 'sent');
    assert.deepEqual(states.at(-1), { status: 'pending', form: 'contact', code: '4712', summary: [], expiresAt: 60_000, attemptsLeft: 3 });
  });

  it('submits and returns the result for the right code, even with spaces from the transcription', async () => {
    const { confirmation } = make();
    confirmation.request('contact', [], () => 'sent');
    assert.equal(await confirmation.confirm('4 7 1 2'), 'sent');
    assert.equal(confirmation.state.status, 'none');
  });

  it('answers INVALID_CODE with the attempts left for a wrong code, and cancels on the third', async () => {
    const { confirmation } = make();
    let sent = false;
    confirmation.request('contact', [], () => (sent = true));
    await assert.rejects(confirmation.confirm('1111'), { code: 'INVALID_CODE', attemptsLeft: 2 });
    await assert.rejects(confirmation.confirm('2222'), { code: 'INVALID_CODE', attemptsLeft: 1 });
    await assert.rejects(confirmation.confirm('3333'), { code: 'INVALID_CODE', attemptsLeft: 0 });
    assert.equal(confirmation.state.status, 'none');
    await assert.rejects(confirmation.confirm('4712'), { code: 'NOT_AVAILABLE' });
    assert.equal(sent, false);
  });

  it('expires after 60 s', () => {
    const { confirmation } = make();
    confirmation.request('contact', [], () => {});
    mock.timers.tick(59_999);
    assert.equal(confirmation.state.status, 'pending');
    mock.timers.tick(1);
    assert.equal(confirmation.state.status, 'none');
  });

  it('answers NOT_AVAILABLE to confirm when nothing is pending', async () => {
    await assert.rejects(make().confirmation.confirm('4712'), { code: 'NOT_AVAILABLE' });
  });

  /** A new request does not grant new guesses: wrong codes count in a row across requests. */
  it('locks new requests after 3 wrong codes in a row, even spread over several codes', async () => {
    const { confirmation } = make();
    confirmation.request('contact', [], () => {});
    await assert.rejects(confirmation.confirm('1111'), { code: 'INVALID_CODE' });
    confirmation.request('contact', [], () => {});
    await assert.rejects(confirmation.confirm('2222'), { code: 'INVALID_CODE' });
    await assert.rejects(confirmation.confirm('3333'), { code: 'INVALID_CODE' });
    assert.throws(() => confirmation.request('contact', [], () => {}), { code: 'TOO_MANY_ATTEMPTS' });
    mock.timers.tick(60_000);
    confirmation.request('contact', [], () => {});
    assert.equal(confirmation.state.status, 'pending');
  });

  it('doubles each lock up to one hour, and only a right code clears the count', async () => {
    const { confirmation } = make();
    const fail3 = async () => {
      confirmation.request('contact', [], () => {});
      for (const code of ['1111', '2222', '3333']) await assert.rejects(confirmation.confirm(code), { code: 'INVALID_CODE' });
    };
    await fail3();
    mock.timers.tick(60_000);
    await fail3();
    mock.timers.tick(60_000);
    assert.throws(() => confirmation.request('contact', [], () => {}), { code: 'TOO_MANY_ATTEMPTS' });
    mock.timers.tick(60_000);
    confirmation.request('contact', [], () => {});
    assert.equal(await confirmation.confirm('4712'), undefined);
    await fail3();
    mock.timers.tick(60_000);
    confirmation.request('contact', [], () => {});
    assert.equal(confirmation.state.status, 'pending');
  });

  it('keeps the lock across a screen change', async () => {
    const { confirmation } = make();
    confirmation.request('contact', [], () => {});
    for (const code of ['1111', '2222', '3333']) await assert.rejects(confirmation.confirm(code), { code: 'INVALID_CODE' });
    confirmation.cancel();
    assert.throws(() => confirmation.request('contact', [], () => {}), { code: 'TOO_MANY_ATTEMPTS' });
  });
});

describe('formActions', () => {
  const setup = () => {
    const form = testForm();
    const confirmation = new Confirmation(() => {}, () => '4712');
    const [fill, submit] = formActions(form.spec as unknown as FormSpec, confirmation);
    return { ...form, confirmation, fill: fill!, submit: submit! };
  };

  it('creates fill_<name> and submit_<name>; submit has effect confirm', () => {
    const { fill, submit } = setup();
    assert.equal(fill.definition.name, 'fill_contact');
    assert.equal(submit.definition.name, 'submit_contact');
    assert.equal(submit.definition.effect, 'confirm');
  });

  it('fill sets only the dictated fields and tells what is missing', async () => {
    const { fill, values } = setup();
    const result = await run(fill, { name: dictated.name, message: dictated.message });
    assert.equal(values.name, 'Ana');
    assert.deepEqual(result, { filled: ['name', 'message'], missing: ['email'] });
  });

  it('fill rejects a value that does not fit (a misheard email)', () => {
    const { fill } = setup();
    assert.equal(fill.params.safeParse({ email: 'ana at example' }).success, false);
  });

  it('submit with missing fields answers INVALID_PARAMS with their descriptions and asks for no code', async () => {
    const { fill, submit, confirmation } = setup();
    await run(fill, { name: dictated.name });
    await assert.rejects(run(submit), (e: any) => e.code === 'INVALID_PARAMS' && /email \(Email address\)/.test(e.message));
    assert.equal(confirmation.state.status, 'none');
  });

  /** The summary shows what is actually on screen. */
  it('a complete submit answers NEEDS_CONFIRMATION with a summary of what is on screen, and sends nothing yet', async () => {
    const { fill, submit, confirmation, values, sent } = setup();
    await run(fill, dictated);
    values.message = 'Changed by hand by the user';
    await assert.rejects(run(submit), { code: 'NEEDS_CONFIRMATION' });
    const state = confirmation.state;
    assert.equal(state.status, 'pending');
    assert.deepEqual(state.status === 'pending' && state.summary, [
      { label: 'Name', value: 'Ana' },
      { label: 'Email address', value: 'ana@example.com' },
      { label: 'Message', value: 'Changed by hand by the user' },
    ]);
    assert.equal(sent.length, 0);
    assert.deepEqual(await confirmation.confirm('4712'), { ticket: 42 });
    assert.deepEqual(sent, [{ ...dictated, message: 'Changed by hand by the user' }]);
  });

  it('throws at definition time when a field has no description', () => {
    const spec = { ...testForm().spec, fields: z.object({ name: z.string() }) };
    assert.throws(() => formActions(spec as unknown as FormSpec, new Confirmation(() => {})), /"name" of form "contact" has no description/);
  });
});

describe('agent: forms', () => {
  const nextTurn = () => new Promise((resolve) => setTimeout(resolve));

  it('never sends the code over the channel; confirm with the code the user sees submits', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/contact', title: 'Contact' });
    const form = testForm();
    t.agent.provideForm(form.spec);
    let shown: ConfirmationState = { status: 'none' };
    t.agent.onConfirmation((s) => (shown = s));
    await nextTurn();

    t.socket().receive({ id: 'o1', action: 'fill_contact', params: dictated, page: 1 });
    await flush();
    t.socket().receive({ id: 'o2', action: 'submit_contact', params: {}, page: 1 });
    await flush();
    assert.equal((t.socket().last() as any).error.code, 'NEEDS_CONFIRMATION');
    assert.equal(shown.status, 'pending');
    const code = shown.status === 'pending' ? shown.code : '';
    assert.ok(!t.socket().sent.some((m) => JSON.stringify(m).includes(code)), 'the code must not travel over the channel');

    t.socket().receive({ id: 'o3', action: 'confirm', params: { code }, page: 1 });
    await flush();
    assert.deepEqual((t.socket().last() as any).result, { sent: true, result: { ticket: 42 } });
    assert.equal(form.sent.length, 1);
  });

  it('blocks text search and reading while waiting for the code, so the AI cannot guess it', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/contact', title: 'Contact' });
    const form = testForm();
    form.spec.fill(dictated);
    t.agent.provideForm(form.spec);
    t.agent.provideContent('page', () => ({ data: 'x' }));
    await nextTurn();
    t.socket().receive({ id: 'o1', action: 'submit_contact', params: {}, page: 1 });
    await flush();
    for (const [action, params] of [['highlight', { text: '0000' }], ['scroll', { text: '0000' }], ['read_content', {}]] as const) {
      t.socket().receive({ id: action, action, params, page: 1 });
      await flush();
      assert.equal((t.socket().last() as any).error.code, 'NOT_AVAILABLE', action);
      assert.match((t.socket().last() as any).error.message, /waiting for its confirmation code/);
    }
  });

  it('cancels the pending submission on screen change', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/contact', title: 'Contact' });
    const form = testForm();
    form.spec.fill(dictated);
    t.agent.provideForm(form.spec);
    let shown: ConfirmationState = { status: 'none' };
    t.agent.onConfirmation((s) => (shown = s));
    await nextTurn();
    t.socket().receive({ id: 'o1', action: 'submit_contact', params: {}, page: 1 });
    await flush();
    assert.equal(shown.status, 'pending');
    t.agent.setPage({ route: '/', title: 'Home' });
    assert.equal(shown.status, 'none');
  });
});

describe('withConfirmation', () => {
  /** An action declared with effect 'confirm' waits for the code like a form. */
  it('asks for the code before running an action declared with effect confirm, and runs it with the right code', async () => {
    let ran = 0;
    const confirmation = new Confirmation(() => {}, () => '4712');
    const action = defineAction({
      name: 'cancel_appointment',
      description: 'Cancels an appointment',
      effect: 'confirm',
      params: z.object({ id: z.string().describe('Appointment') }),
      run: () => ++ran,
    });
    const gated = withConfirmation(action, confirmation);
    assert.throws(() => gated.run({ id: 'a1' }, context), { code: 'NEEDS_CONFIRMATION' });
    assert.equal(ran, 0);
    assert.deepEqual(confirmation.state.status === 'pending' && confirmation.state.summary, [{ label: 'Appointment', value: 'a1' }]);
    assert.equal(await confirmation.confirm('4712'), 1);
  });

  it('leaves other actions and form submits as they are', () => {
    const confirmation = new Confirmation(() => {}, () => '4712');
    const plain = defineAction({ name: 'sort', description: 'Sorts', params: z.object({}), run: () => 'ok' });
    assert.equal(withConfirmation(plain, confirmation), plain);
    const [, submit] = formActions(testForm().spec, confirmation);
    assert.equal(withConfirmation(submit!, confirmation), submit);
  });
});
