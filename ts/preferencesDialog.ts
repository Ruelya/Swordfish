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

import { ipcRenderer, IpcRendererEvent } from "electron";
import { defaultCustomAi } from "./customAITranslator.js";
import { setAppLang, t } from "./i18n.js";
import { InlineSuggestProvider, normalizeInlineSuggest } from "./inlineCompletion.js";
import { listEnabledEngineIds, reconcileSelectedEngines } from "./mtEngineSelection.js";
import { Preferences } from "./preferences.js";
import { Tab, TabHolder } from "./tabs.js";
import { Language } from "typesbcp47";

export class PreferencesDialog {

    static readonly defaultWidth: number = 680;

    tabHolder: TabHolder;
    spellcheckTab: Tab;

    srcLangSelect: HTMLSelectElement = document.createElement('select');
    tgtLangSelect: HTMLSelectElement = document.createElement('select');
    themeColor: HTMLSelectElement = document.createElement('select');
    appLangSelect: HTMLSelectElement = document.createElement('select');
    zoomFactor: HTMLSelectElement = document.createElement('select');
    userNameInput: HTMLInputElement = document.createElement('input');
    matchThreshold: HTMLInputElement = document.createElement('input');

    projectFolder: HTMLInputElement = document.createElement('input');
    memoriesFolder: HTMLInputElement = document.createElement('input');
    glossariesFolder: HTMLInputElement = document.createElement('input');
    defaultSRX: HTMLInputElement = document.createElement('input');
    defaultReviewModel: HTMLInputElement = document.createElement('input');
    defaultCatalog: HTMLInputElement = document.createElement('input');
    paragraphSegmentation: HTMLInputElement = document.createElement('input');
    acceptUnconfirmed: HTMLInputElement = document.createElement('input');
    fuzzyTermSearches: HTMLInputElement = document.createElement('input');
    caseSensitiveTermSearches: HTMLInputElement = document.createElement('input');
    caseSensitiveMatches: HTMLInputElement = document.createElement('input');
    autoConfirm: HTMLInputElement = document.createElement('input');

    enableGoogle: HTMLInputElement = document.createElement('input');
    googleKey: HTMLInputElement = document.createElement('input');
    googleSrcLang: HTMLSelectElement = document.createElement('select');
    googleTgtLang: HTMLSelectElement = document.createElement('select');

    enableAzure: HTMLInputElement = document.createElement('input');
    azureKey: HTMLInputElement = document.createElement('input');
    azureSrcLang: HTMLSelectElement = document.createElement('select');
    azureTgtLang: HTMLSelectElement = document.createElement('select');

    enableDeepL: HTMLInputElement = document.createElement('input');
    deeplKey: HTMLInputElement = document.createElement('input');
    deeplSrcLang: HTMLSelectElement = document.createElement('select');
    deeplTgtLang: HTMLSelectElement = document.createElement('select');

    enableChatGPT: HTMLInputElement = document.createElement('input');
    chatGPTKey: HTMLInputElement = document.createElement('input');
    chatGPTModel: HTMLInputElement = document.createElement('input');
    chatGptFixTags: HTMLInputElement = document.createElement('input');

    enableAnthropic: HTMLInputElement = document.createElement('input');
    anthropicKey: HTMLInputElement = document.createElement('input');
    anthropicModel: HTMLInputElement = document.createElement('input');
    anthropicFixTags: HTMLInputElement = document.createElement('input');

    enableMistral: HTMLInputElement = document.createElement('input');
    mistralKey: HTMLInputElement = document.createElement('input');
    mistralModel: HTMLInputElement = document.createElement('input');
    mistralFixTags: HTMLInputElement = document.createElement('input');

    enableGemini: HTMLInputElement = document.createElement('input');
    geminiKey: HTMLInputElement = document.createElement('input');
    geminiModel: HTMLInputElement = document.createElement('input');
    geminiFixTags: HTMLInputElement = document.createElement('input');

    enableModernmt: HTMLInputElement = document.createElement('input');
    modernmtKey: HTMLInputElement = document.createElement('input');
    modernmtSrcLang: HTMLSelectElement = document.createElement('select');
    modernmtTgtLang: HTMLSelectElement = document.createElement('select');

    enableQwen: HTMLInputElement = document.createElement('input');
    qwenKey: HTMLInputElement = document.createElement('input');
    qwenRegion: HTMLSelectElement = document.createElement('select');
    qwenModel: HTMLInputElement = document.createElement('input');
    qwenFixTags: HTMLInputElement = document.createElement('input');

    enableOllama: HTMLInputElement = document.createElement('input');
    ollamaUrl: HTMLInputElement = document.createElement('input');
    ollamaModel: HTMLInputElement = document.createElement('input');
    ollamaFixTags: HTMLInputElement = document.createElement('input');
    ollamaThink: HTMLInputElement = document.createElement('input');

    enableCustomAi: HTMLInputElement = document.createElement('input');
    customAiName: HTMLInputElement = document.createElement('input');
    customAiBaseUrl: HTMLInputElement = document.createElement('input');
    customAiKey: HTMLInputElement = document.createElement('input');
    customAiModel: HTMLInputElement = document.createElement('input');
    customAiFormat: HTMLSelectElement = document.createElement('select');
    customAiTemplate: HTMLTextAreaElement = document.createElement('textarea');
    customAiResponsePath: HTMLInputElement = document.createElement('input');
    customAiHeaders: HTMLTextAreaElement = document.createElement('textarea');
    customAiFixTags: HTMLInputElement = document.createElement('input');

    enableInlineSuggest: HTMLInputElement = document.createElement('input');
    enableInlineAi: HTMLInputElement = document.createElement('input');
    inlineSuggestDebounce: HTMLInputElement = document.createElement('input');
    inlineSuggestProvider: HTMLSelectElement = document.createElement('select');
    inlineSuggestModel: HTMLInputElement = document.createElement('input');
    inlineSuggestApiKey: HTMLInputElement = document.createElement('input');
    inlineSuggestBaseUrl: HTMLInputElement = document.createElement('input');
    reuseProviderCredentials: HTMLInputElement = document.createElement('input');
    inlineSuggestFormat: HTMLSelectElement = document.createElement('select');
    inlineSuggestTemplate: HTMLTextAreaElement = document.createElement('textarea');
    inlineSuggestResponsePath: HTMLInputElement = document.createElement('input');
    inlineSuggestHeaders: HTMLTextAreaElement = document.createElement('textarea');

    defaultEnglish: HTMLSelectElement = document.createElement('select');
    defaultPortuguese: HTMLSelectElement = document.createElement('select');
    defaultSpanish: HTMLSelectElement = document.createElement('select');

    os: string = '';
    showGuide: boolean = false;

    pageRows: HTMLInputElement = document.createElement('input');

    mtNavRows: Map<string, HTMLDivElement> = new Map();
    mtNavChecks: Map<string, HTMLInputElement> = new Map();
    loadedSelectedMtEngines: string[] = [];
    loadedEnabledEngineIds: string[] = [];

    filtersTable: HTMLTableElement = document.createElement('table');
    selected: Map<string, string>;
    modelSuggestionsLoaded: boolean = false;
    modelSuggestionsLoading: boolean = false;

