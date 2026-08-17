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

import { CustomAiConfig, CustomAiFormat, normalizeTranslation } from "./customAITranslator.js";

export interface InlineCredentialSource {
    inlineSuggest?: InlineSuggestPreferences;
    chatGpt?: { apiKey: string };
    anthropic?: { apiKey: string };
    mistral?: { apiKey: string };
    gemini?: { apiKey: string };
    qwen?: { apiKey: string; region: string };
    ollama?: { url: string };
    customAi?: {
        apiKey: string;
        baseUrl: string;
        format: string;
        requestTemplate: string;
        responsePath: string;
        extraHeaders: string;
    };
}

export type InlineSuggestProvider = 'none' | 'chatGpt' | 'anthropic' | 'mistral' | 'gemini' | 'qwen' | 'ollama' | 'custom';

export interface InlineSuggestPreferences {
    enabled: boolean;
    aiEnabled: boolean;
    debounceMs: number;
    provider: InlineSuggestProvider;
    model: string;
    apiKey: string;
    baseUrl: string;
    format: CustomAiFormat;
    requestTemplate: string;
    responsePath: string;
    extraHeaders: string;
    reuseProviderCredentials: boolean;
}

export interface CompletionItem {
    kind: 'term' | 'tm';
    label: string;
    insertText: string;
    origin: string;
    score: number;
}

export interface InlineSuggestion {
    text: string;
    origin: string;
    confidence: 'high' | 'low';
}

export interface LocalRankInputTerm {
    source: string;
    target: string;
    origin?: string;
}

export interface LocalRankInputMatch {
    source: string;
    target: string;
    similarity: number;
    origin?: string;
}

export interface CompletionContext {
    srcLang: string;
    tgtLang: string;
    source: string;
    prefix: string;
    suffix: string;
    terms: LocalRankInputTerm[];
    tmMatches: LocalRankInputMatch[];
    previous?: { source: string; target: string };
    next?: { source: string; target: string };
}

export interface ResolvedInlineClient {
    provider: InlineSuggestProvider;
    model: string;
    config: CustomAiConfig;
}

export interface BorrowedCredentials {
    apiKey: string;
    baseUrl: string;
    format: CustomAiFormat;
    requestTemplate: string;
    responsePath: string;
    extraHeaders: string;
}

const PROVIDERS: InlineSuggestProvider[] = ['none', 'chatGpt', 'anthropic', 'mistral', 'gemini', 'qwen', 'ollama', 'custom'];

