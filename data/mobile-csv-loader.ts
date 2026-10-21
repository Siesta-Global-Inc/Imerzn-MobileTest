import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Absolute path of a file under testdata/, e.g. testDataPath('common', 'auth.csv'). */
export function testDataPath(...parts: string[]): string {
  return resolve(process.cwd(), 'testdata', ...parts);
}

/** Return a function that reads a required, non-empty field from the CSV data. */
export function requiredGetter(data: Map<string, string>, path: string) {
  return (field: string): string => {
    const value = data.get(field);
    if (!value) {
      throw new Error(`Missing field "${field}" in ${path}.`);
    }
    return value;
  };
}

/** Resolve a project-relative file path and fail early if it does not exist. */
export function existingFile(path: string): string {
  const absolutePath = resolve(process.cwd(), path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Test data file does not exist: ${absolutePath}`);
  }
  return absolutePath;
}

/**
 * Read a two-column Field,Value CSV into a Map. Supports quoted values with commas,
 * escaped quotes ("") and comment lines starting with #.
 */
export async function readFieldValueCsv(path: string): Promise<Map<string, string>> {
  const rows = (await readFile(path, 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => parseCsvRow(line, path));

  const [headers, ...records] = rows;
  if (headers?.[0]?.trim().toLowerCase() !== 'field' || headers[1]?.trim().toLowerCase() !== 'value') {
    throw new Error(`Expected Field,Value headers in ${path}.`);
  }

  const data = new Map<string, string>();
  for (const [field, value] of records) {
    if (field === undefined || value === undefined) {
      throw new Error(`Every row in ${path} must contain a Field and Value.`);
    }
    data.set(field.trim(), value.trim());
  }
  return data;
}

function parseCsvRow(line: string, path: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error(`Unclosed quoted field in ${path}.`);
  }
  fields.push(field);
  return fields;
}