    constructor() {

        document.body.classList.add("wait");
        setAppLang(ipcRenderer.sendSync('get-app-lang'));
        document.title = t('preferences');
        let saveButton: HTMLButtonElement | null = document.getElementById('save') as HTMLButtonElement | null;
        if (saveButton) {
            saveButton.innerText = t('savePreferences');
        }

        this.tabHolder = new TabHolder(document.getElementById('main') as HTMLDivElement, "preferencesHolder");

        let basicTab: Tab = new Tab('basicTab', t('basic'), false, this.tabHolder);
        basicTab.getLabelDiv().addEventListener('click', () => {
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        this.tabHolder.addTab(basicTab);
        this.populateBasicTab(basicTab.getContainer());

        let mtTab: Tab = new Tab('mtTab', t('machineTranslation'), false, this.tabHolder);
        mtTab.getLabelDiv().addEventListener('click', () => {
            this.requestModelSuggestions();
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        this.tabHolder.addTab(mtTab);
        this.populateMtTab(mtTab.getContainer());

        this.spellcheckTab = new Tab('spellcheckTab', t('spellchecker'), false, this.tabHolder);
        this.spellcheckTab.getLabelDiv().addEventListener('click', () => {
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        this.tabHolder.addTab(this.spellcheckTab);

        let advancedTab: Tab = new Tab('advancedTab', t('advanced'), false, this.tabHolder);
        advancedTab.getLabelDiv().addEventListener('click', () => {
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        this.tabHolder.addTab(advancedTab);
        this.populateAdvancedTab(advancedTab.getContainer());

        this.tabHolder.selectTab('basicTab');

        ipcRenderer.send('get-theme');
        ipcRenderer.on('set-languages', (event: IpcRendererEvent, arg: any) => {
            this.setLanguages(arg);
        });

        ipcRenderer.on('set-mt-languages', (event: IpcRendererEvent, arg: any) => {
            this.setMtLanguages(arg);
        });

        ipcRenderer.on('set-theme', (event: IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
        });
        ipcRenderer.on('start-waiting', () => {
            document.body.classList.add('wait');
        });
        ipcRenderer.on('end-waiting', () => {
            document.body.classList.remove('wait');
        });
        ipcRenderer.on('set-preferences', (event: IpcRendererEvent, preferences: any) => {
            this.setPreferences(preferences);
        });
        ipcRenderer.on('set-ai-models', (event: IpcRendererEvent, models: { ChatGPT?: string[], Claude?: string[], Mistral?: string[], Gemini?: string[] }) => {
            this.applyModelSuggestions(models);
        });
        ipcRenderer.on('ai-models-error', () => {
            this.modelSuggestionsLoading = false;
            this.modelSuggestionsLoaded = false;
        });
        (document.getElementById('browseProjects') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-projects');
        });
        (document.getElementById('browseMemories') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-memories');
        });
        (document.getElementById('browseGlossaries') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-glossaries');
        });
        (document.getElementById('browseSRX') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-srx');
        });
        (document.getElementById('browseReviewModel') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-review-model');
        });
        (document.getElementById('browseCatalog') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('browse-catalog');
        });
        (document.getElementById('save') as HTMLButtonElement).addEventListener('click', () => {
            this.savePreferences();
        });
        ipcRenderer.on('set-srx', (event: IpcRendererEvent, arg: string) => {
            this.defaultSRX.value = arg;
        });
        ipcRenderer.on('set-review-model', (event: IpcRendererEvent, arg: string) => {
            this.defaultReviewModel.value = arg;
        });
        ipcRenderer.on('set-projects-folder', (event: IpcRendererEvent, arg: string) => {
            this.projectFolder.value = arg;
        });
        ipcRenderer.on('set-memories-folder', (event: IpcRendererEvent, arg: string) => {
            this.memoriesFolder.value = arg;
        });
        ipcRenderer.on('set-glossaries-folder', (event: IpcRendererEvent, arg: string) => {
            this.glossariesFolder.value = arg;
        });
        ipcRenderer.on('set-catalog', (event: IpcRendererEvent, arg: string) => {
            this.defaultCatalog.value = arg;
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                ipcRenderer.send('close-preferences');
            }
        });
        this.selected = new Map<string, string>();
        ipcRenderer.send('get-xmlFilters');
        ipcRenderer.on('xmlFilters', (event: IpcRendererEvent, arg: any) => {
            this.setFilters(arg);
        });
        setTimeout(() => {
            ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
        }, 200);
    }

    setPreferences(preferences: Preferences): void {
        this.themeColor.value = preferences.theme;
        this.appLangSelect.value = preferences.appLang === 'en' ? 'en' : 'zh';
        this.srcLangSelect.value = preferences.srcLang;
        this.tgtLangSelect.value = preferences.tgtLang;
        this.zoomFactor.value = preferences.zoomFactor;
        this.userNameInput.value = preferences.userName;
        this.projectFolder.value = preferences.projectsFolder;
        this.memoriesFolder.value = preferences.memoriesFolder;
        this.glossariesFolder.value = preferences.glossariesFolder;
        this.defaultSRX.value = preferences.srx;
        this.defaultReviewModel.value = preferences.reviewModel;
        this.defaultCatalog.value = preferences.catalog;
        this.acceptUnconfirmed.checked = preferences.acceptUnconfirmed;
        this.paragraphSegmentation.checked = preferences.paragraphSegmentation;
        this.fuzzyTermSearches.checked = preferences.fuzzyTermSearches;
        this.caseSensitiveTermSearches.checked = preferences.caseSensitiveSearches;
        this.caseSensitiveMatches.checked = preferences.caseSensitiveMatches;
        this.autoConfirm.checked = preferences.autoConfirm;
        this.matchThreshold.value = preferences.matchThreshold.toString();

        this.enableGoogle.checked = preferences.google.enabled;
        this.googleKey.value = preferences.google.apiKey;
        this.googleSrcLang.value = preferences.google.srcLang;
        this.googleTgtLang.value = preferences.google.tgtLang;
        this.googleKey.disabled = !preferences.google.enabled;
        this.googleSrcLang.disabled = !preferences.google.enabled;
        this.googleTgtLang.disabled = !preferences.google.enabled;
        this.enableGoogle.addEventListener('change', () => {
            this.googleKey.disabled = !this.enableGoogle.checked;
            this.googleSrcLang.disabled = !this.enableGoogle.checked;
            this.googleTgtLang.disabled = !this.enableGoogle.checked;
        });

        this.enableAzure.checked = preferences.azure.enabled;
        this.azureKey.value = preferences.azure.apiKey;
        this.azureSrcLang.value = preferences.azure.srcLang;
        this.azureTgtLang.value = preferences.azure.tgtLang;
        this.azureKey.disabled = !preferences.azure.enabled;
        this.azureSrcLang.disabled = !preferences.azure.enabled;
        this.azureTgtLang.disabled = !preferences.azure.enabled;
        this.enableAzure.addEventListener('change', () => {
            this.azureKey.disabled = !this.enableAzure.checked;
            this.azureSrcLang.disabled = !this.enableAzure.checked;
            this.azureTgtLang.disabled = !this.enableAzure.checked;
        });

        this.enableDeepL.checked = preferences.deepl.enabled;
        this.deeplKey.value = preferences.deepl.apiKey;
        this.deeplSrcLang.value = preferences.deepl.srcLang;
        this.deeplTgtLang.value = preferences.deepl.tgtLang;
        this.deeplKey.disabled = !preferences.deepl.enabled;
        this.deeplSrcLang.disabled = !preferences.deepl.enabled;
        this.deeplTgtLang.disabled = !preferences.deepl.enabled;
        this.enableDeepL.addEventListener('change', () => {
            this.deeplKey.disabled = !this.enableDeepL.checked;
            this.deeplSrcLang.disabled = !this.enableDeepL.checked;
            this.deeplTgtLang.disabled = !this.enableDeepL.checked;
        });

        this.enableChatGPT.checked = preferences.chatGpt.enabled;
        this.chatGPTKey.value = preferences.chatGpt.apiKey;
        this.chatGPTModel.value = preferences.chatGpt.model;
        this.chatGPTKey.disabled = !preferences.chatGpt.enabled;
        this.chatGPTModel.disabled = !preferences.chatGpt.enabled;
        this.chatGptFixTags.checked = preferences.chatGpt.fixTags;
        this.chatGptFixTags.disabled = !preferences.chatGpt.enabled;
        this.enableChatGPT.addEventListener('change', () => {
            this.chatGPTKey.disabled = !this.enableChatGPT.checked;
            this.chatGPTModel.disabled = !this.enableChatGPT.checked;
            this.chatGptFixTags.disabled = !this.enableChatGPT.checked;
        });

        this.enableAnthropic.checked = preferences.anthropic.enabled;
        this.anthropicKey.value = preferences.anthropic.apiKey;
        this.anthropicModel.value = preferences.anthropic.model;
        this.anthropicKey.disabled = !preferences.anthropic.enabled;
        this.anthropicModel.disabled = !preferences.anthropic.enabled;
        this.anthropicFixTags.checked = preferences.anthropic.fixTags;
        this.anthropicFixTags.disabled = !preferences.anthropic.enabled;
        this.enableAnthropic.addEventListener('change', () => {
            this.anthropicKey.disabled = !this.enableAnthropic.checked;
            this.anthropicModel.disabled = !this.enableAnthropic.checked;
            this.anthropicFixTags.disabled = !this.enableAnthropic.checked;
        });

        this.enableMistral.checked = preferences.mistral.enabled;
        this.mistralKey.value = preferences.mistral.apiKey;
        this.mistralModel.value = preferences.mistral.model;
        this.mistralKey.disabled = !preferences.mistral.enabled;
        this.mistralModel.disabled = !preferences.mistral.enabled;
        this.mistralFixTags.checked = preferences.mistral.fixTags;
        this.mistralFixTags.disabled = !preferences.mistral.enabled;
        this.enableMistral.addEventListener('change', () => {
            this.mistralKey.disabled = !this.enableMistral.checked;
            this.mistralModel.disabled = !this.enableMistral.checked;
            this.mistralFixTags.disabled = !this.enableMistral.checked;
        });

        this.enableGemini.checked = preferences.gemini.enabled;
        this.geminiKey.value = preferences.gemini.apiKey;
        this.geminiModel.value = preferences.gemini.model;
        this.geminiKey.disabled = !preferences.gemini.enabled;
        this.geminiModel.disabled = !preferences.gemini.enabled;
        this.geminiFixTags.checked = preferences.gemini.fixTags;
        this.geminiFixTags.disabled = !preferences.gemini.enabled;
        this.enableGemini.addEventListener('change', () => {
            this.geminiKey.disabled = !this.enableGemini.checked;
            this.geminiModel.disabled = !this.enableGemini.checked;
            this.geminiFixTags.disabled = !this.enableGemini.checked;
        });

        this.enableQwen.checked = preferences.qwen.enabled;
        this.qwenKey.value = preferences.qwen.apiKey;
        this.qwenRegion.value = preferences.qwen.region;
        this.qwenModel.value = preferences.qwen.model;
        this.qwenKey.disabled = !preferences.qwen.enabled;
        this.qwenRegion.disabled = !preferences.qwen.enabled;
        this.qwenModel.disabled = !preferences.qwen.enabled;
        this.qwenFixTags.checked = preferences.qwen.fixTags;
        this.qwenFixTags.disabled = !preferences.qwen.enabled;
        this.enableQwen.addEventListener('change', () => {
            this.qwenKey.disabled = !this.enableQwen.checked;
            this.qwenRegion.disabled = !this.enableQwen.checked;
            this.qwenModel.disabled = !this.enableQwen.checked;
            this.qwenFixTags.disabled = !this.enableQwen.checked;
        });

        this.enableOllama.checked = preferences.ollama.enabled;
        this.ollamaUrl.value = preferences.ollama.url;
        this.ollamaModel.value = preferences.ollama.model;
        this.ollamaFixTags.checked = preferences.ollama.fixTags;
        this.ollamaThink.checked = preferences.ollama.think;
        this.ollamaUrl.disabled = !preferences.ollama.enabled;
        this.ollamaModel.disabled = !preferences.ollama.enabled;
        this.ollamaFixTags.disabled = !preferences.ollama.enabled;
        this.ollamaThink.disabled = !preferences.ollama.enabled;
        this.enableOllama.addEventListener('change', () => {
            this.ollamaUrl.disabled = !this.enableOllama.checked;
            this.ollamaModel.disabled = !this.enableOllama.checked;
            this.ollamaFixTags.disabled = !this.enableOllama.checked;
            this.ollamaThink.disabled = !this.enableOllama.checked;
        });

        this.enableModernmt.checked = preferences.modernmt.enabled;
        this.modernmtKey.value = preferences.modernmt.apiKey;
        this.modernmtSrcLang.value = preferences.modernmt.srcLang;
        this.modernmtTgtLang.value = preferences.modernmt.tgtLang;
        this.modernmtKey.disabled = !preferences.modernmt.enabled;
        this.modernmtSrcLang.disabled = !preferences.modernmt.enabled;
        this.modernmtTgtLang.disabled = !preferences.modernmt.enabled;
        this.enableModernmt.addEventListener('change', () => {
            this.modernmtKey.disabled = !this.enableModernmt.checked;
            this.modernmtSrcLang.disabled = !this.enableModernmt.checked;
            this.modernmtTgtLang.disabled = !this.enableModernmt.checked;
        });

        let customAi = preferences.customAi || defaultCustomAi();
        this.enableCustomAi.checked = customAi.enabled;
        this.customAiName.value = customAi.name;
        this.customAiBaseUrl.value = customAi.baseUrl;
        this.customAiKey.value = customAi.apiKey;
        this.customAiModel.value = customAi.model;
        this.customAiFormat.value = customAi.format || 'openai-chat';
        this.customAiTemplate.value = customAi.requestTemplate;
        this.customAiResponsePath.value = customAi.responsePath;
        this.customAiHeaders.value = customAi.extraHeaders;
        this.customAiFixTags.checked = customAi.fixTags;
        this.setCustomAiEnabled(customAi.enabled);
        this.enableCustomAi.addEventListener('change', () => {
            this.setCustomAiEnabled(this.enableCustomAi.checked);
        });

        let inlineSuggest = normalizeInlineSuggest(preferences.inlineSuggest);
        this.enableInlineSuggest.checked = inlineSuggest.enabled;
        this.enableInlineAi.checked = inlineSuggest.aiEnabled;
        this.inlineSuggestDebounce.value = String(inlineSuggest.debounceMs);
        this.inlineSuggestProvider.value = inlineSuggest.provider;
        this.inlineSuggestModel.value = inlineSuggest.model;
        this.inlineSuggestApiKey.value = inlineSuggest.apiKey;
        this.inlineSuggestBaseUrl.value = inlineSuggest.baseUrl;
        this.reuseProviderCredentials.checked = inlineSuggest.reuseProviderCredentials;
        this.inlineSuggestFormat.value = inlineSuggest.format || 'openai-chat';
        this.inlineSuggestTemplate.value = inlineSuggest.requestTemplate;
        this.inlineSuggestResponsePath.value = inlineSuggest.responsePath;
        this.inlineSuggestHeaders.value = inlineSuggest.extraHeaders;
        this.updateInlineSuggestFields();

        this.os = preferences.os;
        this.showGuide = preferences.showGuide;
        this.pageRows.value = preferences.pageRows.toString();
        this.loadedSelectedMtEngines = Array.isArray(preferences.selectedMtEngines) ? preferences.selectedMtEngines.slice() : [];
        this.loadedEnabledEngineIds = listEnabledEngineIds(preferences);
        this.syncMtNavFromEnables();
        this.populateSpellcheckTab(this.spellcheckTab.getContainer(), preferences.spellchecker);

        ipcRenderer.send('preferences-set');
    }

    setLanguages(arg: any): void {
        let languageOptions: string = this.getOptions(arg.languages)

        this.srcLangSelect.innerHTML = languageOptions;
        this.tgtLangSelect.innerHTML = languageOptions;

        ipcRenderer.send('get-preferences');
    }

    savePreferences(): void {
        if (this.matchThreshold.valueAsNumber < 0 || this.matchThreshold.valueAsNumber > 100) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Set a match threshold between 0 and 100', parent: 'preferences' });
            return;
        }
        if (this.pageRows.valueAsNumber < 100 || this.pageRows.valueAsNumber > 2000) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Set a number of rows per page between 100 and 2000', parent: 'preferences' });
            return;
        }
        if (this.enableGoogle.checked && this.googleKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Google API key', parent: 'preferences' });
            return;
        }
        if (this.enableGoogle.checked && (this.googleSrcLang.value === 'none' || this.googleTgtLang.value === 'none')) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select Google languages', parent: 'preferences' });
            return;
        }
        if (this.enableAzure.checked && this.azureKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Azure API key', parent: 'preferences' });
            return;
        }
        if (this.enableAzure.checked && (this.azureSrcLang.value === 'none' || this.azureTgtLang.value === 'none')) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select Azure languages', parent: 'preferences' });
            return;
        }
        if (this.enableDeepL.checked && this.deeplKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter DeepL API key', parent: 'preferences' });
            return;
        }
        if (this.enableDeepL.checked && (this.deeplSrcLang.value === 'none' || this.deeplTgtLang.value === 'none')) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select DeepL languages', parent: 'preferences' });
            return;
        }
        if (this.enableChatGPT.checked && this.chatGPTKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter ChatGPT API key', parent: 'preferences' });
            return;
        }
        if (this.enableQwen.checked && this.qwenKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Qwen API key', parent: 'preferences' });
            return;
        }
        if (this.enableQwen.checked && this.qwenModel.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Qwen model', parent: 'preferences' });
            return;
        }
        if (this.enableMistral.checked && this.mistralKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Mistral API key', parent: 'preferences' });
            return;
        }
        if (this.enableMistral.checked && this.mistralModel.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Mistral model', parent: 'preferences' });
            return;
        }

        if (this.enableAnthropic.checked && this.anthropicModel.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Anthropic model', parent: 'preferences' });
            return;
        }

        if (this.enableGemini.checked && this.geminiKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Gemini API key', parent: 'preferences' });
            return;
        }
        if (this.enableGemini.checked && this.geminiModel.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Gemini model', parent: 'preferences' });
            return;
        }

        if (this.enableOllama.checked && this.ollamaModel.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Ollama model', parent: 'preferences' });
            return;
        }
        if (this.enableOllama.checked && this.ollamaUrl.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter Ollama URL', parent: 'preferences' });
            return;
        }

        if (this.enableModernmt.checked && this.modernmtKey.value === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Enter ModernMT API key', parent: 'preferences' });
            return;
        }
        if (this.enableModernmt.checked && (this.modernmtSrcLang.value === 'none' || this.modernmtTgtLang.value === 'none')) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('selectModernmtLangs'), parent: 'preferences' });
            return;
        }
        if (this.enableCustomAi.checked && this.customAiBaseUrl.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('enterCustomBaseUrl'), parent: 'preferences' });
            return;
        }
        if (this.enableCustomAi.checked && this.customAiModel.value.trim() === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('enterCustomModel'), parent: 'preferences' });
            return;
        }
        if (this.enableCustomAi.checked && this.customAiFormat.value === 'custom') {
            if (this.customAiTemplate.value.trim() === '') {
                ipcRenderer.send('show-message', { type: 'warning', message: t('invalidRequestTemplate'), parent: 'preferences' });
                return;
            }
            try {
                JSON.parse(this.customAiTemplate.value);
            } catch (_error) {
                ipcRenderer.send('show-message', { type: 'warning', message: t('invalidRequestTemplate'), parent: 'preferences' });
                return;
            }
            if (this.customAiResponsePath.value.trim() === '') {
                ipcRenderer.send('show-message', { type: 'warning', message: t('invalidResponsePath'), parent: 'preferences' });
                return;
            }
        }
        if (this.customAiHeaders.value.trim() !== '') {
            try {
                let headers: unknown = JSON.parse(this.customAiHeaders.value);
                if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
                    throw new Error('invalid');
                }
            } catch (_error) {
                ipcRenderer.send('show-message', { type: 'warning', message: t('invalidExtraHeaders'), parent: 'preferences' });
                return;
            }
        }
        if (this.enableInlineAi.checked && (this.inlineSuggestProvider.value === 'none' || this.inlineSuggestModel.value.trim() === '')) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('inlineSuggestNeedModel'), parent: 'preferences' });
            return;
        }
        if (this.enableInlineAi.checked && !this.reuseProviderCredentials.checked) {
            let provider: string = this.inlineSuggestProvider.value;
            if (provider !== 'none' && provider !== 'ollama' && provider !== 'custom' && this.inlineSuggestApiKey.value.trim() === '') {
                ipcRenderer.send('show-message', { type: 'warning', message: t('inlineSuggestNeedKey'), parent: 'preferences' });
                return;
            }
            if ((provider === 'ollama' || provider === 'custom') && this.inlineSuggestBaseUrl.value.trim() === '') {
                ipcRenderer.send('show-message', { type: 'warning', message: t('inlineSuggestNeedUrl'), parent: 'preferences' });
                return;
            }
        }
        if (this.inlineSuggestHeaders.value.trim() !== '') {
            try {
                let headers: unknown = JSON.parse(this.inlineSuggestHeaders.value);
                if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
                    throw new Error('invalid');
                }
            } catch (_error) {
                ipcRenderer.send('show-message', { type: 'warning', message: t('invalidExtraHeaders'), parent: 'preferences' });
                return;
            }
        }

        let prefs: Preferences = {
            srcLang: this.srcLangSelect.value,
            tgtLang: this.tgtLangSelect.value,
            theme: this.themeColor.value,
            appLang: this.appLangSelect.value === 'en' ? 'en' : 'zh',
            zoomFactor: this.zoomFactor.value,
            userName: this.userNameInput.value,
            catalog: this.defaultCatalog.value,
            projectsFolder: this.projectFolder.value,
            memoriesFolder: this.memoriesFolder.value,
            glossariesFolder: this.glossariesFolder.value,
            srx: this.defaultSRX.value,
            reviewModel: this.defaultReviewModel.value,
            paragraphSegmentation: this.paragraphSegmentation.checked,
            acceptUnconfirmed: this.acceptUnconfirmed.checked,
            fuzzyTermSearches: this.fuzzyTermSearches.checked,
            caseSensitiveSearches: this.caseSensitiveTermSearches.checked,
            caseSensitiveMatches: this.caseSensitiveMatches.checked,
            autoConfirm: this.autoConfirm.checked,
            matchThreshold: this.matchThreshold.valueAsNumber,
            google: {
                enabled: this.enableGoogle.checked,
                apiKey: this.googleKey.value,
                srcLang: this.googleSrcLang.value,
                tgtLang: this.googleTgtLang.value
            },
            azure: {
                enabled: this.enableAzure.checked,
                apiKey: this.azureKey.value,
                srcLang: this.azureSrcLang.value,
                tgtLang: this.azureTgtLang.value
            },
            deepl: {
                enabled: this.enableDeepL.checked,
                apiKey: this.deeplKey.value,
                srcLang: this.deeplSrcLang.value,
                tgtLang: this.deeplTgtLang.value
            },
            chatGpt: {
                enabled: this.enableChatGPT.checked,
                apiKey: this.chatGPTKey.value,
                model: this.chatGPTModel.value,
                fixTags: this.chatGptFixTags.checked
            },
            anthropic: {
                enabled: this.enableAnthropic.checked,
                apiKey: this.anthropicKey.value,
                model: this.anthropicModel.value,
                fixTags: this.anthropicFixTags.checked
            },
            mistral: {
                enabled: this.enableMistral.checked,
                apiKey: this.mistralKey.value,
                model: this.mistralModel.value,
                fixTags: this.mistralFixTags.checked
            },
            gemini: {
                enabled: this.enableGemini.checked,
                apiKey: this.geminiKey.value,
                model: this.geminiModel.value,
                fixTags: this.geminiFixTags.checked
            },
            qwen: {
                enabled: this.enableQwen.checked,
                apiKey: this.qwenKey.value,
                region: this.qwenRegion.value,
                model: this.qwenModel.value,
                fixTags: this.qwenFixTags.checked
            },
            ollama: {
                enabled: this.enableOllama.checked,
                url: this.ollamaUrl.value,
                model: this.ollamaModel.value,
                fixTags: this.ollamaFixTags.checked,
                think: this.ollamaThink.checked
            },
            modernmt: {
                enabled: this.enableModernmt.checked,
                apiKey: this.modernmtKey.value,
                srcLang: this.modernmtSrcLang.value,
                tgtLang: this.modernmtTgtLang.value
            },
            customAi: {
                enabled: this.enableCustomAi.checked,
                name: this.customAiName.value.trim() || 'Custom AI',
                baseUrl: this.customAiBaseUrl.value.trim(),
                apiKey: this.customAiKey.value,
                model: this.customAiModel.value.trim(),
                format: this.customAiFormat.value,
                requestTemplate: this.customAiTemplate.value,
                responsePath: this.customAiResponsePath.value.trim(),
                extraHeaders: this.customAiHeaders.value,
                fixTags: this.customAiFixTags.checked
            },
            spellchecker: {
                defaultEnglish: 'en-US',
                defaultPortuguese: 'pt-BR',
                defaultSpanish: 'es'
            },
            os: this.os,
            showGuide: this.showGuide,
            pageRows: this.pageRows.valueAsNumber,
            inlineSuggest: normalizeInlineSuggest({
                enabled: this.enableInlineSuggest.checked,
                aiEnabled: this.enableInlineAi.checked,
                debounceMs: this.inlineSuggestDebounce.valueAsNumber,
                provider: this.inlineSuggestProvider.value as InlineSuggestProvider,
                model: this.inlineSuggestModel.value.trim(),
                apiKey: this.inlineSuggestApiKey.value,
                baseUrl: this.inlineSuggestBaseUrl.value.trim(),
                format: this.inlineSuggestFormat.value as any,
                requestTemplate: this.inlineSuggestTemplate.value,
                responsePath: this.inlineSuggestResponsePath.value.trim(),
                extraHeaders: this.inlineSuggestHeaders.value,
                reuseProviderCredentials: this.reuseProviderCredentials.checked
            }),
            selectedMtEngines: []
        }
        prefs.selectedMtEngines = reconcileSelectedEngines(prefs, this.loadedSelectedMtEngines, this.loadedEnabledEngineIds);
        if (this.os !== 'darwin') {
            prefs.spellchecker = {
                defaultEnglish: this.defaultEnglish.value,
                defaultPortuguese: this.defaultPortuguese.value,
                defaultSpanish: this.defaultSpanish.value
            }
        }
        ipcRenderer.send('save-preferences', prefs);
    }

    populateBasicTab(container: HTMLDivElement): void {
        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let srcLangLabel: HTMLLabelElement = document.createElement('label');
        srcLangLabel.setAttribute('for', 'srcLangSelect');
        srcLangLabel.innerText = t('defaultSourceLanguage');
        td.appendChild(srcLangLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.srcLangSelect = document.createElement('select');
        this.srcLangSelect.classList.add('table_select');
        this.srcLangSelect.id = 'srcLangSelect';
        td.appendChild(this.srcLangSelect);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let tgtLangLabel: HTMLLabelElement = document.createElement('label');
        tgtLangLabel.setAttribute('for', 'tgtLangSelect');
        tgtLangLabel.innerText = t('defaultTargetLanguage');
        td.appendChild(tgtLangLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.tgtLangSelect = document.createElement('select');
        this.tgtLangSelect.classList.add('table_select');
        this.tgtLangSelect.id = 'tgtLangSelect';
        td.appendChild(this.tgtLangSelect);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let matchThresholdLabel: HTMLLabelElement = document.createElement('label');
        matchThresholdLabel.setAttribute('for', 'matchThreshold');
        matchThresholdLabel.innerText = t('matchThreshold');
        td.appendChild(matchThresholdLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        this.matchThreshold = document.createElement('input');
        this.matchThreshold.id = 'matchThreshold';
        this.matchThreshold.type = 'number';
        this.matchThreshold.min = '0';
        this.matchThreshold.max = '100';
        this.matchThreshold.step = '1';
        this.matchThreshold.style.width = '48px';
        td.appendChild(this.matchThreshold);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let themeLabel: HTMLLabelElement = document.createElement('label');
        themeLabel.setAttribute('for', 'themeColor');
        themeLabel.innerText = t('theme');
        td.appendChild(themeLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        tr.appendChild(td);

        this.themeColor = document.createElement('select');
        this.themeColor.id = 'themeColor';
        this.themeColor.innerHTML = '<option value="system">' + t('systemDefault') + '</option>' +
            '<option value="dark">' + t('dark') + '</option>' +
            '<option value="light">' + t('light') + '</option>' +
            '<option value="highcontrast">' + t('highContrast') + '</option>';
        td.appendChild(this.themeColor);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let zoomLabel: HTMLLabelElement = document.createElement('label');
        zoomLabel.setAttribute('for', 'zoomFactor');
        zoomLabel.innerText = t('fontSize');
        td.appendChild(zoomLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        tr.appendChild(td);

        this.zoomFactor = document.createElement('select');
        this.zoomFactor.id = 'zoomFactor';
        this.zoomFactor.innerHTML =
            '<option value="0.8">' + t('small') + '</option>' +
            '<option value="1.0">' + t('medium') + '</option>' +
            '<option value="1.2">' + t('large') + '</option>' +
            '<option value="1.4">' + t('veryLarge') + '</option>' +
            '<option value="1.8">' + t('extraLarge') + '</option>';
        td.appendChild(this.zoomFactor);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let rowsLabel: HTMLLabelElement = document.createElement('label');
        rowsLabel.setAttribute('for', 'pageRows');
        rowsLabel.innerText = t('rowsPerPage');
        td.appendChild(rowsLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        tr.appendChild(td);

        this.pageRows = document.createElement('input');
        this.pageRows.id = 'pageRows';
        this.pageRows.type = 'number';
        this.pageRows.min = '100';
        this.pageRows.max = '2000';
        this.pageRows.step = '100';
        this.pageRows.style.width = this.zoomFactor.clientWidth + 'px';
        td.appendChild(this.pageRows);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let userNameLabel: HTMLLabelElement = document.createElement('label');
        userNameLabel.setAttribute('for', 'userNameInput');
        userNameLabel.innerText = t('defaultUserName');
        td.appendChild(userNameLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        tr.appendChild(td);

        this.userNameInput.id = 'userNameInput';
        td.appendChild(this.userNameInput);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let appLangLabel: HTMLLabelElement = document.createElement('label');
        appLangLabel.setAttribute('for', 'appLangSelect');
        appLangLabel.innerText = t('appLanguage');
        td.appendChild(appLangLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        tr.appendChild(td);

        this.appLangSelect.id = 'appLangSelect';
        this.appLangSelect.innerHTML = '<option value="zh">' + t('chinese') + '</option><option value="en">' + t('english') + '</option>';
        td.appendChild(this.appLangSelect);
    }

    populateSpellcheckTab(container: HTMLDivElement, spellchecker: any): void {
        if (this.os === 'darwin') {
            let macDiv = document.createElement('div');
            macDiv.style.padding = '8px'
            macDiv.innerHTML =
                '<p>By default, macOS automatically detects the language the user is typing in and adjusts its internal spellchecker accordingly.</p>' +
                '<p>Follow these steps to select a specific language for spellchecking: </p>' +
                '<ul><li>Open "System Preferences" application</li>' +
                '<li>Select the "Keyboard" option' +
                '<li>Select the "Text" tab</li>' +
                '<li>Select your preferred language in the "Spelling" drop-down list</li></ul>';
            container.appendChild(macDiv);
            return;
        }

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let englishLabel: HTMLLabelElement = document.createElement('label');
        englishLabel.innerText = 'Default English Variant';
        englishLabel.setAttribute('for', 'defaultEnglish');
        td.appendChild(englishLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultEnglish = document.createElement('select');
        this.defaultEnglish.id = 'defaultEnglish';
        this.defaultEnglish.classList.add('table_select');
        this.defaultEnglish.innerHTML = '<option value="en-AU">English (Australia)</option>' +
            '<option value="en-CA">English (Canada)</option>' +
            '<option value="en-GB">English (United Kingdom)</option>' +
            '<option value="en-US">English (United States)</option>';
        td.appendChild(this.defaultEnglish);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let portugueseLabel: HTMLLabelElement = document.createElement('label');
        portugueseLabel.innerText = 'Default Portuguese Variant';
        portugueseLabel.setAttribute('for', 'defaultPortuguese');
        td.appendChild(portugueseLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultPortuguese = document.createElement('select');
        this.defaultPortuguese.id = 'defaultPortuguese';
        this.defaultPortuguese.classList.add('table_select');
        this.defaultPortuguese.innerHTML = '<option value="pt-BR">Portuguese (Brazil)</option>' +
            '<option value="pt-PT">Portuguese (Portugal)</option>';
        td.appendChild(this.defaultPortuguese);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let spanishLabel: HTMLLabelElement = document.createElement('label');
        spanishLabel.innerText = 'Default Spanish Variant';
        spanishLabel.setAttribute('for', 'defaultSpanish');
        td.appendChild(spanishLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultSpanish = document.createElement('select');
        this.defaultSpanish.id = 'defaultSpanish';
        this.defaultSpanish.classList.add('table_select');
        this.defaultSpanish.innerHTML = '<option value="es">Spanish</option>' +
            '<option value="es-419">Spanish (Latin America and the Caribbean)</option>' +
            '<option value="es-AR">Spanish (Argentina)</option>' +
            '<option value="es-ES">Spanish (Spain)</option>' +
            '<option value="es-MX">Spanish (Mexico)</option>' +
            '<option value="es-US">Spanish (United States)</option>';
        td.appendChild(this.defaultSpanish);

        let languagesButtonArea: HTMLDivElement = document.createElement('div');
        languagesButtonArea.classList.add('buttonArea');
        container.appendChild(languagesButtonArea);

        let languagesButton = document.createElement('button');
        languagesButton.innerText = 'Available Spellchecker Languages';
        languagesButton.addEventListener('click', () => {
            ipcRenderer.send('show-spellchecker-langs');
            languagesButton.blur();
        });
        languagesButtonArea.appendChild(languagesButton);

        this.defaultEnglish.value = spellchecker.defaultEnglish;
        this.defaultPortuguese.value = spellchecker.defaultPortuguese;
        this.defaultSpanish.value = spellchecker.defaultSpanish;
    }

    populateAdvancedTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let div: HTMLDivElement = document.createElement('div');
        div.style.margin = '0px';
        container.appendChild(div);

        let advHolder: TabHolder = new TabHolder(div, 'advHolder');

        let generalTab: Tab = new Tab('generalTab', 'General', false, advHolder);
        generalTab.getLabelDiv().addEventListener('click', () => {
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        advHolder.addTab(generalTab);
        this.populateAdvGeneralTab(generalTab.getContainer());

        let xmlTab: Tab = new Tab('xmlTab', 'XML Filter', false, advHolder);
        xmlTab.getLabelDiv().addEventListener('click', () => {
            setTimeout(() => {
                ipcRenderer.send('set-height', { window: 'preferences', width: PreferencesDialog.defaultWidth, height: document.body.clientHeight });
            }, 200);
        });
        advHolder.addTab(xmlTab);
        this.populateXmlFilterTab(xmlTab.getContainer());
    }

    populateAdvGeneralTab(container: HTMLDivElement): void {
        let table: HTMLTableElement = document.createElement('table');
        table.classList.add('fill_width');
        container.appendChild(table);

        let tr: HTMLTableRowElement = document.createElement('tr');
        table.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let projectsLabel: HTMLLabelElement = document.createElement('label');
        projectsLabel.setAttribute('for', 'projectsFolder');
        projectsLabel.innerText = 'Projects Folder';
        td.appendChild(projectsLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.projectFolder = document.createElement('input');
        this.projectFolder.id = 'projectsFolder';
        this.projectFolder.type = 'text';
        this.projectFolder.classList.add('fill_width');
        td.appendChild(this.projectFolder);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseProjects" class="dark">Browse...</button>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        table.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let memoriesLabel: HTMLLabelElement = document.createElement('label');
        memoriesLabel.setAttribute('for', 'memoriesFolder');
        memoriesLabel.innerText = 'Memories Folder';
        td.appendChild(memoriesLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.memoriesFolder = document.createElement('input');
        this.memoriesFolder.id = 'memoriesFolder';
        this.memoriesFolder.type = 'text';
        this.memoriesFolder.classList.add('fill_width');
        td.appendChild(this.memoriesFolder);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseMemories" class="dark">Browse...</button>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        table.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let glossariesLabel: HTMLLabelElement = document.createElement('label');
        glossariesLabel.setAttribute('for', 'glossariesFolder');
        glossariesLabel.innerText = 'Glossaries Folder';
        td.appendChild(glossariesLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.glossariesFolder = document.createElement('input');
        this.glossariesFolder.id = 'glossariesFolder';
        this.glossariesFolder.type = 'text';
        this.glossariesFolder.classList.add('fill_width');
        td.appendChild(this.glossariesFolder);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseGlossaries" class="dark">Browse...</button>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        table.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let srxLabel: HTMLLabelElement = document.createElement('label');
        srxLabel.setAttribute('for', 'defaultSRX');
        srxLabel.innerText = 'Default SRX File';
        td.appendChild(srxLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultSRX = document.createElement('input');
        this.defaultSRX.id = 'defaultSRX';
        this.defaultSRX.type = 'text';
        this.defaultSRX.classList.add('fill_width');
        td.appendChild(this.defaultSRX);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseSRX" class="dark">Browse...</button>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        table.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let reviewModelLabel: HTMLLabelElement = document.createElement('label');
        reviewModelLabel.setAttribute('for', 'defaultReviewModel');
        reviewModelLabel.innerText = 'Default Review Model';
        td.appendChild(reviewModelLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultReviewModel = document.createElement('input');
        this.defaultReviewModel.id = 'defaultReviewModel';
        this.defaultReviewModel.type = 'text';
        this.defaultReviewModel.classList.add('fill_width');
        td.appendChild(this.defaultReviewModel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseReviewModel" class="dark">Browse...</button>';
        tr.appendChild(td);

        let rowsHolder: HTMLDivElement = document.createElement('div');
        rowsHolder.style.margin = '0px 4px';
        container.appendChild(rowsHolder);

        let row1: HTMLDivElement = document.createElement('div');
        row1.classList.add('row');
        row1.classList.add('middle');
        rowsHolder.appendChild(row1);

        this.paragraphSegmentation = document.createElement('input');
        this.paragraphSegmentation.type = 'checkbox';
        this.paragraphSegmentation.id = 'paragraphSegmentation';
        row1.appendChild(this.paragraphSegmentation);

        let paragraphLabel: HTMLLabelElement = document.createElement('label');
        paragraphLabel.innerText = 'Use Paragraph Segmentation';
        paragraphLabel.setAttribute('for', 'paragraphSegmentation');
        paragraphLabel.style.marginTop = '4px';
        row1.appendChild(paragraphLabel);

        let row2: HTMLDivElement = document.createElement('div');
        row2.classList.add('row');
        row2.classList.add('middle');
        rowsHolder.appendChild(row2);

        this.acceptUnconfirmed = document.createElement('input');
        this.acceptUnconfirmed.type = 'checkbox';
        this.acceptUnconfirmed.id = 'acceptUnconfirmed';
        row2.appendChild(this.acceptUnconfirmed)

        let unconfirmedLabel: HTMLLabelElement = document.createElement('label');
        unconfirmedLabel.innerText = 'Include Unconfirmed Segments when Exporting Translation';
        unconfirmedLabel.setAttribute('for', 'acceptUnconfirmed');
        unconfirmedLabel.style.marginTop = '4px';
        row2.appendChild(unconfirmedLabel);

        let row3: HTMLDivElement = document.createElement('div');
        row3.classList.add('row');
        row3.classList.add('middle');
        rowsHolder.appendChild(row3);

        this.fuzzyTermSearches = document.createElement('input');
        this.fuzzyTermSearches.type = 'checkbox';
        this.fuzzyTermSearches.id = 'fuzzyTermSearches';
        row3.appendChild(this.fuzzyTermSearches);

        let fuzzyTermsLabel: HTMLLabelElement = document.createElement('label');
        fuzzyTermsLabel.innerText = 'Fuzzy Term Searches';
        fuzzyTermsLabel.setAttribute('for', 'fuzzyTermSearches');
        fuzzyTermsLabel.style.marginTop = '4px';
        row3.appendChild(fuzzyTermsLabel);

        let row4: HTMLDivElement = document.createElement('div');
        row4.classList.add('row');
        row4.classList.add('middle');
        rowsHolder.appendChild(row4);

        this.caseSensitiveTermSearches = document.createElement('input');
        this.caseSensitiveTermSearches.type = 'checkbox';
        this.caseSensitiveTermSearches.id = 'caseSensitiveSearches';
        row4.appendChild(this.caseSensitiveTermSearches);

        let caseSensitiveLabel: HTMLLabelElement = document.createElement('label');
        caseSensitiveLabel.innerText = 'Case Sensitive Term Searches';
        caseSensitiveLabel.setAttribute('for', 'caseSensitiveSearches');
        caseSensitiveLabel.style.marginTop = '4px';
        row4.appendChild(caseSensitiveLabel);

        let row5: HTMLDivElement = document.createElement('div');
        row5.classList.add('row');
        row5.classList.add('middle');
        rowsHolder.appendChild(row5);

        this.caseSensitiveMatches = document.createElement('input');
        this.caseSensitiveMatches.type = 'checkbox';
        this.caseSensitiveMatches.id = 'caseSensitiveMatches';
        row5.appendChild(this.caseSensitiveMatches);

        let caseSensitiveMatchesLabel: HTMLLabelElement = document.createElement('label');
        caseSensitiveMatchesLabel.innerText = 'Case Sensitive TM Matches';
        caseSensitiveMatchesLabel.setAttribute('for', 'caseSensitiveMatches');
        caseSensitiveMatchesLabel.style.marginTop = '4px';
        row5.appendChild(caseSensitiveMatchesLabel);

        let row6: HTMLDivElement = document.createElement('div');
        row6.classList.add('row');
        row6.classList.add('middle');
        rowsHolder.appendChild(row6);

        this.autoConfirm = document.createElement('input');
        this.autoConfirm.type = 'checkbox';
        this.autoConfirm.id = 'autoConfirm';
        row6.appendChild(this.autoConfirm);

        let autoConfirmLabel: HTMLLabelElement = document.createElement('label');
        autoConfirmLabel.innerText = 'Automatically Confirm Propagated Segments';
        autoConfirmLabel.setAttribute('for', 'autoConfirm');
        autoConfirmLabel.style.marginTop = '4px';
        row6.appendChild(autoConfirmLabel);
    }

    populateXmlFilterTab(container: HTMLDivElement): void {
        let catalogTable: HTMLTableElement = document.createElement('table');
        catalogTable.classList.add('fill_width');
        container.appendChild(catalogTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        catalogTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        tr.appendChild(td);

        let catalogLabel: HTMLLabelElement = document.createElement('label');
        catalogLabel.setAttribute('for', 'defaultCatalog');
        catalogLabel.innerText = 'Default Catalog';
        td.appendChild(catalogLabel);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        tr.appendChild(td);

        this.defaultCatalog = document.createElement('input');
        this.defaultCatalog.id = 'defaultCatalog';
        this.defaultCatalog.type = 'text';
        this.defaultCatalog.classList.add('fill_width');
        td.appendChild(this.defaultCatalog);

        td = document.createElement('td');
        td.classList.add('middle');
        td.innerHTML = '<button id="browseCatalog" class="dark">Browse...</button>';
        tr.appendChild(td);

        let header: HTMLParagraphElement = document.createElement('p');
        header.innerText = 'XML Filter Configuration Files:';
        header.style.marginLeft = '8px';
        container.appendChild(header);

        let tableDiv: HTMLDivElement = document.createElement('div');
        tableDiv.style.height = '200px';
        tableDiv.style.margin = '8px';
        tableDiv.style.width = 'calc(100% - 18px)';
        tableDiv.classList.add('divContainer');
        tableDiv.classList.add('bordered');
        container.appendChild(tableDiv);

        this.filtersTable = document.createElement('table');
        this.filtersTable.classList.add('stripes');
        this.filtersTable.classList.add('discover');
        tableDiv.appendChild(this.filtersTable);

        let buttonArea: HTMLDivElement = document.createElement('div');
        buttonArea.classList.add('buttonArea');
        container.appendChild(buttonArea);

        let addButton: HTMLButtonElement = document.createElement('button');
        addButton.innerText = 'Add';
        addButton.addEventListener('click', () => {
            this.addFilter();
        });
        buttonArea.appendChild(addButton);

        let editButton: HTMLButtonElement = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.addEventListener('click', () => {
            this.editFilter();
        });
        buttonArea.appendChild(editButton);

        let removeButton: HTMLButtonElement = document.createElement('button');
        removeButton.innerText = 'Remove';
        removeButton.addEventListener('click', () => {
            this.removeFilters();
        });
        buttonArea.appendChild(removeButton);

        let importButton: HTMLButtonElement = document.createElement('button');
        importButton.innerText = 'Import';
        importButton.addEventListener('click', () => {
            ipcRenderer.send('import-xmlFilter');
        });
        buttonArea.appendChild(importButton);

        let exportButton: HTMLButtonElement = document.createElement('button');
        exportButton.innerText = 'Export';
        exportButton.addEventListener('click', () => {
            this.exportFilters();
        });
        buttonArea.appendChild(exportButton);
    }

    populateMtTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let div: HTMLDivElement = document.createElement('div');
        div.style.margin = '0px 4px';
        div.style.paddingLeft = '8px';
        div.style.paddingBottom = '8px';
        container.appendChild(div);

        let hint: HTMLParagraphElement = document.createElement('p');
        hint.classList.add('hint');
        hint.innerText = t('selectMtEnginesHint');
        hint.style.margin = '0px 8px 8px 8px';
        container.appendChild(hint);

        let verticalTabs: HTMLDivElement = document.createElement('div');
        verticalTabs.classList.add('row');
        container.appendChild(verticalTabs);

        let leftSide: HTMLDivElement = document.createElement('div');
        leftSide.classList.add('mtEngineNav');
        leftSide.style.paddingLeft = '8px';
        leftSide.style.paddingBottom = '8px';
        verticalTabs.appendChild(leftSide);

        this.addMtEngineNav(leftSide, 'google', 'Google', 'googleTab');
        this.addMtEngineNav(leftSide, 'azure', 'Microsoft Azure', 'azureTab');
        this.addMtEngineNav(leftSide, 'deepl', 'DeepL', 'deeplTab');
        this.addMtEngineNav(leftSide, 'chatGpt', 'ChatGPT', 'chatGptTab');
        this.addMtEngineNav(leftSide, 'mistral', 'Mistral', 'mistralTab');
        this.addMtEngineNav(leftSide, 'qwen', 'Qwen', 'qwenTab');
        this.addMtEngineNav(leftSide, 'anthropic', 'Claude', 'anthropicTab');
        this.addMtEngineNav(leftSide, 'gemini', 'Gemini', 'geminiTab');
        this.addMtEngineNav(leftSide, 'ollama', 'Ollama', 'ollamaTab');
        this.addMtEngineNav(leftSide, 'modernmt', 'ModernMT', 'modernmtTab');
        this.addMtEngineNav(leftSide, 'customAi', t('customAi'), 'customAiTab');
        this.addMtSettingsNav(leftSide, 'inlineSuggest', t('inlineSuggest'), 'inlineSuggestTab');

        let rightSide: HTMLDivElement = document.createElement('div');
        rightSide.classList.add('fill_width');
        rightSide.style.marginRight = '16px';
        rightSide.style.marginBottom = '8px';
        rightSide.classList.add('borderedArea');

        verticalTabs.appendChild(rightSide);
        let googleTab: HTMLDivElement = document.createElement('div');
        googleTab.id = 'googleTab';
        rightSide.appendChild(googleTab);
        this.populateGoogleTab(googleTab);

        let azureTab: HTMLDivElement = document.createElement('div');
        azureTab.id = 'azureTab';
        azureTab.style.display = 'none';
        rightSide.appendChild(azureTab);
        this.populateAzureTab(azureTab);

        let deeplTab: HTMLDivElement = document.createElement('div');
        deeplTab.id = 'deeplTab';
        deeplTab.style.display = 'none';
        rightSide.appendChild(deeplTab);
        this.populateDeeplTab(deeplTab);

        let chatGptTab: HTMLDivElement = document.createElement('div');
        chatGptTab.id = 'chatGptTab';
        chatGptTab.style.display = 'none';
        rightSide.appendChild(chatGptTab);
        this.populateChatGptTab(chatGptTab);

        let mistralTab: HTMLDivElement = document.createElement('div');
        mistralTab.id = 'mistralTab';
        mistralTab.style.display = 'none';
        rightSide.appendChild(mistralTab);
        this.populateMistralTab(mistralTab);

        let ollamaTab: HTMLDivElement = document.createElement('div');
        ollamaTab.id = 'ollamaTab';
        ollamaTab.style.display = 'none';
        rightSide.appendChild(ollamaTab);
        this.populateOllamaTab(ollamaTab);

        let qwenTab: HTMLDivElement = document.createElement('div');
        qwenTab.id = 'qwenTab';
        qwenTab.style.display = 'none';
        rightSide.appendChild(qwenTab);
        this.populateqwenTab(qwenTab);

        let anthropicTab: HTMLDivElement = document.createElement('div');
        anthropicTab.id = 'anthropicTab';
        anthropicTab.style.display = 'none';
        rightSide.appendChild(anthropicTab);
        this.populateAnthropicTab(anthropicTab);

        let geminiTab: HTMLDivElement = document.createElement('div');
        geminiTab.id = 'geminiTab';
        geminiTab.style.display = 'none';
        rightSide.appendChild(geminiTab);
        this.populateGeminiTab(geminiTab);

        let modernmtTab: HTMLDivElement = document.createElement('div');
        modernmtTab.id = 'modernmtTab';
        modernmtTab.style.display = 'none';
        rightSide.appendChild(modernmtTab);
        this.populateModernmtTab(modernmtTab);

        let customAiTab: HTMLDivElement = document.createElement('div');
        customAiTab.id = 'customAiTab';
        customAiTab.style.display = 'none';
        rightSide.appendChild(customAiTab);
        this.populateCustomAiTab(customAiTab);

        let inlineSuggestTab: HTMLDivElement = document.createElement('div');
        inlineSuggestTab.id = 'inlineSuggestTab';
        inlineSuggestTab.style.display = 'none';
        rightSide.appendChild(inlineSuggestTab);
        this.populateInlineSuggestTab(inlineSuggestTab);

        this.bindMtNavEnable('google', this.enableGoogle);
        this.bindMtNavEnable('azure', this.enableAzure);
        this.bindMtNavEnable('deepl', this.enableDeepL);
        this.bindMtNavEnable('chatGpt', this.enableChatGPT);
        this.bindMtNavEnable('mistral', this.enableMistral);
        this.bindMtNavEnable('qwen', this.enableQwen);
        this.bindMtNavEnable('anthropic', this.enableAnthropic);
        this.bindMtNavEnable('gemini', this.enableGemini);
        this.bindMtNavEnable('ollama', this.enableOllama);
        this.bindMtNavEnable('modernmt', this.enableModernmt);
        this.bindMtNavEnable('customAi', this.enableCustomAi);
        this.selectMtProviderTab('googleTab');
    }

    addMtEngineNav(parent: HTMLDivElement, id: string, label: string, tabId: string): void {
        let row: HTMLDivElement = document.createElement('div');
        row.classList.add('row');
        row.classList.add('middle');
        row.classList.add('mtEngineRow');
        row.dataset.tabId = tabId;

        let check: HTMLInputElement = document.createElement('input');
        check.type = 'checkbox';
        check.id = 'navEnable-' + id;
        check.style.margin = '4px';
        row.appendChild(check);

        let lab: HTMLLabelElement = document.createElement('label');
        lab.setAttribute('for', 'navEnable-' + id);
        lab.innerText = label;
        lab.style.marginTop = '4px';
        lab.style.whiteSpace = 'nowrap';
        row.appendChild(lab);

        row.addEventListener('click', () => {
            this.selectMtProviderTab(tabId);
        });
        parent.appendChild(row);
        this.mtNavRows.set(id, row);
        this.mtNavChecks.set(id, check);
    }

    addMtSettingsNav(parent: HTMLDivElement, id: string, label: string, tabId: string): void {
        let row: HTMLDivElement = document.createElement('div');
        row.classList.add('row');
        row.classList.add('middle');
        row.classList.add('mtEngineRow');
        row.dataset.tabId = tabId;

        let lab: HTMLLabelElement = document.createElement('label');
        lab.innerText = label;
        lab.style.margin = '4px';
        lab.style.marginTop = '4px';
        lab.style.whiteSpace = 'nowrap';
        row.appendChild(lab);

        row.addEventListener('click', () => {
            this.selectMtProviderTab(tabId);
        });
        parent.appendChild(row);
        this.mtNavRows.set(id, row);
    }

    bindMtNavEnable(id: string, enableInput: HTMLInputElement): void {
        let check: HTMLInputElement | undefined = this.mtNavChecks.get(id);
        if (!check) {
            return;
        }
        check.addEventListener('change', () => {
            if (enableInput.checked !== check.checked) {
                enableInput.checked = check.checked;
                enableInput.dispatchEvent(new Event('change'));
            }
            this.updateMtNavRow(id);
        });
        enableInput.addEventListener('change', () => {
            check.checked = enableInput.checked;
            this.updateMtNavRow(id);
        });
    }

    syncMtNavFromEnables(): void {
        let mapping: Array<[string, HTMLInputElement]> = [
            ['google', this.enableGoogle],
            ['azure', this.enableAzure],
            ['deepl', this.enableDeepL],
            ['chatGpt', this.enableChatGPT],
            ['mistral', this.enableMistral],
            ['qwen', this.enableQwen],
            ['anthropic', this.enableAnthropic],
            ['gemini', this.enableGemini],
            ['ollama', this.enableOllama],
            ['modernmt', this.enableModernmt],
            ['customAi', this.enableCustomAi]
        ];
        for (let [id, input] of mapping) {
            let check: HTMLInputElement | undefined = this.mtNavChecks.get(id);
            if (check) {
                check.checked = input.checked;
            }
            this.updateMtNavRow(id);
        }
    }

    updateMtNavRow(id: string): void {
        let row: HTMLDivElement | undefined = this.mtNavRows.get(id);
        let check: HTMLInputElement | undefined = this.mtNavChecks.get(id);
        if (!row) {
            return;
        }
        if (check && check.checked) {
            row.classList.add('mtEngineRowEnabled');
        } else {
            row.classList.remove('mtEngineRowEnabled');
        }
    }

    selectMtProviderTab(tabId: string): void {
        this.toggleTab(tabId);
        this.mtNavRows.forEach((row: HTMLDivElement) => {
            if (row.dataset.tabId === tabId) {
                row.classList.add('mtEngineRowActive');
            } else {
                row.classList.remove('mtEngineRowActive');
            }
        });
    }

    toggleTab(tabId: string): void {
        const tabs: string[] = ['googleTab', 'azureTab', 'deeplTab',
            'chatGptTab', 'mistralTab', 'qwenTab', 'ollamaTab', 'anthropicTab', 'geminiTab', 'modernmtTab', 'customAiTab', 'inlineSuggestTab'];
        tabs.forEach((id) => {
            const tab = document.getElementById(id);
            if (tab) {
                if (id === tabId) {
                    tab.style.display = 'block';
                } else {
                    tab.style.display = 'none';
                }
            }
        });
    }

    populateGoogleTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let googlelDiv: HTMLDivElement = document.createElement('div');
        googlelDiv.classList.add('middle');
        googlelDiv.classList.add('row');
        googlelDiv.style.paddingLeft = '4px';
        googlelDiv.innerHTML = '<input type="checkbox" id="enableGoogle"><label for="enableGoogle" style="padding-top:4px;">Enable Google Cloud Translation</label>';
        container.appendChild(googlelDiv);

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="googleKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="googleKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="googleSrcLang">Source Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="googleSrcLang" class="table_select"></select>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="googleTgtLang">Target Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="googleTgtLang" class="table_select"></select>';
        tr.appendChild(td);

        this.enableGoogle = document.getElementById('enableGoogle') as HTMLInputElement;
        this.googleKey = document.getElementById('googleKey') as HTMLInputElement;
        this.googleSrcLang = document.getElementById('googleSrcLang') as HTMLSelectElement;
        this.googleTgtLang = document.getElementById('googleTgtLang') as HTMLSelectElement;
    }

    populateAzureTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let azureDiv: HTMLDivElement = document.createElement('div');
        azureDiv.classList.add('middle');
        azureDiv.classList.add('row');
        azureDiv.style.paddingLeft = '4px';
        azureDiv.innerHTML = '<input type="checkbox" id="enableAzure"><label for="enableAzure" style="padding-top:4px;">Enable Azure Translator Text API</label>';
        container.appendChild(azureDiv);

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="azureKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="azureKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="azureSrcLang">Source Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="azureSrcLang" class="table_select"></select>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="azureTgtLang">Target Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="azureTgtLang" class="table_select"></select>';
        tr.appendChild(td);

        this.enableAzure = document.getElementById('enableAzure') as HTMLInputElement;
        this.azureKey = document.getElementById('azureKey') as HTMLInputElement;
        this.azureSrcLang = document.getElementById('azureSrcLang') as HTMLSelectElement;
        this.azureTgtLang = document.getElementById('azureTgtLang') as HTMLSelectElement;
    }

    populateDeeplTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let deeplDiv: HTMLDivElement = document.createElement('div');
        deeplDiv.classList.add('middle');
        deeplDiv.classList.add('row');
        deeplDiv.style.paddingLeft = '4px';
        deeplDiv.innerHTML = '<input type="checkbox" id="enableDeepL"><label for="enableDeepL" style="padding-top:4px;">Enable DeepL API</label>';
        container.appendChild(deeplDiv);

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="deeplKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="deeplKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="deeplSrcLang">Source Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="deeplSrcLang" class="table_select"></select>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="deeplTgtLang">Target Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="deeplTgtLang" class="table_select"></select>';
        tr.appendChild(td);

        this.enableDeepL = document.getElementById('enableDeepL') as HTMLInputElement;
        this.deeplKey = document.getElementById('deeplKey') as HTMLInputElement;
        this.deeplSrcLang = document.getElementById('deeplSrcLang') as HTMLSelectElement;
        this.deeplTgtLang = document.getElementById('deeplTgtLang') as HTMLSelectElement;
    }

    populateChatGptTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let chatGptDiv: HTMLDivElement = document.createElement('div');
        chatGptDiv.classList.add('middle');
        chatGptDiv.classList.add('row');
        chatGptDiv.style.paddingLeft = '4px';
        chatGptDiv.innerHTML = '<input type="checkbox" id="enableChatGPT"><label for="enableChatGPT" style="padding-top:4px;">Enable ChatGPT Translation</label>';
        container.appendChild(chatGptDiv);

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="chatGPTKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="chatGPTKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="chatGPTModel">ChatGPT Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let chatGptModelInput: HTMLInputElement = document.createElement('input');
        chatGptModelInput.type = 'text';
        chatGptModelInput.id = 'chatGPTModel';
        chatGptModelInput.classList.add('table_input');
        chatGptModelInput.setAttribute('list', 'chatGptModelsList');
        td.appendChild(chatGptModelInput);
        tr.appendChild(td);

        let chatGptDatalist: HTMLDataListElement = document.createElement('datalist');
        chatGptDatalist.id = 'chatGptModelsList';
        container.appendChild(chatGptDatalist);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.chatGptFixTags.id = 'chatGptFixTags';
        this.chatGptFixTags.type = 'checkbox';
        this.chatGptFixTags.addEventListener('change', () => {
            if (this.chatGptFixTags.checked) {
                this.anthropicFixTags.checked = false;
                this.mistralFixTags.checked = false;
                this.geminiFixTags.checked = false;
                this.qwenFixTags.checked = false;
            }
        });
        tagsRow.appendChild(this.chatGptFixTags);

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'chatGptFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableChatGPT = document.getElementById('enableChatGPT') as HTMLInputElement;
        this.chatGPTKey = document.getElementById('chatGPTKey') as HTMLInputElement;
        this.chatGPTModel = document.getElementById('chatGPTModel') as HTMLInputElement;
    }

    populateMistralTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let mistralDiv: HTMLDivElement = document.createElement('div');
        mistralDiv.classList.add('middle');
        mistralDiv.classList.add('row');
        mistralDiv.style.paddingLeft = '4px';
        mistralDiv.innerHTML = '<input type="checkbox" id="enableMistral"><label for="enableMistral" style="padding-top:4px;">Enable Mistral Translation</label>';
        container.appendChild(mistralDiv);

        let infoTable: HTMLTableElement = document.createElement('table');
        infoTable.classList.add('fill_width');
        container.appendChild(infoTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        infoTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="mistralKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="mistralKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        infoTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="mistralModel">Mistral Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let mistralModelInput: HTMLInputElement = document.createElement('input');
        mistralModelInput.type = 'text';
        mistralModelInput.id = 'mistralModel';
        mistralModelInput.classList.add('table_input');
        mistralModelInput.setAttribute('list', 'mistralModelsList');
        td.appendChild(mistralModelInput);
        tr.appendChild(td);

        let mistralDatalist: HTMLDataListElement = document.createElement('datalist');
        mistralDatalist.id = 'mistralModelsList';
        container.appendChild(mistralDatalist);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.mistralFixTags.id = 'mistralFixTags';
        this.mistralFixTags.type = 'checkbox';
        this.mistralFixTags.addEventListener('change', () => {
            if (this.mistralFixTags.checked) {
                this.chatGptFixTags.checked = false;
                this.anthropicFixTags.checked = false;
                this.geminiFixTags.checked = false;
                this.qwenFixTags.checked = false;
            }
        });
        tagsRow.appendChild(this.mistralFixTags);

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'mistralFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableMistral = document.getElementById('enableMistral') as HTMLInputElement;
        this.mistralKey = document.getElementById('mistralKey') as HTMLInputElement;
        this.mistralModel = document.getElementById('mistralModel') as HTMLInputElement;
    }

    populateqwenTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let QwenDiv: HTMLDivElement = document.createElement('div');
        QwenDiv.classList.add('middle');
        QwenDiv.classList.add('row');
        QwenDiv.style.paddingLeft = '4px';
        QwenDiv.innerHTML = '<input type="checkbox" id="enableQwen"><label for="enableQwen" style="padding-top:4px;">Enable Qwen Translation</label>';
        container.appendChild(QwenDiv);

        let infoTable: HTMLTableElement = document.createElement('table');
        infoTable.classList.add('fill_width');
        container.appendChild(infoTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        infoTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="qwenKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="qwenKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        infoTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="QwenRegion">Region</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.appendChild(this.qwenRegion);
        tr.appendChild(td);

        let options: string = '<option value="Singapore">Singapore</option><option value="Virginia">US (Virginia)</option><option value="Beijing">China (Beijing)</option>';
        this.qwenRegion.innerHTML = options;


        tr = document.createElement('tr');
        infoTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="qwenModel">Qwen Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');

        let qwenModelInput: HTMLInputElement = document.createElement('input');
        qwenModelInput.type = 'text';
        qwenModelInput.id = 'qwenModel';
        qwenModelInput.classList.add('table_input');
        qwenModelInput.setAttribute('list', 'qwenModelsList');
        td.appendChild(qwenModelInput);
        tr.appendChild(td);

        let qwenDatalist: HTMLDataListElement = document.createElement('datalist');
        qwenDatalist.id = 'qwenModelsList';
        container.appendChild(qwenDatalist);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.qwenFixTags.id = 'qwenFixTags';
        this.qwenFixTags.type = 'checkbox';
        this.qwenFixTags.addEventListener('change', () => {
            if (this.qwenFixTags.checked) {
                this.chatGptFixTags.checked = false;
                this.anthropicFixTags.checked = false;
                this.mistralFixTags.checked = false;
                this.geminiFixTags.checked = false;
            }
        });
        tagsRow.appendChild(this.qwenFixTags);

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'qwenFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableQwen = document.getElementById('enableQwen') as HTMLInputElement;
        this.qwenKey = document.getElementById('qwenKey') as HTMLInputElement;
        this.qwenModel = document.getElementById('qwenModel') as HTMLInputElement;
    }

    populateOllamaTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';
        let ollamaDiv: HTMLDivElement = document.createElement('div');
        ollamaDiv.classList.add('middle');
        ollamaDiv.classList.add('row');
        ollamaDiv.style.paddingLeft = '4px';
        ollamaDiv.innerHTML = '<input type="checkbox" id="enableOllama"><label for="enableOllama" style="padding-top:4px;">Enable Ollama Translation</label>';
        container.appendChild(ollamaDiv);

        let inputsTable: HTMLTableElement = document.createElement('table');
        inputsTable.classList.add('fill_width');
        container.appendChild(inputsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        inputsTable.appendChild(tr);
        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="ollamaUrl">Ollama URL</label>'
        tr.appendChild(td);
        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let ollamaUrlInput: HTMLInputElement = document.createElement('input');
        ollamaUrlInput.type = 'text';
        ollamaUrlInput.id = 'ollamaUrl';
        ollamaUrlInput.classList.add('table_input');
        td.appendChild(ollamaUrlInput);
        tr.appendChild(td);

        tr = document.createElement('tr');
        inputsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="ollamaModel">Ollama Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let ollamaModelInput: HTMLInputElement = document.createElement('input');
        ollamaModelInput.type = 'text';
        ollamaModelInput.id = 'ollamaModel';
        ollamaModelInput.classList.add('table_input');
        td.appendChild(ollamaModelInput);
        tr.appendChild(td);


        let thinkRow: HTMLDivElement = document.createElement('div');
        thinkRow.classList.add('row');
        thinkRow.classList.add('middle');
        container.appendChild(thinkRow);

        this.ollamaThink.id = 'ollamaThink';
        this.ollamaThink.type = 'checkbox';
        thinkRow.appendChild(this.ollamaThink);

        let thinkLabel: HTMLLabelElement = document.createElement('label');
        thinkLabel.innerText = 'Enable Thinking';
        thinkLabel.setAttribute('for', 'ollamaThink');
        thinkLabel.style.paddingTop = '4px';
        thinkRow.appendChild(thinkLabel);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.ollamaFixTags.id = 'ollamaFixTags';
        this.ollamaFixTags.type = 'checkbox';
        this.ollamaFixTags.addEventListener('change', () => {
            if (this.ollamaFixTags.checked) {
                this.chatGptFixTags.checked = false;
                this.anthropicFixTags.checked = false;
                this.mistralFixTags.checked = false;
                this.geminiFixTags.checked = false;
                this.qwenFixTags.checked = false;
            }
        });
        tagsRow.appendChild(this.ollamaFixTags);

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'ollamaFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableOllama = document.getElementById('enableOllama') as HTMLInputElement;
        this.ollamaUrl = document.getElementById('ollamaUrl') as HTMLInputElement;
        this.ollamaModel = document.getElementById('ollamaModel') as HTMLInputElement;
    }

    populateAnthropicTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';
        let anthropicDiv: HTMLDivElement = document.createElement('div');
        anthropicDiv.classList.add('middle');
        anthropicDiv.classList.add('row');
        anthropicDiv.style.paddingLeft = '4px';
        anthropicDiv.innerHTML = '<input type="checkbox" id="enableAnthropic"><label for="enableAnthropic" style="padding-top:4px;">Enable Claude Translation</label>';
        container.appendChild(anthropicDiv);
        let inputsTable: HTMLTableElement = document.createElement('table');
        inputsTable.classList.add('fill_width');
        container.appendChild(inputsTable);
        let tr: HTMLTableRowElement = document.createElement('tr');
        inputsTable.appendChild(tr);
        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="anthropicKey">API Key</label>'
        tr.appendChild(td);
        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="anthropicKey" class="table_input"/>';
        tr.appendChild(td);
        tr = document.createElement('tr');
        inputsTable.appendChild(tr);
        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="anthropicModel">Claude Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let anthropicModelInput: HTMLInputElement = document.createElement('input');
        anthropicModelInput.type = 'text';
        anthropicModelInput.id = 'anthropicModel';
        anthropicModelInput.classList.add('table_input');
        anthropicModelInput.setAttribute('list', 'anthropicModelsList');
        td.appendChild(anthropicModelInput);
        tr.appendChild(td);

        let anthropicDatalist: HTMLDataListElement = document.createElement('datalist');
        anthropicDatalist.id = 'anthropicModelsList';
        container.appendChild(anthropicDatalist);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.anthropicFixTags.id = 'anthropicFixTags';
        this.anthropicFixTags.type = 'checkbox';
        tagsRow.appendChild(this.anthropicFixTags);
        this.anthropicFixTags.addEventListener('change', () => {
            if (this.anthropicFixTags.checked) {
                this.chatGptFixTags.checked = false;
                this.mistralFixTags.checked = false;
                this.geminiFixTags.checked = false;
                this.qwenFixTags.checked = false;
            }
        });

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'anthropicFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableAnthropic = document.getElementById('enableAnthropic') as HTMLInputElement;
        this.anthropicKey = document.getElementById('anthropicKey') as HTMLInputElement;
        this.anthropicModel = document.getElementById('anthropicModel') as HTMLInputElement;
    }

    populateGeminiTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';
        let geminiDiv: HTMLDivElement = document.createElement('div');
        geminiDiv.classList.add('middle');
        geminiDiv.classList.add('row');
        geminiDiv.style.paddingLeft = '4px';
        geminiDiv.innerHTML = '<input type="checkbox" id="enableGemini"><label for="enableGemini" style="padding-top:4px;">Enable Gemini Translation</label>';
        container.appendChild(geminiDiv);
        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);
        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);
        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="geminiKey">API Key</label>'
        tr.appendChild(td);
        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="geminiKey" class="table_input"/>';
        tr.appendChild(td);
        tr = document.createElement('tr');
        langsTable.appendChild(tr);
        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="geminiModel">Gemini Model</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        let geminiModelInput: HTMLInputElement = document.createElement('input');
        geminiModelInput.type = 'text';
        geminiModelInput.id = 'geminiModel';
        geminiModelInput.classList.add('table_input');
        geminiModelInput.setAttribute('list', 'geminiModelsList');
        td.appendChild(geminiModelInput);
        tr.appendChild(td);

        let geminiDatalist: HTMLDataListElement = document.createElement('datalist');
        geminiDatalist.id = 'geminiModelsList';
        container.appendChild(geminiDatalist);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);

        this.geminiFixTags.id = 'geminiFixTags';
        this.geminiFixTags.type = 'checkbox';
        tagsRow.appendChild(this.geminiFixTags);
        this.geminiFixTags.addEventListener('change', () => {
            if (this.geminiFixTags.checked) {
                this.chatGptFixTags.checked = false;
                this.mistralFixTags.checked = false;
                this.anthropicFixTags.checked = false;
                this.qwenFixTags.checked = false;
            }
        });

        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.innerText = 'Use to Fix Tags';
        fixLabel.setAttribute('for', 'geminiFixTags');
        fixLabel.style.paddingTop = '4px';
        tagsRow.appendChild(fixLabel);

        this.enableGemini = document.getElementById('enableGemini') as HTMLInputElement;
        this.geminiKey = document.getElementById('geminiKey') as HTMLInputElement;
        this.geminiModel = document.getElementById('geminiModel') as HTMLInputElement;
    }

    populateModernmtTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let modernmtDiv: HTMLDivElement = document.createElement('div');
        modernmtDiv.classList.add('middle');
        modernmtDiv.classList.add('row');
        modernmtDiv.style.paddingLeft = '4px';
        modernmtDiv.innerHTML = '<input type="checkbox" id="enablemodernmt"><label for="enablemodernmt" style="padding-top:4px;">Enable ModernMT</label>';
        container.appendChild(modernmtDiv);

        let langsTable: HTMLTableElement = document.createElement('table');
        langsTable.classList.add('fill_width');
        container.appendChild(langsTable);

        let tr: HTMLTableRowElement = document.createElement('tr');
        langsTable.appendChild(tr);

        let td: HTMLTableCellElement = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="modernmtKey">API Key</label>'
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<input type="text" id="modernmtKey" class="table_input"/>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="modernmtSrcLang">Source Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="modernmtSrcLang" class="table_select"></select>';
        tr.appendChild(td);

        tr = document.createElement('tr');
        langsTable.appendChild(tr);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('noWrap');
        td.innerHTML = '<label for="modernmtTgtLang">Target Language</label>';
        tr.appendChild(td);

        td = document.createElement('td');
        td.classList.add('middle');
        td.classList.add('fill_width');
        td.innerHTML = '<select id="modernmtTgtLang" class="table_select"></select>';
        tr.appendChild(td);

        this.enableModernmt = document.getElementById('enablemodernmt') as HTMLInputElement;
        this.modernmtKey = document.getElementById('modernmtKey') as HTMLInputElement;
        this.modernmtSrcLang = document.getElementById('modernmtSrcLang') as HTMLSelectElement;
        this.modernmtTgtLang = document.getElementById('modernmtTgtLang') as HTMLSelectElement;
    }

    setCustomAiEnabled(enabled: boolean): void {
        this.customAiName.disabled = !enabled;
        this.customAiBaseUrl.disabled = !enabled;
        this.customAiKey.disabled = !enabled;
        this.customAiModel.disabled = !enabled;
        this.customAiFormat.disabled = !enabled;
        this.customAiTemplate.disabled = !enabled;
        this.customAiResponsePath.disabled = !enabled;
        this.customAiHeaders.disabled = !enabled;
        this.customAiFixTags.disabled = !enabled;
    }

    populateCustomAiTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let enableRow: HTMLDivElement = document.createElement('div');
        enableRow.classList.add('middle');
        enableRow.classList.add('row');
        enableRow.style.paddingLeft = '4px';
        this.enableCustomAi.type = 'checkbox';
        this.enableCustomAi.id = 'enableCustomAi';
        enableRow.appendChild(this.enableCustomAi);
        let enableLabel: HTMLLabelElement = document.createElement('label');
        enableLabel.setAttribute('for', 'enableCustomAi');
        enableLabel.style.paddingTop = '4px';
        enableLabel.innerText = t('enableCustomAi');
        enableRow.appendChild(enableLabel);
        container.appendChild(enableRow);

        let table: HTMLTableElement = document.createElement('table');
        table.classList.add('fill_width');
        container.appendChild(table);

        let addRow = (labelText: string, control: HTMLElement): void => {
            let tr: HTMLTableRowElement = document.createElement('tr');
            table.appendChild(tr);
            let td: HTMLTableCellElement = document.createElement('td');
            td.classList.add('middle');
            td.classList.add('noWrap');
            td.innerText = labelText;
            tr.appendChild(td);
            td = document.createElement('td');
            td.classList.add('middle');
            td.classList.add('fill_width');
            td.appendChild(control);
            tr.appendChild(td);
        };

        this.customAiName.id = 'customAiName';
        this.customAiName.classList.add('table_input');
        addRow(t('providerName'), this.customAiName);

        this.customAiBaseUrl.id = 'customAiBaseUrl';
        this.customAiBaseUrl.classList.add('table_input');
        this.customAiBaseUrl.placeholder = 'https://api.openai.com/v1';
        addRow(t('apiBaseUrl'), this.customAiBaseUrl);

        this.customAiKey.id = 'customAiKey';
        this.customAiKey.classList.add('table_input');
        addRow(t('apiKey'), this.customAiKey);

        this.customAiModel.id = 'customAiModel';
        this.customAiModel.classList.add('table_input');
        addRow(t('model'), this.customAiModel);

        this.customAiFormat.id = 'customAiFormat';
        this.customAiFormat.classList.add('table_select');
        this.customAiFormat.innerHTML =
            '<option value="openai-chat">' + t('formatOpenAiChat') + '</option>' +
            '<option value="openai-completions">' + t('formatOpenAiCompletions') + '</option>' +
            '<option value="anthropic">' + t('formatAnthropic') + '</option>' +
            '<option value="gemini">' + t('formatGemini') + '</option>' +
            '<option value="ollama">' + t('formatOllama') + '</option>' +
            '<option value="custom">' + t('formatCustom') + '</option>';
        addRow(t('requestFormat'), this.customAiFormat);

        this.customAiTemplate.id = 'customAiTemplate';
        this.customAiTemplate.classList.add('table_input');
        this.customAiTemplate.rows = 5;
        this.customAiTemplate.style.width = '100%';
        addRow(t('requestTemplate'), this.customAiTemplate);

        this.customAiResponsePath.id = 'customAiResponsePath';
        this.customAiResponsePath.classList.add('table_input');
        this.customAiResponsePath.placeholder = 'choices.0.message.content';
        addRow(t('responsePath'), this.customAiResponsePath);

        this.customAiHeaders.id = 'customAiHeaders';
        this.customAiHeaders.classList.add('table_input');
        this.customAiHeaders.rows = 3;
        this.customAiHeaders.style.width = '100%';
        addRow(t('extraHeaders'), this.customAiHeaders);

        let tagsRow: HTMLDivElement = document.createElement('div');
        tagsRow.classList.add('row');
        tagsRow.classList.add('middle');
        container.appendChild(tagsRow);
        this.customAiFixTags.id = 'customAiFixTags';
        this.customAiFixTags.type = 'checkbox';
        tagsRow.appendChild(this.customAiFixTags);
        let fixLabel: HTMLLabelElement = document.createElement('label');
        fixLabel.setAttribute('for', 'customAiFixTags');
        fixLabel.style.paddingTop = '4px';
        fixLabel.innerText = t('useToFixTags');
        tagsRow.appendChild(fixLabel);

        let hint: HTMLParagraphElement = document.createElement('p');
        hint.className = 'hint';
        hint.innerText = t('customAiHint');
        container.appendChild(hint);

        let testButton: HTMLButtonElement = document.createElement('button');
        testButton.innerText = t('testConnection');
        testButton.addEventListener('click', () => {
            ipcRenderer.send('test-custom-ai', {
                name: this.customAiName.value,
                baseUrl: this.customAiBaseUrl.value,
                apiKey: this.customAiKey.value,
                model: this.customAiModel.value,
                format: this.customAiFormat.value,
                requestTemplate: this.customAiTemplate.value,
                responsePath: this.customAiResponsePath.value,
                extraHeaders: this.customAiHeaders.value
            });
        });
        container.appendChild(testButton);
        ipcRenderer.on('custom-ai-tested', (_event: IpcRendererEvent, result: any) => {
            if (result.ok) {
                ipcRenderer.send('show-message', { type: 'info', message: t('customAiConnected', result.sample || 'OK'), parent: 'preferences' });
            } else {
                ipcRenderer.send('show-message', { type: 'error', message: t('customAiFailed', result.message || ''), parent: 'preferences' });
            }
        });
    }

    populateInlineSuggestTab(container: HTMLDivElement): void {
        container.style.paddingTop = '10px';

        let addCheck = (input: HTMLInputElement, id: string, labelText: string): void => {
            let row: HTMLDivElement = document.createElement('div');
            row.classList.add('middle');
            row.classList.add('row');
            row.style.paddingLeft = '4px';
            input.type = 'checkbox';
            input.id = id;
            row.appendChild(input);
            let label: HTMLLabelElement = document.createElement('label');
            label.setAttribute('for', id);
            label.style.paddingTop = '4px';
            label.innerText = labelText;
            row.appendChild(label);
            container.appendChild(row);
        };
        addCheck(this.enableInlineSuggest, 'enableInlineSuggest', t('enableInlineSuggest'));
        addCheck(this.enableInlineAi, 'enableInlineAi', t('enableInlineAi'));
        addCheck(this.reuseProviderCredentials, 'reuseProviderCredentials', t('reuseProviderCredentials'));

        let table: HTMLTableElement = document.createElement('table');
        table.classList.add('fill_width');
        container.appendChild(table);
        let addRow = (labelText: string, control: HTMLElement): void => {
            let tr: HTMLTableRowElement = document.createElement('tr');
            table.appendChild(tr);
            let td: HTMLTableCellElement = document.createElement('td');
            td.classList.add('middle');
            td.classList.add('noWrap');
            td.innerText = labelText;
            tr.appendChild(td);
            td = document.createElement('td');
            td.classList.add('middle');
            td.classList.add('fill_width');
            td.appendChild(control);
            tr.appendChild(td);
        };

        this.inlineSuggestDebounce.type = 'number';
        this.inlineSuggestDebounce.min = '100';
        this.inlineSuggestDebounce.max = '2000';
        this.inlineSuggestDebounce.step = '50';
        this.inlineSuggestDebounce.style.width = '72px';
        addRow(t('inlineSuggestDebounce'), this.inlineSuggestDebounce);

        this.inlineSuggestProvider.classList.add('table_select');
        this.inlineSuggestProvider.innerHTML =
            '<option value="none">' + t('inlineSuggestNone') + '</option>' +
            '<option value="chatGpt">ChatGPT</option>' +
            '<option value="anthropic">Claude</option>' +
            '<option value="mistral">Mistral</option>' +
            '<option value="gemini">Gemini</option>' +
            '<option value="qwen">Qwen</option>' +
            '<option value="ollama">Ollama</option>' +
            '<option value="custom">' + t('customAi') + '</option>';
        addRow(t('inlineSuggestProvider'), this.inlineSuggestProvider);

        this.inlineSuggestModel.classList.add('table_input');
        this.inlineSuggestModel.setAttribute('list', 'inlineSuggestModelsList');
        addRow(t('inlineSuggestModel'), this.inlineSuggestModel);
        let datalist: HTMLDataListElement = document.createElement('datalist');
        datalist.id = 'inlineSuggestModelsList';
        container.appendChild(datalist);

        this.inlineSuggestApiKey.classList.add('table_input');
        addRow(t('inlineSuggestApiKey'), this.inlineSuggestApiKey);

        this.inlineSuggestBaseUrl.classList.add('table_input');
        this.inlineSuggestBaseUrl.placeholder = 'https://api.openai.com/v1';
        addRow(t('inlineSuggestBaseUrl'), this.inlineSuggestBaseUrl);

        this.inlineSuggestFormat.classList.add('table_select');
        this.inlineSuggestFormat.innerHTML =
            '<option value="openai-chat">' + t('formatOpenAiChat') + '</option>' +
            '<option value="openai-completions">' + t('formatOpenAiCompletions') + '</option>' +
            '<option value="anthropic">' + t('formatAnthropic') + '</option>' +
            '<option value="gemini">' + t('formatGemini') + '</option>' +
            '<option value="ollama">' + t('formatOllama') + '</option>' +
            '<option value="custom">' + t('formatCustom') + '</option>';
        addRow(t('requestFormat'), this.inlineSuggestFormat);

        this.inlineSuggestTemplate.classList.add('table_input');
        this.inlineSuggestTemplate.rows = 4;
        this.inlineSuggestTemplate.style.width = '100%';
        addRow(t('requestTemplate'), this.inlineSuggestTemplate);

        this.inlineSuggestResponsePath.classList.add('table_input');
        addRow(t('responsePath'), this.inlineSuggestResponsePath);

        this.inlineSuggestHeaders.classList.add('table_input');
        this.inlineSuggestHeaders.rows = 2;
        this.inlineSuggestHeaders.style.width = '100%';
        addRow(t('extraHeaders'), this.inlineSuggestHeaders);

        let hint: HTMLParagraphElement = document.createElement('p');
        hint.className = 'hint';
        hint.innerText = t('inlineSuggestHint');
        container.appendChild(hint);

        this.enableInlineAi.addEventListener('change', () => this.updateInlineSuggestFields());
        this.inlineSuggestProvider.addEventListener('change', () => this.updateInlineSuggestFields());
        this.reuseProviderCredentials.addEventListener('change', () => this.updateInlineSuggestFields());
    }

    updateInlineSuggestFields(): void {
        let aiOn: boolean = this.enableInlineAi.checked;
        let provider: string = this.inlineSuggestProvider.value;
        let custom: boolean = provider === 'custom';
        this.inlineSuggestProvider.disabled = !aiOn;
        this.inlineSuggestModel.disabled = !aiOn || provider === 'none';
        this.inlineSuggestApiKey.disabled = !aiOn || provider === 'none' || provider === 'ollama';
        this.inlineSuggestBaseUrl.disabled = !aiOn || provider === 'none';
        this.reuseProviderCredentials.disabled = !aiOn || provider === 'none';
        this.inlineSuggestFormat.disabled = !aiOn || !custom;
        this.inlineSuggestTemplate.disabled = !aiOn || !custom;
        this.inlineSuggestResponsePath.disabled = !aiOn || !custom;
        this.inlineSuggestHeaders.disabled = !aiOn || !custom;
        this.refreshInlineSuggestModels();
    }

    refreshInlineSuggestModels(): void {
        let listId: string = 'inlineSuggestModelsList';
        let provider: string = this.inlineSuggestProvider.value;
        if (provider === 'chatGpt') {
            this.copyModelList('chatGptModelsList', listId);
        } else if (provider === 'anthropic') {
            this.copyModelList('anthropicModelsList', listId);
        } else if (provider === 'mistral') {
            this.copyModelList('mistralModelsList', listId);
        } else if (provider === 'gemini') {
            this.copyModelList('geminiModelsList', listId);
        } else if (provider === 'qwen') {
            this.copyModelList('qwenModelsList', listId);
        }
    }

    copyModelList(fromId: string, toId: string): void {
        let from: HTMLDataListElement | null = document.getElementById(fromId) as HTMLDataListElement | null;
        let to: HTMLDataListElement | null = document.getElementById(toId) as HTMLDataListElement | null;
        if (!from || !to) {
            return;
        }
        to.innerHTML = from.innerHTML;
    }

    requestModelSuggestions(): void {
        if (this.modelSuggestionsLoaded || this.modelSuggestionsLoading) {
            return;
        }
        this.modelSuggestionsLoading = true;
        ipcRenderer.send('get-ai-models');
    }

    applyModelSuggestions(models: { ChatGPT?: string[], Claude?: string[], Mistral?: string[], Gemini?: string[], Qwen?: string[] }): void {
        this.modelSuggestionsLoading = false;
        this.modelSuggestionsLoaded = true;
        this.populateModelList('chatGptModelsList', models.ChatGPT);
        this.populateModelList('anthropicModelsList', models.Claude);
        this.populateModelList('mistralModelsList', models.Mistral);
        this.populateModelList('geminiModelsList', models.Gemini);
        this.populateModelList('qwenModelsList', models.Qwen);
        this.refreshInlineSuggestModels();
    }

    populateModelList(listId: string, options?: string[]): void {
        if (!options || options.length === 0) {
            return;
        }
        let datalist: HTMLDataListElement | null = document.getElementById(listId) as HTMLDataListElement;
        if (!datalist) {
            return;
        }
        datalist.innerHTML = '';
        for (let value of options) {
            let option: HTMLOptionElement = document.createElement('option');
            option.value = value;
            datalist.appendChild(option);
        }
    }

    setMtLanguages(arg: any): void {
        this.googleSrcLang.innerHTML = this.getOptions(arg.google.srcLangs);
        this.googleTgtLang.innerHTML = this.getOptions(arg.google.tgtLangs);

        this.azureSrcLang.innerHTML = this.getOptions(arg.azure.srcLangs);
        this.azureTgtLang.innerHTML = this.getOptions(arg.azure.tgtLangs);

        this.deeplSrcLang.innerHTML = this.getOptions(arg.deepl.srcLangs);
        this.deeplTgtLang.innerHTML = this.getOptions(arg.deepl.tgtLangs);

        this.modernmtSrcLang.innerHTML = this.getOptions(arg.modernmt.srcLangs);
        this.modernmtTgtLang.innerHTML = this.getOptions(arg.modernmt.tgtLangs);

        this.googleSrcLang.innerHTML = this.getOptions(arg.google.srcLangs);
        this.googleTgtLang.innerHTML = this.getOptions(arg.google.tgtLangs);

        ipcRenderer.send('get-languages');
        document.body.classList.remove("wait");
    }

    getOptions(array: Language[]): string {
        let languageOptions: string = '<option value="none">Select Language</option>';
        for (let lang of array) {
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        return languageOptions;
    }

    setFilters(json: any): void {
        this.filtersTable.innerHTML = '';
        let files: string[] = json.files;
        for (let file of files) {
            let row: HTMLTableRowElement = document.createElement('tr');
            this.filtersTable.appendChild(row);
            let col1: HTMLTableCellElement = document.createElement('td');
            col1.classList.add('middle');
            row.appendChild(col1);
            let check: HTMLInputElement = document.createElement('input');
            check.id = 'ck_' + file;
            check.type = 'checkbox';
            col1.appendChild(check);
            row.addEventListener('click', (event: MouseEvent) => {
                this.clicked(row, file, check);
            });
            let col2 = document.createElement('td');
            col2.classList.add('fill_width');
            col2.innerText = file;
            row.appendChild(col2);
        }
        this.selected.clear();
    }

    clicked(row: HTMLTableRowElement, file: string, checkbox: HTMLInputElement): void {
        let isSelected: boolean = this.selected.has(file);
        if (!isSelected) {
            this.selected.set(file, file);
            row.classList.add('selected');
        } else {
            this.selected.delete(file);
            row.classList.remove('selected');
        }
        checkbox.checked = !isSelected;
    }

    addFilter(): void {
        ipcRenderer.send('show-addXmlConfiguration');
    }

    editFilter(): void {
        if (this.selected.size === 0) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select configuration file', parent: 'preferences' });
            return;
        }
        if (this.selected.size !== 1) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select one configuration file', parent: 'preferences' });
            return;
        }
        let it: IterableIterator<[string, string]> = this.selected.entries();
        let first: IteratorResult<[string, string]> = it.next();
        ipcRenderer.send('edit-filterConfig', { file: this.selected.get(first.value[0]) });
    }

    removeFilters(): void {
        if (this.selected.size === 0) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select configuration file', parent: 'preferences' });
            return;
        }
        let selectedFiles: string[] = [];
        for (let key of this.selected.keys()) {
            selectedFiles.push(key);
        }
        ipcRenderer.send('remove-xmlFilters', { files: selectedFiles });
    }

    exportFilters(): void {
        if (this.selected.size === 0) {
            ipcRenderer.send('show-message', { type: 'warning', message: 'Select configuration file', parent: 'preferences' });
            return;
        }
        let selectedFiles: string[] = [];
        for (let key of this.selected.keys()) {
            selectedFiles.push(key);
        }
        ipcRenderer.send('export-xmlFilters', { files: selectedFiles });
    }

}

