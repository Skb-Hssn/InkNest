import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const temp = await mkdtemp(path.join(process.cwd(), 'node_modules/.highlight-tests-'));
async function load(file, output) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  await writeFile(path.join(temp, output), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(pathToFileURL(path.join(temp, output)).href);
}
const { highlightCode, supportsCodeLanguage } = await load('src/renderer/src/editor/code-highlighting.ts', 'highlight.mjs');
const { codeLanguages } = await load('src/renderer/src/editor/extensions/code-language-picker.ts', 'languages.mjs');
await rm(temp, { recursive: true });

test('every offered programming language has a grammar, including common fence aliases', () => {
  for (const [language] of codeLanguages) if (language) assert.equal(supportsCodeLanguage(language), true, language);
  for (const language of ['C++', 'cpp', 'C#', 'F#', 'js', 'ts', 'py', 'yml', 'golang', 'dockerfile', 'sh'])
    assert.equal(supportsCodeLanguage(language), true, language);
});

test('C++ distinguishes directives from comments and colors keywords, functions, strings and numbers', () => {
  const code = '#include<bits/stdc++.h>\nusing namespace std;\nint main() { cout << "hello"; return 42; }\n// comment\n';
  const ranges = highlightCode(code, 'cpp');
  const token = (text, style) => ranges.some(range => code.slice(range.from, range.to) === text && range.className.includes(style));
  assert.ok(token('include', 'syntax-keyword'));
  assert.ok(token('namespace', 'syntax-keyword'));
  assert.ok(token('main', 'syntax-function'));
  assert.ok(token('42', 'syntax-number'));
  assert.ok(token('"hello"', 'syntax-string'));
  assert.ok(token('// comment', 'syntax-comment'));
  assert.ok(!ranges.filter(range => range.className.includes('syntax-comment')).some(range => code.slice(range.from, range.to).includes('include')));
});

test('Unicode, CRLF, multiline comments and HTML-like strings yield valid, ordered text offsets', () => {
  const code = '/* comment\r\nconst is not a keyword here */\r\nconst text = "বাংলা 😀 <script>const</script>";\r\n';
  const ranges = highlightCode(code, 'javascript');
  for (const [index, range] of ranges.entries()) {
    assert.ok(range.from >= 0 && range.to <= code.length && range.from < range.to);
    if (index) assert.ok(range.from >= ranges[index - 1].to);
  }
  assert.equal(ranges.filter(range => range.className.includes('syntax-keyword')).map(range => code.slice(range.from, range.to)).join(''), 'const');
  assert.ok(ranges.some(range => range.className.includes('syntax-string') && code.slice(range.from, range.to).includes('বাংলা 😀')));
});

test('plain text, unknown languages, empty and oversized blocks remain unmodified and uncolored', () => {
  for (const language of ['', 'plaintext', 'custom-lang']) assert.deepEqual(highlightCode('const value = "text"; // 42', language), []);
  assert.deepEqual(highlightCode('', 'cpp'), []);
  assert.deepEqual(highlightCode('x'.repeat(100001), 'cpp'), []);
});
