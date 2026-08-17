/*******************************************************************************
 * Copyright (c) 2007-2026 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

import { applyAlignedTargets, asTextPairs, basenameKey, parseJsonPayload, pairByBasename, safeFileName, segmentPlainTarget, stripHtml, xmlTarget } from "./aiJsonTasks.js";
import { applyTemplate, extractByPath, joinUrl, normalizeTranslation, parseJsonHeaders } from "./customAITranslator.js";
import { catalogKeys, setAppLang, t } from "./i18n.js";

function assert(condition: unknown, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

setAppLang('zh');
assert(t('aiPreTranslate') === 'AI 预翻译', 'zh aiPreTranslate');
assert(t('appliedTm', 3, 5).includes('3'), 'zh interpolation');
assert(t('enterPageAndPressEnter').length > 0, 'zh enterPageAndPressEnter');
setAppLang('en');
assert(t('aiPreTranslate') === 'AI Pre-translate', 'en aiPreTranslate');
assert(t('missingKeyFallback') === 'missingKeyFallback', 'missing key fallback');
assert(t('enterPageAndPressEnter') === 'Enter page number and press ENTER', 'en enterPageAndPressEnter');

assert(extractByPath({ choices: [{ message: { content: '你好' } }] }, 'choices.0.message.content') === '你好', 'extractByPath');
assert(applyTemplate('{"model":"{{model}}"}', { model: 'gpt-4o-mini' }) === '{"model":"gpt-4o-mini"}', 'applyTemplate');
assert(joinUrl('https://api.openai.com/v1', '/chat/completions') === 'https://api.openai.com/v1/chat/completions', 'joinUrl append');
assert(joinUrl('https://api.openai.com/v1/chat/completions', '/chat/completions') === 'https://api.openai.com/v1/chat/completions', 'joinUrl keep endpoint');
assert(normalizeTranslation('OK', true) === '<target>OK</target>', 'normalizeTranslation wrap');
assert(parseJsonHeaders('{"X-Test":"1"}')['X-Test'] === '1', 'parseJsonHeaders');

assert(stripHtml('<p>Hello&nbsp;<b>world</b></p>') === 'Hello world', 'stripHtml');
assert(xmlTarget('a < b') === '<target>a &lt; b</target>', 'xmlTarget');
assert(basenameKey('/tmp/Manual.DOCX') === 'manual', 'basenameKey');
assert(pairByBasename(['/src/a.docx'], ['/tgt/a.docx', '/tgt/b.docx']).length === 1, 'pairByBasename');
assert(safeFileName('a/b:c') === 'a_b_c', 'safeFileName');
assert(segmentPlainTarget({ source: 'src', target: '<i>tgt</i>' }) === 'tgt', 'segmentPlainTarget prefers target');
assert(segmentPlainTarget({ source: 'src', target: '' }) === 'src', 'segmentPlainTarget falls back');
assert(JSON.stringify(asTextPairs(parseJsonPayload('```json\n[{"source":"term","target":"术语"}]\n```'))) === JSON.stringify([{ source: 'term', target: '术语' }]), 'parseJsonPayload + asTextPairs');
assert(applyAlignedTargets(
    [{ file: '1', unit: 'u', segment: 's1', text: 'Open the file' }],
    [{ source: 'Open the file', target: '打开文件' }]
)[0].target === '打开文件', 'applyAlignedTargets');

setAppLang('zh');
assert(t('stepAlign') === '双语文件对齐', 'zh stepAlign');
assert(t('stepAlignTerms') === '术语对齐', 'zh stepAlignTerms');
assert(t('stepGenerateTm') === '生成翻译记忆库', 'zh stepGenerateTm');
assert(t('stepGenerateGlossary') === '生成术语库', 'zh stepGenerateGlossary');
setAppLang('en');
assert(t('stepAlign') === 'Align bilingual files', 'en stepAlign');
let zhKeys: string = catalogKeys('zh').sort().join(',');
let enKeys: string = catalogKeys('en').sort().join(',');
assert(zhKeys === enKeys, 'zh/en catalog keys match');

console.log('unit checks passed');
