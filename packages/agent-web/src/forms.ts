import { ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { ActionError, type AgentAction, defineAction, requireDescriptions } from './action.js';
import type { Confirmation, SummaryLine } from './confirmation.js';

/** A screen form. The values live in the app's own form; the library only reads and writes them. */
export interface FormSpec<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  fields: S;
  fill(values: Partial<z.infer<S>>): void;
  values(): unknown;
  /** Called only after the user says the right code. Its return value goes to the AI. */
  submit(values: z.infer<S>): unknown;
}

/**
 * The two actions of a form: `fill_<name>` fills in what the user dictates and `submit_<name>` requests the
 * submission, which waits for the confirmation code.
 */
export function formActions(spec: FormSpec, confirmation: Confirmation): AgentAction[] {
  const schema = z.toJSONSchema(spec.fields, { io: 'input' }) as { properties?: Record<string, { description?: string }> };
  requireDescriptions(schema, `of form "${spec.name}"`);
  const label = (field: string) => schema.properties?.[field]?.description ?? field;

  /** Lists missing or invalid fields with their descriptions, e.g. "email (Email address)". */
  const problems = () => {
    const result = spec.fields.safeParse(spec.values());
    if (result.success) return { ok: true as const, data: result.data, fields: [] as string[] };
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(Boolean);
    return { ok: false as const, fields };
  };

  const actions = [
    defineAction({
      name: `fill_${spec.name}`,
      description: `Fills in form "${spec.name}" (${spec.description}) on screen with what the user dictates. You can send only some fields. It does not submit: use submit_${spec.name} for that.`,
      params: spec.fields.partial(),
      run: (values) => {
        spec.fill(values);
        const { fields } = problems();
        return { filled: Object.keys(values), missing: fields };
      },
    }),
    defineAction({
      name: `submit_${spec.name}`,
      description: `Requests submitting form "${spec.name}" with what is on screen. Nothing is sent yet: the page shows a code and answers NEEDS_CONFIRMATION; ask the user to read it and send it with confirm.`,
      params: z.object({}),
      effect: 'confirm',
      run: () => {
        const check = problems();
        if (!check.ok) {
          const list = check.fields.map((f) => `${f} (${label(f)})`).join(', ');
          throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `Missing or invalid fields: ${list}`);
        }
        const data = check.data as Record<string, unknown>;
        const summary: SummaryLine[] = Object.entries(data)
          .filter(([, value]) => value !== undefined && value !== '')
          .map(([field, value]) => ({ label: label(field), value: typeof value === 'string' ? value : JSON.stringify(value) }));
        confirmation.request(spec.name, summary, () => spec.submit(check.data));
        throw new ActionError(
          ProtocolErrorCode.NEEDS_CONFIRMATION,
          'The page shows a 4-digit code with a summary of what will be sent. Ask the user to read it and send it with confirm. Never make it up.',
        );
      },
    }),
  ];
  selfConfirmed.add(actions[1]!);
  return actions;
}

/** Form submit actions ask for the code themselves; withConfirmation leaves them as they are. */
const selfConfirmed = new WeakSet<AgentAction>();

/**
 * Makes an action declared with `effect: 'confirm'` wait for the confirmation code like a form: it shows a code with a
 * summary of its parameters, answers NEEDS_CONFIRMATION and runs only after `confirm` with the code the user says.
 * Any other action is returned as it is.
 */
export function withConfirmation(action: AgentAction, confirmation: Confirmation): AgentAction {
  if (action.definition.effect !== 'confirm' || selfConfirmed.has(action)) return action;
  const properties = (action.definition.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {};
  return {
    ...action,
    run: (params, context) => {
      const summary: SummaryLine[] = Object.entries((params ?? {}) as Record<string, unknown>)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([field, value]) => ({
          label: properties[field]?.description ?? field,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        }));
      confirmation.request(action.definition.name, summary, () => action.run(params, context));
      throw new ActionError(
        ProtocolErrorCode.NEEDS_CONFIRMATION,
        'The page shows a 4-digit code with a summary of what will be done. Ask the user to read it and send it with confirm. Never make it up.',
      );
    },
  };
}
