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

export const MT_ENGINE_IDS = [
    'google',
    'azure',
    'deepl',
    'chatGpt',
    'anthropic',
    'mistral',
    'gemini',
    'qwen',
    'ollama',
    'modernmt',
    'customAi'
] as const;

export type MtEngineId = typeof MT_ENGINE_IDS[number];

export const MT_ENGINE_SHORT_NAMES: Record<Exclude<MtEngineId, 'customAi'>, string> = {
    google: 'Google',
    azure: 'Azure',
    deepl: 'DeepL',
    chatGpt: 'ChatGPT',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    gemini: 'Gemini',
    qwen: 'Qwen',
    ollama: 'Ollama',
    modernmt: 'ModernMT'
};

export interface MtEnginePrefs {
    google?: { enabled?: boolean };
    azure?: { enabled?: boolean };
    deepl?: { enabled?: boolean };
    chatGpt?: { enabled?: boolean };
    anthropic?: { enabled?: boolean };
    mistral?: { enabled?: boolean };
    gemini?: { enabled?: boolean };
    qwen?: { enabled?: boolean };
    ollama?: { enabled?: boolean };
    modernmt?: { enabled?: boolean };
    customAi?: { enabled?: boolean; name?: string };
    selectedMtEngines?: string[];
}

export interface MtEngineOption {
    id: MtEngineId;
    label: string;
    enabled: boolean;
}

export function isMtEngineId(value: string): value is MtEngineId {
    return (MT_ENGINE_IDS as readonly string[]).includes(value);
}

export function isEngineEnabled(prefs: MtEnginePrefs, id: MtEngineId): boolean {
    switch (id) {
        case 'google':
            return !!prefs.google?.enabled;
        case 'azure':
            return !!prefs.azure?.enabled;
        case 'deepl':
            return !!prefs.deepl?.enabled;
        case 'chatGpt':
            return !!prefs.chatGpt?.enabled;
        case 'anthropic':
            return !!prefs.anthropic?.enabled;
        case 'mistral':
            return !!prefs.mistral?.enabled;
        case 'gemini':
            return !!prefs.gemini?.enabled;
        case 'qwen':
            return !!prefs.qwen?.enabled;
        case 'ollama':
            return !!prefs.ollama?.enabled;
        case 'modernmt':
            return !!prefs.modernmt?.enabled;
        case 'customAi':
            return !!(prefs.customAi && prefs.customAi.enabled);
        default:
            return false;
    }
}

export function listEnabledEngineIds(prefs: MtEnginePrefs): MtEngineId[] {
    return MT_ENGINE_IDS.filter((id: MtEngineId) => isEngineEnabled(prefs, id));
}

export function normalizeSelectedEngines(prefs: MtEnginePrefs, selected?: string[] | null): MtEngineId[] {
    let enabled: MtEngineId[] = listEnabledEngineIds(prefs);
    if (!selected || selected.length === 0) {
        return enabled;
    }
    let wanted: Set<MtEngineId> = new Set(selected.filter(isMtEngineId));
    return enabled.filter((id: MtEngineId) => wanted.has(id));
}

export function engineShortName(id: MtEngineId, prefs?: MtEnginePrefs): string {
    if (id === 'customAi') {
        let name: string = prefs?.customAi?.name ? prefs.customAi.name.trim() : '';
        return name !== '' ? name : 'Custom AI';
    }
    return MT_ENGINE_SHORT_NAMES[id];
}

export function preferredMtOrigin(prefs: MtEnginePrefs, selected?: string[] | null): string {
    let ids: MtEngineId[] = normalizeSelectedEngines(prefs, selected);
    if (ids.length === 0) {
        return '';
    }
    return engineShortName(ids[0], prefs);
}

export function listEngineOptions(prefs: MtEnginePrefs): MtEngineOption[] {
    return MT_ENGINE_IDS.map((id: MtEngineId) => {
        return {
            id: id,
            label: engineShortName(id, prefs),
            enabled: isEngineEnabled(prefs, id)
        };
    });
}

export function reconcileSelectedEngines(prefs: MtEnginePrefs, previousSelected?: string[] | null, previouslyEnabled?: string[] | null): MtEngineId[] {
    let enabled: MtEngineId[] = listEnabledEngineIds(prefs);
    if (enabled.length === 0) {
        return [];
    }
    let prevEnabled: Set<string> = new Set((previouslyEnabled || []).filter(isMtEngineId));
    let newlyEnabled: MtEngineId[] = enabled.filter((id: MtEngineId) => !prevEnabled.has(id));
    let kept: MtEngineId[] = normalizeSelectedEngines(prefs, previousSelected);
    let result: MtEngineId[] = kept.slice();
    for (let id of newlyEnabled) {
        if (!result.includes(id)) {
            result.push(id);
        }
    }
    return result.length > 0 ? result : enabled;
}
