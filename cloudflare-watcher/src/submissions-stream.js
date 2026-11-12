// Read one submission at a time so long public notes do not fill Worker memory.
export async function* submissionObjects(body) {
  if (!body) throw new Error('Missing ECDSA.fail submissions body');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let mode = 'prefix', prefix = '', parts = [], size = 0, total = 0;
  let depth = 0, quoted = false, escaped = false;
  try {
    while (true) {
      const {value, done} = await reader.read();
      total += value?.byteLength || 0;
      if (total > 128 * 1024 * 1024) throw new Error('ECDSA.fail submissions response exceeds stream limit');
      const text = done ? decoder.decode() : decoder.decode(value, {stream: true});
      let start = mode === 'object' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (mode === 'prefix') {
          prefix += char;
          if (prefix.length > 1024) throw new Error('Invalid ECDSA.fail submissions wrapper');
          if (char === '[') {
            if (!/^\s*\{\s*"submissions"\s*:\s*\[$/.test(prefix)) throw new Error('Invalid ECDSA.fail submissions wrapper');
            mode = 'first';
          }
          continue;
        }
        if (mode === 'object') {
          if (quoted) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
          } else if (char === '"') quoted = true;
          else if (char === '{' || char === '[') depth++;
          else if (char === '}' || char === ']') depth--;
          if (depth === 0) {
            parts.push(text.slice(start, i + 1));
            size += i + 1 - start;
            if (size > 1024 * 1024) throw new Error('ECDSA.fail submission exceeds stream limit');
            const row = JSON.parse(parts.join(''));
            parts = []; size = 0; start = -1; mode = 'separator';
            yield row;
          }
          continue;
        }
        if (/\s/.test(char)) continue;
        if ((mode === 'first' || mode === 'value') && char === '{') {
          mode = 'object'; depth = 1; quoted = false; escaped = false; start = i;
        } else if (mode === 'separator' && char === ',') mode = 'value';
        else if ((mode === 'first' || mode === 'separator') && char === ']') mode = 'end';
        else if (mode === 'end' && char === '}') mode = 'done';
        else throw new Error('Invalid ECDSA.fail submissions framing');
      }
      if (mode === 'object') {
        parts.push(text.slice(start));
        size += text.length - start;
        if (size > 1024 * 1024) throw new Error('ECDSA.fail submission exceeds stream limit');
      }
      if (done) break;
    }
    if (mode !== 'done') throw new Error('Truncated ECDSA.fail submissions response');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
