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

import { MTEngine, MTMatch, MTUtils } from "mtengines";
import { XMLElement } from "typesxml";

export type CustomAiFormat = 'openai-chat' | 'openai-completions' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export interface CustomAiConfig {
    enabled: boolean;
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    format: CustomAiFormat;
    requestTemplate: string;
    responsePath: string;
    extraHeaders: string;
    fixTags: boolean;
}

export function defaultCustomAi(): CustomAiConfig {
    return {
        enabled: false,
        name: 'Custom AI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        format: 'openai-chat',
        requestTemplate: '',
        responsePath: 'choices.0.message.content',
        extraHeaders: '',
        fixTags: false
    };
}

export function parseJsonHeaders(raw: string): Record<string, string> {
    if (!raw || raw.trim() === '') {
        return {};
    }
    let parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Extra headers must be a JSON object');
    }
    let headers: Record<string, string> = {};
    for (let [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        headers[key] = String(value);
    }
    return headers;
}

export function extractByPath(data: unknown, path: string): string {
    if (!path || path.trim() === '') {
        throw new Error('Response path is empty');
    }
    let current: unknown = data;
    let parts: string[] = path.split('.').map((part: string) => part.trim()).filter((part: string) => part.length > 0);
    for (let part of parts) {
        if (current === null || current === undefined) {
            throw new Error('Response path not found: ' + path);
        }
        if (Array.isArray(current)) {
            let index: number = Number.parseInt(part, 10);
            if (Number.isNaN(index) || index < 0 || index >= current.length) {
                throw new Error('Response path not found: ' + path);
            }
            current = current[index];
            continue;
        }
        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
            continue;
        }
        throw new Error('Response path not found: ' + path);
    }
    if (typeof current === 'string') {
        return current;
    }
    if (current === null || current === undefined) {
        throw new Error('Empty translation in response');
    }
    return String(current);
}

export function applyTemplate(template: string, values: Record<string, string>): string {
    let result: string = template;
    for (let [key, value] of Object.entries(values)) {
        result = result.split('{{' + key + '}}').join(value);
    }
    return result;
}

export function joinUrl(baseUrl: string, path: string): string {
    let base: string = baseUrl.replace(/\/+$/, '');
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    if (base.endsWith(path) || base.includes('/chat/completions') || base.includes('/messages') || base.includes(':generateContent')) {
        return base;
    }
    return base + (path.startsWith('/') ? path : '/' + path);
}

export function normalizeTranslation(raw: string, wrapTarget: boolean): string {
    let translation: string = (raw ?? '').trim();
    if (translation.startsWith('\n\n')) {
        translation = translation.substring(2);
    }
    while (translation.startsWith('"') && translation.endsWith('"')) {
        translation = translation.substring(1, translation.length - 1);
    }
    if (translation.startsWith('```xml') && translation.endsWith('```')) {
        translation = translation.substring(6, translation.length - 3).trim();
    }
    if (translation.startsWith('```json') && translation.endsWith('```')) {
        translation = translation.substring(7, translation.length - 3).trim();
    }
    if (translation.startsWith('```') && translation.endsWith('```')) {
        translation = translation.substring(3, translation.length - 3).trim();
    }
    if (wrapTarget && !translation.trim().startsWith('<target') && !translation.trim().endsWith('</target>')) {
        translation = '<target>' + translation + '</target>';
    }
    return translation;
}

export class CustomAITranslator implements MTEngine {

    config: CustomAiConfig;
    srcLang: string = '';
    tgtLang: string = '';

    constructor(config: CustomAiConfig) {
        this.config = { ...config };
    }

    getName(): string {
        return this.config.name && this.config.name.trim() !== '' ? this.config.name : 'Custom AI';
    }

    getShortName(): string {
        return this.getName();
    }

    getSourceLanguages(): Promise<string[]> {
        return MTUtils.getLanguages();
    }

    getTargetLanguages(): Promise<string[]> {
        return MTUtils.getLanguages();
    }

    setSourceLanguage(lang: string): void {
        this.srcLang = lang;
    }

    getSourceLanguage(): string {
        return this.srcLang;
    }

    setTargetLanguage(lang: string): void {
        this.tgtLang = lang;
    }

    getTargetLanguage(): string {
        return this.tgtLang;
    }

    handlesTags(): boolean {
        return true;
    }

    fixesMatches(): boolean {
        return true;
    }

    fixesTags(): boolean {
        return true;
    }

    async translate(source: string): Promise<string> {
        let prompt: string = MTUtils.translatePropmt(source, this.srcLang, this.tgtLang);
        let raw: string = await this.callModel(prompt, false);
        return normalizeTranslation(raw, false);
    }

    async getMTMatch(source: XMLElement, terms: { source: string, target: string }[]): Promise<MTMatch> {
        let prompt: string = MTUtils.generatePrompt(source, this.srcLang, this.tgtLang, terms);
        let raw: string = await this.callModel(prompt, true);
        let translation: string = normalizeTranslation(raw, true);
        let target: XMLElement = MTUtils.toXMLElement(translation);
        return new MTMatch(source, target, this.getShortName());
    }

    async fixMatch(originalSource: XMLElement, matchSource: XMLElement, matchTarget: XMLElement): Promise<MTMatch> {
        let prompt: string = MTUtils.fixMatchPrompt(originalSource, matchSource, matchTarget);
        let raw: string = await this.callModel(prompt, true);
        let translation: string = normalizeTranslation(raw, true);
        let target: XMLElement = MTUtils.toXMLElement(translation);
        return new MTMatch(originalSource, target, this.getShortName());
    }

