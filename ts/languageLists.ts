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

import { Language, LanguageUtils } from "typesbcp47";

export interface LanguageOption {
    code: string;
    description: string;
    suppressedScript: string;
}

const BCP47_NAME_LOCALES: string[] = ['en', 'es', 'fr'];

const ZH_LANGUAGE_NAMES: Record<string, string> = {
    'af': '南非荷兰语',
    'ar': '阿拉伯语',
    'be': '白俄罗斯语',
    'bg': '保加利亚语',
    'bn': '孟加拉语',
    'ca': '加泰罗尼亚语',
    'cs': '捷克语',
    'da': '丹麦语',
    'de': '德语',
    'el': '希腊语',
    'en': '英语',
    'en-GB': '英语（英国）',
    'en-US': '英语（美国）',
    'es': '西班牙语',
    'es-419': '西班牙语（拉丁美洲）',
    'es-ES': '西班牙语（西班牙）',
    'et': '爱沙尼亚语',
    'fa': '波斯语',
    'fi': '芬兰语',
    'fr': '法语',
    'fr-CA': '法语（加拿大）',
    'he': '希伯来语',
    'hi': '印地语',
    'hr': '克罗地亚语',
    'hu': '匈牙利语',
    'id': '印度尼西亚语',
    'it': '意大利语',
    'ja': '日语',
    'ko': '韩语',
    'lt': '立陶宛语',
    'lv': '拉脱维亚语',
    'ms': '马来语',
    'nl': '荷兰语',
    'no': '挪威语',
    'pl': '波兰语',
    'pt': '葡萄牙语',
    'pt-BR': '葡萄牙语（巴西）',
    'pt-PT': '葡萄牙语（葡萄牙）',
    'ro': '罗马尼亚语',
    'ru': '俄语',
    'sk': '斯洛伐克语',
    'sl': '斯洛文尼亚语',
    'sv': '瑞典语',
    'th': '泰语',
    'tr': '土耳其语',
    'uk': '乌克兰语',
    'vi': '越南语',
    'zh': '中文',
    'zh-CN': '中文（中国）',
    'zh-Hans': '中文（简体）',
    'zh-Hant': '中文（繁体）',
    'zh-HK': '中文（香港）',
    'zh-TW': '中文（台湾）'
};

export function bcp47NameLocale(appLang?: string): string {
    let lang: string = (appLang || 'en').toLowerCase();
    if (lang === 'es' || lang.startsWith('es-')) {
        return 'es';
    }
    if (lang === 'fr' || lang.startsWith('fr-')) {
        return 'fr';
    }
    if (BCP47_NAME_LOCALES.indexOf(lang) >= 0) {
        return lang;
    }
    return 'en';
}

export function serializeLanguage(language: Language): LanguageOption {
    return {
        code: language.getCode(),
        description: language.getDescription(),
        suppressedScript: language.getSuppressedScript()
    };
}

function localizeLanguage(language: Language, appLang?: string): LanguageOption {
    let option: LanguageOption = serializeLanguage(language);
    if ((appLang || '').toLowerCase().startsWith('zh')) {
        let zhName: string | undefined = ZH_LANGUAGE_NAMES[option.code];
        if (zhName) {
            option.description = zhName;
        }
    }
    return option;
}

export function loadCommonLanguages(appLang?: string): LanguageOption[] {
    let locale: string = bcp47NameLocale(appLang);
    let languages: Language[];
    try {
        languages = LanguageUtils.getCommonLanguages(locale);
    } catch (_error) {
        languages = LanguageUtils.getCommonLanguages('en');
    }
    return languages.map((language: Language) => localizeLanguage(language, appLang));
}

export function describeLanguage(code: string, appLang?: string): Language | undefined {
    let locale: string = bcp47NameLocale(appLang);
    try {
        return LanguageUtils.getLanguage(code, locale);
    } catch (_error) {
        if (locale === 'en') {
            return undefined;
        }
        try {
            return LanguageUtils.getLanguage(code, 'en');
        } catch (_fallbackError) {
            return undefined;
        }
    }
}

export function toLanguageOption(language: Language, appLang?: string): LanguageOption {
    return localizeLanguage(language, appLang);
}

export function describeLanguageOption(code: string, appLang?: string): LanguageOption | undefined {
    let language: Language | undefined = describeLanguage(code, appLang);
    if (!language) {
        return undefined;
    }
    return localizeLanguage(language, appLang);
}
