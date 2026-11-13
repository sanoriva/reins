export interface TextPoint {
  piece: number;
  offset: number;
}

export interface TextMatch {
  start: TextPoint;
  end: TextPoint;
  next: number;
}

/**
 * Finds a passage in the page's text nodes, in order. Tolerates text split across nodes, different whitespace
 * and letter case. Searches from `from` and wraps around to the start.
 */
export function findText(pieces: readonly string[], fragment: string, from = 0): TextMatch | undefined {
  const wanted = normalize(fragment);
  if (wanted === '') return undefined;

  let text = '';
  const origin: TextPoint[] = [];
  pieces.forEach((piece, index) => {
    for (let offset = 0; offset < piece.length; offset++) {
      const char = normalize(piece[offset]!);
      text += char;
      for (let i = 0; i < char.length; i++) origin.push({ piece: index, offset });
    }
  });

  let at = text.indexOf(wanted, from);
  if (at === -1 && from > 0) at = text.indexOf(wanted);
  if (at === -1) return undefined;

  const last = origin[at + wanted.length - 1]!;
  return {
    start: origin[at]!,
    end: { piece: last.piece, offset: last.offset + 1 },
    next: at + wanted.length,
  };
}

const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