const PROVIDER_DEFAULTS: Record<Exclude<InlineSuggestProvider, 'none'>, { format: CustomAiFormat; baseUrl: string; responsePath: string; name: string }> = {
    chatGpt: { format: 'openai-chat', baseUrl: 'https://api.openai.com/v1', responsePath: 'choices.0.message.content', name: 'ChatGPT' },
    anthropic: { format: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', responsePath: 'content.0.text', name: 'Claude' },
    mistral: { format: 'openai-chat', baseUrl: 'https://api.mistral.ai/v1', responsePath: 'choices.0.message.content', name: 'Mistral' },
    gemini: { format: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', responsePath: 'candidates.0.content.parts.0.text', name: 'Gemini' },
    qwen: { format: 'openai-chat', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', responsePath: 'choices.0.message.content', name: 'Qwen' },
    ollama: { format: 'ollama', baseUrl: 'http://localhost:11434', responsePath: 'message.content', name: 'Ollama' },
    custom: { format: 'openai-chat', baseUrl: '', responsePath: 'choices.0.message.content', name: 'Custom' }
};

export const INLINE_COMPLETION_SYSTEM: string = 'You complete translations at the cursor. Output only the insertion text.';

export function defaultInlineSuggest(): InlineSuggestPreferences {
    return {
        enabled: true,
        aiEnabled: false,
        debounceMs: 400,
        provider: 'none',
        model: '',
        apiKey: '',
        baseUrl: '',
        format: 'openai-chat',
        requestTemplate: '',
        responsePath: '',
        extraHeaders: '',
        reuseProviderCredentials: true
    };
}

export function isInlineSuggestProvider(value: unknown): value is InlineSuggestProvider {
    return typeof value === 'string' && PROVIDERS.includes(value as InlineSuggestProvider);
}

export function normalizeInlineSuggest(raw: Partial<InlineSuggestPreferences> | undefined | null): InlineSuggestPreferences {
    let defaults: InlineSuggestPreferences = defaultInlineSuggest();
    if (!raw) {
        return defaults;
    }
    let debounceMs: number = typeof raw.debounceMs === 'number' ? raw.debounceMs : defaults.debounceMs;
    if (debounceMs < 100) {
        debounceMs = 100;
    }
    if (debounceMs > 2000) {
        debounceMs = 2000;
    }
    return {
        enabled: raw.enabled !== false,
        aiEnabled: raw.aiEnabled === true,
        debounceMs: debounceMs,
        provider: isInlineSuggestProvider(raw.provider) ? raw.provider : 'none',
        model: typeof raw.model === 'string' ? raw.model : '',
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
        baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
        format: raw.format || 'openai-chat',
        requestTemplate: typeof raw.requestTemplate === 'string' ? raw.requestTemplate : '',
        responsePath: typeof raw.responsePath === 'string' ? raw.responsePath : '',
        extraHeaders: typeof raw.extraHeaders === 'string' ? raw.extraHeaders : '',
        reuseProviderCredentials: raw.reuseProviderCredentials !== false
    };
}

export function plainTextFromHtml(html: string): string {
    if (!html) {
        return '';
    }
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

export function splitAtOffset(text: string, offset: number): { prefix: string; suffix: string } {
    let safe: number = Math.max(0, Math.min(offset, text.length));
    return { prefix: text.slice(0, safe), suffix: text.slice(safe) };
}

export function lastWordPrefix(prefix: string): string {
    let match: RegExpMatchArray | null = prefix.match(/[\p{L}\p{N}'-]+$/u);
    return match ? match[0] : '';
}

export function takeNextWord(text: string): string {
    if (!text) {
        return '';
    }
    let match: RegExpMatchArray | null = text.match(/^\s*\S+\s*/);
    return match ? match[0] : text;
}

export function consumeTypedPrefix(originalPrefix: string, suggestion: string, currentPrefix: string): string | null {
    let full: string = originalPrefix + suggestion;
    if (!currentPrefix.startsWith(originalPrefix)) {
        return null;
    }
    if (!full.startsWith(currentPrefix)) {
        return null;
    }
    return full.substring(currentPrefix.length);
}

export function truncateText(text: string, max: number): string {
    if (!text || text.length <= max) {
        return text || '';
    }
    return text.slice(0, max);
}

export function isCurrentRequest(requestId: number, currentId: number): boolean {
    return requestId === currentId;
}

export function qwenCompatibleBaseUrl(region: string | undefined): string {
    let value: string = (region || '').toLowerCase();
    if (value.includes('china') || value.includes('cn') || value.includes('中国') || value.includes('北京')) {
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    }
    return PROVIDER_DEFAULTS.qwen.baseUrl;
}

export function borrowProviderCredentials(prefs: InlineCredentialSource, provider: InlineSuggestProvider): BorrowedCredentials {
    let empty: BorrowedCredentials = {
        apiKey: '',
        baseUrl: '',
        format: 'openai-chat',
        requestTemplate: '',
        responsePath: '',
        extraHeaders: ''
    };
    if (provider === 'none') {
        return empty;
    }
    if (provider === 'chatGpt') {
        return { ...empty, apiKey: prefs.chatGpt?.apiKey || '', baseUrl: PROVIDER_DEFAULTS.chatGpt.baseUrl, format: 'openai-chat', responsePath: PROVIDER_DEFAULTS.chatGpt.responsePath };
    }
    if (provider === 'anthropic') {
        return { ...empty, apiKey: prefs.anthropic?.apiKey || '', baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl, format: 'anthropic', responsePath: PROVIDER_DEFAULTS.anthropic.responsePath };
    }
    if (provider === 'mistral') {
        return { ...empty, apiKey: prefs.mistral?.apiKey || '', baseUrl: PROVIDER_DEFAULTS.mistral.baseUrl, format: 'openai-chat', responsePath: PROVIDER_DEFAULTS.mistral.responsePath };
    }
    if (provider === 'gemini') {
        return { ...empty, apiKey: prefs.gemini?.apiKey || '', baseUrl: PROVIDER_DEFAULTS.gemini.baseUrl, format: 'gemini', responsePath: PROVIDER_DEFAULTS.gemini.responsePath };
    }
    if (provider === 'qwen') {
        return { ...empty, apiKey: prefs.qwen?.apiKey || '', baseUrl: qwenCompatibleBaseUrl(prefs.qwen?.region), format: 'openai-chat', responsePath: PROVIDER_DEFAULTS.qwen.responsePath };
    }
    if (provider === 'ollama') {
        return { ...empty, apiKey: '', baseUrl: prefs.ollama?.url || PROVIDER_DEFAULTS.ollama.baseUrl, format: 'ollama', responsePath: PROVIDER_DEFAULTS.ollama.responsePath };
    }
    if (provider === 'custom' && prefs.customAi) {
        return {
            apiKey: prefs.customAi.apiKey || '',
            baseUrl: prefs.customAi.baseUrl || '',
            format: (prefs.customAi.format as CustomAiFormat) || 'openai-chat',
            requestTemplate: prefs.customAi.requestTemplate || '',
            responsePath: prefs.customAi.responsePath || '',
            extraHeaders: prefs.customAi.extraHeaders || ''
        };
    }
    return empty;
}

export function resolveInlineCompletionClient(prefs: InlineCredentialSource): ResolvedInlineClient | null {
    let suggest: InlineSuggestPreferences = normalizeInlineSuggest(prefs.inlineSuggest);
    if (!suggest.aiEnabled || suggest.provider === 'none') {
        return null;
    }
    let model: string = suggest.model.trim();
    if (model === '') {
        return null;
    }
    let apiKey: string = suggest.apiKey.trim();
    let baseUrl: string = suggest.baseUrl.trim();
    let format: CustomAiFormat = suggest.format || 'openai-chat';
    let requestTemplate: string = suggest.requestTemplate;
    let responsePath: string = suggest.responsePath;
    let extraHeaders: string = suggest.extraHeaders;
    if (suggest.reuseProviderCredentials) {
        let borrowed: BorrowedCredentials = borrowProviderCredentials(prefs, suggest.provider);
        if (apiKey === '') {
            apiKey = borrowed.apiKey;
        }
        if (baseUrl === '') {
            baseUrl = borrowed.baseUrl;
        }
        if (suggest.provider === 'custom') {
            if (requestTemplate === '') {
                requestTemplate = borrowed.requestTemplate;
            }
            if (responsePath === '') {
                responsePath = borrowed.responsePath;
            }
            if (extraHeaders === '') {
                extraHeaders = borrowed.extraHeaders;
            }
            if (!suggest.format) {
                format = borrowed.format;
            }
        }
    }
    if (suggest.provider !== 'custom') {
        let defaults = PROVIDER_DEFAULTS[suggest.provider];
        format = defaults.format;
        if (baseUrl === '') {
            baseUrl = defaults.baseUrl;
        }
        if (responsePath === '') {
            responsePath = defaults.responsePath;
        }
    }
    if (baseUrl === '') {
        return null;
    }
    if (suggest.provider !== 'ollama' && suggest.provider !== 'custom' && apiKey === '') {
        return null;
    }
    if (suggest.provider === 'custom' && format === 'custom' && (requestTemplate.trim() === '' || responsePath.trim() === '')) {
        return null;
    }
    return {
        provider: suggest.provider,
        model: model,
        config: {
            enabled: true,
            name: 'Inline Completion',
            baseUrl: baseUrl,
            apiKey: apiKey,
            model: model,
            format: format,
            requestTemplate: requestTemplate,
            responsePath: responsePath,
            extraHeaders: extraHeaders,
            fixTags: false
        }
    };
}

export function shouldRequestAi(localGhost: InlineSuggestion | null, inlineSuggest: InlineSuggestPreferences | undefined | null): boolean {
    let suggest: InlineSuggestPreferences = normalizeInlineSuggest(inlineSuggest);
    if (!suggest.aiEnabled || suggest.provider === 'none' || suggest.model.trim() === '') {
        return false;
    }
    if (localGhost && localGhost.confidence === 'high') {
        return false;
    }
    return true;
}

export function rankLocalItems(prefix: string, wordPrefix: string, terms: LocalRankInputTerm[], tmMatches: LocalRankInputMatch[], invokeAll: boolean = false): { items: CompletionItem[]; ghost: InlineSuggestion | null } {
    let items: CompletionItem[] = [];
    let needle: string = wordPrefix.toLowerCase();
    if (needle) {
        for (let term of terms) {
            let target: string = plainTextFromHtml(term.target || '');
            if (target.toLowerCase().startsWith(needle) && target.length > wordPrefix.length) {
                items.push({
                    kind: 'term',
                    label: target,
                    insertText: target.slice(wordPrefix.length),
                    origin: term.origin || 'glossary',
                    score: 90
                });
            }
        }
    } else if (invokeAll) {
        for (let term of terms) {
            let target: string = plainTextFromHtml(term.target || '');
            if (target) {
                items.push({
                    kind: 'term',
                    label: target,
                    insertText: target,
                    origin: term.origin || 'glossary',
                    score: 80
                });
            }
        }
    }
    let ghost: InlineSuggestion | null = null;
    let ghostScore: number = -1;
    for (let match of tmMatches) {
        let target: string = plainTextFromHtml(match.target || '');
        if (!target) {
            continue;
        }
        if (prefix.length > 0 && target.toLowerCase().startsWith(prefix.toLowerCase()) && target.length > prefix.length) {
            let rest: string = target.slice(prefix.length);
            let high: boolean = match.similarity >= 70 && prefix.length >= 2;
            if (match.similarity > ghostScore) {
                ghost = {
                    text: rest,
                    origin: 'TM ' + match.similarity + '%',
                    confidence: high ? 'high' : 'low'
                };
                ghostScore = match.similarity;
            }
            items.push({
                kind: 'tm',
                label: target,
                insertText: rest,
                origin: 'TM ' + match.similarity + '%',
                score: match.similarity
            });
        } else if (invokeAll && prefix.length === 0) {
            items.push({
                kind: 'tm',
                label: target,
                insertText: target,
                origin: 'TM ' + match.similarity + '%',
                score: match.similarity
            });
        }
    }
    items.sort((a: CompletionItem, b: CompletionItem) => b.score - a.score);
    return { items: items.slice(0, 12), ghost: ghost };
}

export function buildInlineCompletionPrompt(ctx: CompletionContext): string {
    let lines: string[] = [];
    lines.push('Complete the translation at the cursor.');
    lines.push('Source language: ' + ctx.srcLang);
    lines.push('Target language: ' + ctx.tgtLang);
    lines.push('Source: ' + truncateText(plainTextFromHtml(ctx.source), 2000));
    lines.push('Target prefix: ' + truncateText(ctx.prefix, 1500));
    lines.push('Target suffix: ' + truncateText(ctx.suffix, 1500));
    if (ctx.terms && ctx.terms.length > 0) {
        let terms: string[] = ctx.terms.slice(0, 20).map((term: LocalRankInputTerm) => {
            return plainTextFromHtml(term.source) + ' => ' + plainTextFromHtml(term.target);
        });
        lines.push('Glossary: ' + terms.join('; '));
    }
    if (ctx.tmMatches && ctx.tmMatches.length > 0) {
        let matches: string[] = ctx.tmMatches.slice(0, 3).map((match: LocalRankInputMatch) => {
            return '[' + match.similarity + '%] ' + truncateText(plainTextFromHtml(match.source), 400) + ' => ' + truncateText(plainTextFromHtml(match.target), 400);
        });
        lines.push('TM matches:');
        for (let match of matches) {
            lines.push(match);
        }
    }
    if (ctx.previous) {
        lines.push('Previous source: ' + truncateText(plainTextFromHtml(ctx.previous.source), 400));
        lines.push('Previous target: ' + truncateText(plainTextFromHtml(ctx.previous.target), 400));
    }
    if (ctx.next) {
        lines.push('Next source: ' + truncateText(plainTextFromHtml(ctx.next.source), 400));
        lines.push('Next target: ' + truncateText(plainTextFromHtml(ctx.next.target), 400));
    }
    lines.push('Output only the text to insert at the cursor. Do not repeat the prefix. No markdown, quotes, or explanation.');
    return lines.join('\n');
}

export function sanitizeInlineCompletion(raw: string, prefix: string): string {
    let text: string = normalizeTranslation(raw || '', false).trim();
    if (prefix && text.startsWith(prefix)) {
        text = text.slice(prefix.length);
    }
    text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
    let para: number = text.indexOf('\n\n');
    if (para >= 0) {
        text = text.slice(0, para);
    }
    if (text.length > 400) {
        text = text.slice(0, 400);
    }
    return text;
}
