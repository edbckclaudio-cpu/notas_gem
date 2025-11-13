// Utilitário para parsing de linhas com separador de duas espaços ("  "),
// preservando conteúdo entre aspas duplas e escapando "" dentro de campos.
// Também inclui detecção simples para saber se o arquivo parece usar duas espaços.

export function splitTwoSpacesLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (next === '"') {
        // escape de aspas dentro de campo
        buf += '"';
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      i++;
      continue;
    }
    if (!inQuote) {
      // detectar uma sequência de >= 2 espaços como delimitador
      if (ch === ' ' && line[i + 1] === ' ') {
        // consumir toda a sequência de espaços
        let j = i + 2;
        while (j < line.length && line[j] === ' ') j++;
        out.push(buf);
        buf = "";
        i = j;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  out.push(buf);
  // limpar aspas externas e espaços
  return out.map((cell) => {
    let s = cell;
    s = s.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
  });
}

export function looksTwoSpaceDelimited(raw: string): boolean {
  // pega a primeira linha não vazia e verifica se a divisão por duas espaços
  // gera 3 ou mais campos e se vírgulas/tabs são pouco frequentes
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return false;
  const first = lines[0];
  const fields = splitTwoSpacesLine(first);
  const commaCount = (first.match(/,/g) || []).length;
  const tabCount = (first.match(/\t/g) || []).length;
  return fields.length >= 3 && commaCount <= 1 && tabCount === 0;
}

export function parseTwoSpace(raw: string, withHeader: boolean): { headers?: string[]; rows: (string[]|Record<string,string>)[] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [] };
  const rows = lines.map((line) => splitTwoSpacesLine(line));
  if (!withHeader) return { rows };
  const headers = rows[0] || [];
  const body = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (r[i] ?? '').trim();
    }
    return obj;
  });
  return { headers, rows: body };
}