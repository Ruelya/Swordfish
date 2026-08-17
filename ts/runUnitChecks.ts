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
import { applyTemplate, defaultCustomAi, extractByPath, joinUrl, normalizeTranslation, parseJsonHeaders } from "./customAITranslator.js";
import {
    engineShortName,
    listEnabledEngineIds,
    normalizeSelectedEngines,
    preferredMtOrigin,
    reconcileSelectedEngines
} from "./mtEngineSelection.js";
import { catalogKeys, setAppLang, t } from "./i18n.js";
import {
    buildInlineCompletionPrompt,
    consumeTypedPrefix,
    defaultInlineSuggest,
    isCurrentRequest,
    lastWordPrefix,
    normalizeInlineSuggest,
    plainTextFromHtml,
    rankLocalItems,
    resolveInlineCompletionClient,
    sanitizeInlineCompletion,
    shouldRequestAi,
    splitAtOffset,
    takeNextWord
} from "./inlineCompletion.js";

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
assert(t('inlineSuggest') === 'Inline Suggest', 'en inlineSuggest');
setAppLang('zh');
assert(t('inlineSuggest') === '行内补全', 'zh inlineSuggest');

assert(plainTextFromHtml('<p>Hello&nbsp;<img data-id="1"/><b>world</b></p>') === 'Hello world', 'plainTextFromHtml strips tags');
assert(splitAtOffset('abcde', 2).prefix === 'ab' && splitAtOffset('abcde', 2).suffix === 'cde', 'splitAtOffset');
assert(lastWordPrefix('打开文') === '打开文', 'lastWordPrefix cjk');
assert(lastWordPrefix('Hello wo') === 'wo', 'lastWordPrefix word');
assert(takeNextWord('hello world') === 'hello ', 'takeNextWord');
assert(consumeTypedPrefix('Hel', 'lo world', 'Hell') === 'o world', 'consumeTypedPrefix shrinks');
assert(consumeTypedPrefix('Hel', 'lo world', 'Hi') === null, 'consumeTypedPrefix mismatch');
assert(isCurrentRequest(3, 3) && !isCurrentRequest(2, 3), 'isCurrentRequest');

let ranked = rankLocalItems('打开', '打开', [{ source: 'open', target: '打开文件', origin: 'gloss' }], [{ source: 'Open the file', target: '打开文件', similarity: 85 }]);
assert(ranked.items.some((item) => item.kind === 'term' && item.insertText === '文件'), 'term remainder');
assert(ranked.ghost !== null && ranked.ghost.text === '文件' && ranked.ghost.confidence === 'high', 'tm high-confidence ghost');

let prompt: string = buildInlineCompletionPrompt({
    srcLang: 'en',
    tgtLang: 'zh',
    source: 'Open the file',
    prefix: '打',
    suffix: '',
    terms: [{ source: 'file', target: '文件' }],
    tmMatches: [{ source: 'Open the file', target: '打开文件', similarity: 90 }]
});
assert(prompt.includes('Target prefix: 打') && prompt.includes('Glossary:') && !prompt.includes('```'), 'buildInlineCompletionPrompt');
assert(sanitizeInlineCompletion('```\n打开文件\n```', '打') === '开文件' || sanitizeInlineCompletion('打开文件', '打') === '开文件', 'sanitize strips prefix');
assert(sanitizeInlineCompletion('"hello"', '') === 'hello', 'sanitize quotes');

let mtLocked = {
    chatGpt: { apiKey: 'mt-key', enabled: true, model: 'gpt-4o', fixTags: false },
    inlineSuggest: defaultInlineSuggest()
};
assert(resolveInlineCompletionClient(mtLocked as any) === null, 'no fallback to enabled MT engine');

let independent = {
    chatGpt: { apiKey: 'mt-key', enabled: true, model: 'gpt-4o', fixTags: false },
    inlineSuggest: normalizeInlineSuggest({
        aiEnabled: true,
        provider: 'chatGpt',
        model: 'gpt-4o-mini',
        reuseProviderCredentials: true
    })
};
let resolved = resolveInlineCompletionClient(independent as any);
assert(resolved !== null && resolved.model === 'gpt-4o-mini' && resolved.config.apiKey === 'mt-key', 'independent model reuses MT key only');
assert(resolved !== null && resolved.config.model === 'gpt-4o-mini', 'resolved config uses completion model not MT model');

let dedicated = {
    chatGpt: { apiKey: 'mt-key', enabled: true, model: 'gpt-4o', fixTags: false },
    ollama: { url: 'http://localhost:11434', enabled: false, model: 'ignored', fixTags: false, think: false },
    inlineSuggest: normalizeInlineSuggest({
        aiEnabled: true,
        provider: 'ollama',
        model: 'qwen2.5:7b',
        reuseProviderCredentials: false,
        baseUrl: 'http://127.0.0.1:11434'
    })
};
let ollamaResolved = resolveInlineCompletionClient(dedicated as any);
assert(ollamaResolved !== null && ollamaResolved.provider === 'ollama' && ollamaResolved.model === 'qwen2.5:7b', 'dedicated ollama not locked to MT');
assert(ollamaResolved !== null && ollamaResolved.config.baseUrl === 'http://127.0.0.1:11434', 'dedicated baseUrl wins');

assert(shouldRequestAi(ranked.ghost, independent.inlineSuggest) === false, 'skip AI when high-confidence TM ghost');
assert(shouldRequestAi(null, independent.inlineSuggest) === true, 'request AI when configured and no local ghost');
assert(shouldRequestAi(null, defaultInlineSuggest()) === false, 'no AI when default aiEnabled false');

setAppLang('zh');
assert(t('selectMtEngines') === '选择翻译引擎', 'zh selectMtEngines');
assert(t('noMtEngineSelected').length > 0, 'zh noMtEngineSelected');
setAppLang('en');
assert(t('selectMtEngines') === 'Select translation engines', 'en selectMtEngines');
assert(t('mtEnginePicker') === 'Engines for this request', 'en mtEnginePicker');

let enginePrefs = {
    google: { enabled: true },
    azure: { enabled: false },
    deepl: { enabled: true },
    chatGpt: { enabled: true },
    anthropic: { enabled: false },
    mistral: { enabled: false },
    gemini: { enabled: false },
    qwen: { enabled: false },
    ollama: { enabled: false },
    modernmt: { enabled: false },
    customAi: { ...defaultCustomAi(), enabled: true, name: 'My LLM' }
};
assert(listEnabledEngineIds(enginePrefs).join(',') === 'google,deepl,chatGpt,customAi', 'listEnabledEngineIds');
assert(normalizeSelectedEngines(enginePrefs, []).join(',') === 'google,deepl,chatGpt,customAi', 'empty selection falls back to enabled');
assert(normalizeSelectedEngines(enginePrefs, ['chatGpt', 'azure', 'unknown']).join(',') === 'chatGpt', 'drop disabled and unknown ids');
assert(engineShortName('google') === 'Google', 'google short name');
assert(engineShortName('customAi', enginePrefs) === 'My LLM', 'custom short name');
assert(preferredMtOrigin(enginePrefs, ['deepl', 'chatGpt']) === 'DeepL', 'preferred origin first selected');
let reconciled = reconcileSelectedEngines(enginePrefs, ['chatGpt'], ['chatGpt']);
assert(reconciled.includes('chatGpt') && reconciled.includes('google') && reconciled.includes('deepl') && reconciled.includes('customAi'), 'reconcile keeps old and adds new');

console.log('unit checks passed');