    async fixTags(source: XMLElement, target: XMLElement): Promise<XMLElement> {
        let prompt: string = MTUtils.fixTagsPrompt(source, target, this.srcLang, this.tgtLang);
        let raw: string = await this.callModel(prompt, true);
        let translation: string = normalizeTranslation(raw, true);
        return MTUtils.toXMLElement(translation);
    }

    async testConnection(): Promise<string> {
        if (!this.config.baseUrl || this.config.baseUrl.trim() === '') {
            throw new Error('Base URL is required');
        }
        if (!this.config.model || this.config.model.trim() === '') {
            throw new Error('Model is required');
        }
        this.srcLang = this.srcLang || 'en';
        this.tgtLang = this.tgtLang || 'zh';
        return this.translate('OK');
    }

    async complete(prompt: string, systemPrompt?: string): Promise<string> {
        this.srcLang = this.srcLang || 'en';
        this.tgtLang = this.tgtLang || 'zh';
        return this.callModel(prompt, false, systemPrompt);
    }

    private async callModel(prompt: string, xmlMode: boolean, systemOverride?: string): Promise<string> {
        if (!this.config.model) {
            throw new Error('Model is not set.');
        }
        if (this.srcLang === '' || this.tgtLang === '') {
            throw new Error('Source and Target languages must be set before translation.');
        }
        let system: string = systemOverride || MTUtils.getRole(this.srcLang, this.tgtLang);
        let built = this.buildRequest(prompt, system, xmlMode);
        let response: Response = await fetch(built.url, {
            method: 'POST',
            headers: built.headers,
            body: built.body
        });
        if (!response.ok) {
            let detail: string = '';
            try {
                detail = await response.text();
            } catch (_error) {
                detail = response.statusText;
            }
            throw new Error('HTTP error! status: ' + response.status + (detail ? ' ' + detail.substring(0, 400) : ''));
        }
        let data: unknown = await response.json();
        return extractByPath(data, built.responsePath);
    }

    private buildRequest(prompt: string, system: string, _xmlMode: boolean): { url: string, headers: Record<string, string>, body: string, responsePath: string } {
        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...parseJsonHeaders(this.config.extraHeaders)
        };
        let format: CustomAiFormat = this.config.format || 'openai-chat';
        let baseUrl: string = this.config.baseUrl.trim();
        if (format === 'custom') {
            if (!this.config.requestTemplate || this.config.requestTemplate.trim() === '') {
                throw new Error('Request template is required for custom format');
            }
            if (!this.config.responsePath || this.config.responsePath.trim() === '') {
                throw new Error('Response path is required for custom format');
            }
            let escapedPrompt: string = JSON.stringify(prompt).slice(1, -1);
            let escapedSystem: string = JSON.stringify(system).slice(1, -1);
            let body: string = applyTemplate(this.config.requestTemplate, {
                model: this.config.model,
                apiKey: this.config.apiKey,
                source: escapedPrompt,
                srcLang: this.srcLang,
                tgtLang: this.tgtLang,
                prompt: escapedPrompt,
                system: escapedSystem
            });
            JSON.parse(body);
            if (this.config.apiKey && !headers['Authorization'] && !headers['authorization'] && !headers['x-api-key']) {
                headers['Authorization'] = 'Bearer ' + this.config.apiKey;
            }
            return {
                url: baseUrl,
                headers: headers,
                body: body,
                responsePath: this.config.responsePath
            };
        }
        if (format === 'anthropic') {
            if (!headers['x-api-key'] && this.config.apiKey) {
                headers['x-api-key'] = this.config.apiKey;
            }
            if (!headers['anthropic-version']) {
                headers['anthropic-version'] = '2023-06-01';
            }
            return {
                url: joinUrl(baseUrl, '/messages'),
                headers: headers,
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: 4096,
                    system: system,
                    messages: [{ role: 'user', content: prompt }]
                }),
                responsePath: this.config.responsePath || 'content.0.text'
            };
        }
        if (format === 'gemini') {
            let url: string = baseUrl;
            if (!url.includes(':generateContent')) {
                url = joinUrl(baseUrl, '/models/' + encodeURIComponent(this.config.model) + ':generateContent');
            }
            if (this.config.apiKey && !url.includes('key=')) {
                url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(this.config.apiKey);
            }
            return {
                url: url,
                headers: headers,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: system + '\n\n' + prompt }] }]
                }),
                responsePath: this.config.responsePath || 'candidates.0.content.parts.0.text'
            };
        }
        if (format === 'ollama') {
            return {
                url: joinUrl(baseUrl, '/api/chat'),
                headers: headers,
                body: JSON.stringify({
                    model: this.config.model,
                    stream: false,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt }
                    ]
                }),
                responsePath: this.config.responsePath || 'message.content'
            };
        }
        if (format === 'openai-completions') {
            if (this.config.apiKey && !headers['Authorization'] && !headers['authorization']) {
                headers['Authorization'] = 'Bearer ' + this.config.apiKey;
            }
            return {
                url: joinUrl(baseUrl, '/completions'),
                headers: headers,
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: system + '\n\n' + prompt
                }),
                responsePath: this.config.responsePath || 'choices.0.text'
            };
        }
        if (this.config.apiKey && !headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = 'Bearer ' + this.config.apiKey;
        }
        return {
            url: joinUrl(baseUrl, '/chat/completions'),
            headers: headers,
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ]
            }),
            responsePath: this.config.responsePath || 'choices.0.message.content'
        };
    }
}
