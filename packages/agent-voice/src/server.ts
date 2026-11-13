import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, type CallToolResult, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';

/** Fixed instructions for the AI: how to hold a voice conversation with the user. */
export const INSTRUCTIONS = [
  'Local voice tools: the microphone listens all the time, also while you speak, so the user can answer or interrupt you at once. Each long pause from the user closes a sentence. listen returns everything they said since the last call, whole (or waits for their next sentence to end); speak reads a text out loud to them and returns right away, while it plays.',
  'To talk with the user by voice: greet them with speak, then repeat without stopping: listen → do what they ask → speak a short answer → listen.',
  'Keep listening until the user tells you to stop (for example "stop", "that is all" or "goodbye"). If listen hears nothing, call listen again.',
  'When the voice conversation ends, call stop: it closes the microphone and clears anything pending. If you do not call listen again within 30 s, the microphone closes by itself.',
  'The user may be talking to someone else: if what you hear is not addressed to you, do not answer or act; call listen again.',
  'The transcription may have errors: if it makes no sense or something is missing (e.g. a digit of a code), ask the user to repeat it.',
  'If listen returns something that repeats what you just said, it is your own echo from the speakers: ignore it and call listen again.',
  'As soon as the user finishes talking, answer quickly and briefly: the sooner you go back to listen, the more natural the conversation.',
  'Since speak does not wait for playback to end, when the user asks for something on the page, first say a short sentence and do the action while it plays; then tell the result.',
  'When you read something from the page while marking it with highlight, go sentence by sentence, one response at a time: highlight the first one; then, in each response, speak the highlighted sentence with wait: true and then highlight the next one (so it is ready while the previous one plays). If speak answers that you were cut off, stop everything and call listen.',
  'If the user talks while you speak, your voice stops by itself and listen starts with "(the user interrupted you while you were speaking)": do not carry on with what you were saying; attend to what they ask.',
  'Answer briefly and quickly, in one or two sentences: the less you think before speaking, the better. Do not offer options or suggest things the user did not ask for: if they are just chatting, chat and wait for them to ask for something.',
  'Do one thing at a time and in order. If the user cuts you off or says no, stop everything you were doing, not just the voice.',
  'What you pass to speak is heard: short, natural sentences, with no markdown, lists or emojis.',
  'Answer in the language the user speaks to you, and pass that language to speak in language (es, en, fr…), so it plays with a voice for that language.',
  'If the user says a code they see on a page, pass it to that page pairing tool.',
].join('\n');

export const SILENCE = '(silence: the user has not said anything)';
export const CUT = 'Cut off: the user talked while it was playing. Stop what you were doing and call listen.';

const TOOLS: Tool[] = [
  {
    name: 'listen',
    description:
      'Returns what the user said into the microphone since the last call; if they have not said anything yet, waits for their next sentence to end. If they say nothing for 60 s, returns a silence notice.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'stop',
    description:
      'Ends the voice conversation: closes the microphone and clears everything heard. Call it when the user says stop, that is all, or goodbye.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'speak',
    description:
      'Reads a text out loud to the user through the speakers, with a natural voice for the language of the text. Returns right away, while it plays, so you can keep working. With wait: true, returns when playback ends. Short sentences, no markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to say' },
        language: { type: 'string', description: 'Language of the text: es, en, fr, de… (or es_MX, pt_BR for a variant)' },
        wait: { type: 'boolean', description: 'true: returns when playback ends (e.g. to highlight what you are reading, sentence by sentence). By default, returns right away.' },
      },
      required: ['text'],
    },
  },
];

export interface VoiceTools {
  listen(): Promise<string>;
  /**
   * Starts saying the text. With `wait`, resolves when playback ends, with `false` if the user cut it off.
   */
  speak(text: string, language?: string, wait?: boolean): Promise<boolean | void>;
  stop(): void;
  /** Ends the waiting listen now, without consuming what was heard. */
  interrupt?(): void;
}

const text = (value: string): CallToolResult => ({ content: [{ type: 'text', text: value }] });
const error = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] });

/**
 * The voice MCP server. One tool at a time, in order. Each new call ends any listen still waiting (e.g. one
 * the AI abandoned); otherwise a speak would queue behind it without playing.
 */
export function createVoiceServer(tools: VoiceTools): Server {
  const server = new Server({ name: 'sanoriva-voice', version: '0.0.0' }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  let queue: Promise<unknown> = Promise.resolve();

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, ({ params }) => {
    const run = async (): Promise<CallToolResult> => {
      try {
        if (params.name === 'listen') return text((await tools.listen()) || SILENCE);
        if (params.name === 'stop') {
          tools.stop();
          return text('Microphone closed');
        }
        if (params.name === 'speak') {
          const value = String(params.arguments?.['text'] ?? '').trim();
          if (!value) return error('Missing the text to say');
          const language = String(params.arguments?.['language'] ?? '').trim();
          const wait = params.arguments?.['wait'] === true;
          const played = await tools.speak(value, /^[a-z]{2,3}([_-][A-Za-z]{2})?$/.test(language) ? language : undefined, wait);
          if (wait && played === false) return error(CUT);
          return text(wait ? 'Said' : 'Playing');
        }
        return error(`Unknown tool ${params.name}`);
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    };
    tools.interrupt?.();
    const result = queue.then(run);
    queue = result;
    return result;
  });

  return server;
}
