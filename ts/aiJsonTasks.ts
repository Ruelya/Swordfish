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

export interface TextPair {
    source: string;
    target: string;
}

export function stripHtml(html: string): string {
    let text: string = (html || '').replace(/<[^>]+>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    return text.replace(/\s+/g, ' ').trim();
}

export function xmlTarget(text: string): string {
    let escaped: string = (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return '<target>' + escaped + '</target>';
}

export function normalizePairText(text: string): string {
    return stripHtml(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseJsonPayload(raw: string): unknown {
    let text: string = (raw || '').trim();
    if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    let start: number = text.indexOf('[');
    let startObj: number = text.indexOf('{');
    if (start < 0 || (startObj >= 0 && startObj < start)) {
        start = startObj;
    }
    if (start < 0) {
        throw new Error('AI response is not JSON');
    }
    let end: number = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (end <= start) {
        throw new Error('AI response is not JSON');
    }
    return JSON.parse(text.substring(start, end + 1));
}

export function asTextPairs(data: unknown): TextPair[] {
    let list: unknown[] = [];
    if (Array.isArray(data)) {
        list = data;
    } else if (data && typeof data === 'object') {
        let record: Record<string, unknown> = data as Record<string, unknown>;
        if (Array.isArray(record.pairs)) {
            list = record.pairs;
        } else if (Array.isArray(record.terms)) {
            list = record.terms;
        } else if (Array.isArray(record.items)) {
            list = record.items;
        }
    }
    let pairs: TextPair[] = [];
    for (let item of list) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        let record: Record<string, unknown> = item as Record<string, unknown>;
        let source: string = String(record.source ?? record.src ?? record.sourceTerm ?? '').trim();
        let target: string = String(record.target ?? record.tgt ?? record.targetTerm ?? '').trim();
        if (source && target) {
            pairs.push({ source: source, target: target });
        }
    }
    return pairs;
}

export function pairByBasename(sources: string[], targets: string[]): { source: string, target: string }[] {
    let map: Map<string, string> = new Map();
    for (let target of targets) {
        map.set(basenameKey(target), target);
    }
    let pairs: { source: string, target: string }[] = [];
    for (let source of sources) {
        let target: string | undefined = map.get(basenameKey(source));
        if (target) {
            pairs.push({ source: source, target: target });
        }
    }
    return pairs;
}

export function basenameKey(path: string): string {
    let name: string = path.split(/[\\/]/).pop() || path;
    let dot: number = name.lastIndexOf('.');
    return (dot > 0 ? name.substring(0, dot) : name).toLowerCase();
}

export function safeFileName(name: string): string {
    let cleaned: string = (name || 'project').replace(/[\\/:*?"<>|]/g, '_').trim();
    return cleaned || 'project';
}

export function segmentPlainTarget(segment: { source?: string, target?: string }): string {
    return stripHtml(segment.target || '') || stripHtml(segment.source || '');
}

export function chunkList<T>(items: T[], size: number): T[][] {
    let chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

export function buildAlignPrompt(srcLang: string, tgtLang: string, sources: string[], targets: string[]): string {
    return 'Align these bilingual segments. Return JSON only: [{"source":"...","target":"..."}]. '
        + 'Keep source text unchanged. Skip unmatched sentences. Languages: ' + srcLang + ' -> ' + tgtLang + '.\n\nSOURCE:\n'
        + sources.map((line: string, index: number) => (index + 1) + '. ' + line).join('\n')
        + '\n\nTARGET:\n'
        + targets.map((line: string, index: number) => (index + 1) + '. ' + line).join('\n');
}

export function buildTermsPrompt(srcLang: string, tgtLang: string, pairs: TextPair[]): string {
    return 'Extract bilingual terminology from these aligned segments. Return JSON only: '
        + '[{"source":"term","target":"term"}]. Prefer nouns and domain terms. Languages: '
        + srcLang + ' -> ' + tgtLang + '.\n\n'
        + pairs.map((pair: TextPair) => pair.source + ' <=> ' + pair.target).join('\n');
}

export function applyAlignedTargets(sources: { file: string, unit: string, segment: string, text: string }[], pairs: TextPair[]): Array<{ file: string, unit: string, segment: string, target: string }> {
    let unused: { file: string, unit: string, segment: string, text: string }[] = sources.slice();
    let applied: Array<{ file: string, unit: string, segment: string, target: string }> = [];
    for (let pair of pairs) {
        let key: string = normalizePairText(pair.source);
        let index: number = unused.findIndex((item) => normalizePairText(item.text) === key);
        if (index < 0) {
            index = unused.findIndex((item) => normalizePairText(item.text).includes(key) || key.includes(normalizePairText(item.text)));
        }
        if (index < 0) {
            continue;
        }
        let item = unused.splice(index, 1)[0];
        applied.push({ file: item.file, unit: item.unit, segment: item.segment, target: pair.target });
    }
    return applied;
}
