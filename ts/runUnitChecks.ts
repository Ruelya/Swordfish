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

import { applyTemplate, extractByPath, joinUrl, normalizeTranslation, parseJsonHeaders } from "./customAITranslator.js";
import { setAppLang, t } from "./i18n.js";

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

console.log('unit checks passed');
