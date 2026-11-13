/**
 * The help of each screen: its use cases, each with the sentence to try it as you would say it to your AI,
 * the action the AI uses (or tries to), what happens (also when the AI cannot do it), how it is built and the
 * real code snippet that makes it work. File paths are relative to src/app; a snippet defaults to the screen
 * file.
 */
export interface HelpCase {
  title: string;
  say: string;
  action: string;
  what: string;
  how: string;
  code: string;
  file?: string;
}

export interface Help {
  title: string;
  intro: string;
  file: string;
  cases: HelpCase[];
}
