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
import { Language } from "typesbcp47";
import { setAppLang, t } from "./i18n.js";

type StepState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped';

interface LifecycleStep {
    id: string;
    labelKey: string;
}

const STEPS: LifecycleStep[] = [
    { id: 'prepare', labelKey: 'stepPrepare' },
    { id: 'create', labelKey: 'stepCreate' },
    { id: 'open', labelKey: 'stepOpen' },
    { id: 'tm', labelKey: 'stepTm' },
    { id: 'ai', labelKey: 'stepAi' },
    { id: 'accept', labelKey: 'stepAccept' },
    { id: 'qa', labelKey: 'stepQa' },
    { id: 'confirm', labelKey: 'stepConfirm' },
    { id: 'export', labelKey: 'stepExport' },
    { id: 'done', labelKey: 'stepDone' }
];

export class AiLifecycle {

    files: string[] = [];
    running: boolean = false;

    constructor() {
        setAppLang(ipcRenderer.sendSync('get-app-lang'));
        this.localize();
        this.renderSteps();
        ipcRenderer.send('get-theme');
        ipcRenderer.on('set-theme', (_event: IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
        });
        ipcRenderer.send('get-languages');
        ipcRenderer.on('set-languages', (_event: IpcRendererEvent, arg: any) => {
            this.setLanguages(arg);
        });
        ipcRenderer.send('get-memories');
        ipcRenderer.on('set-memories', (_event: IpcRendererEvent, memories: any[]) => {
            this.setOptions('memorySelect', memories, t('selectMemoryOption'), t('noMemory'));
        });
        ipcRenderer.send('get-glossaries');
        ipcRenderer.on('set-glossaries', (_event: IpcRendererEvent, glossaries: any[]) => {
            this.setOptions('glossarySelect', glossaries, t('selectGlossaryOption'), t('noGlossary'));
        });
        ipcRenderer.on('lifecycle-files-selected', (_event: IpcRendererEvent, files: string[]) => {
            this.files = files || [];
            (document.getElementById('filesSummary') as HTMLSpanElement).innerText = this.files.length === 0
                ? t('noFilesSelected')
                : this.files.map((file: string) => file.split(/[\\/]/).pop()).join(', ');
        });
        ipcRenderer.on('lifecycle-export-folder', (_event: IpcRendererEvent, folder: string) => {
            (document.getElementById('exportFolder') as HTMLInputElement).value = folder || '';
        });
        ipcRenderer.on('lifecycle-log', (_event: IpcRendererEvent, line: string) => {
            this.appendLog(line);
        });
        ipcRenderer.on('lifecycle-step', (_event: IpcRendererEvent, arg: { id: string, state: StepState, detail?: string }) => {
            this.setStep(arg.id, arg.state, arg.detail);
        });
        ipcRenderer.on('lifecycle-finished', () => {
            this.running = false;
            (document.getElementById('startButton') as HTMLButtonElement).disabled = false;
        });
        (document.getElementById('selectFilesButton') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('lifecycle-select-files');
        });
        (document.getElementById('browseExportButton') as HTMLButtonElement).addEventListener('click', () => {
            ipcRenderer.send('lifecycle-browse-export');
        });
        (document.getElementById('startButton') as HTMLButtonElement).addEventListener('click', () => {
            this.start();
        });
        (document.getElementById('cancelButton') as HTMLButtonElement).addEventListener('click', () => {
            if (this.running) {
                ipcRenderer.send('cancel-ai-lifecycle');
                return;
            }
            ipcRenderer.send('close-ai-lifecycle');
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.code === 'Escape' && !this.running) {
                ipcRenderer.send('close-ai-lifecycle');
            }
        });
        (document.getElementById('filesSummary') as HTMLSpanElement).innerText = t('noFilesSelected');
        setTimeout(() => {
            ipcRenderer.send('set-height', { window: 'aiLifecycle', width: 980, height: 720 });
        }, 200);
    }

    localize(): void {
        document.title = t('lifecycleTitle');
        (document.getElementById('titleText') as HTMLSpanElement).innerText = t('lifecycleTitle');
        (document.getElementById('introText') as HTMLParagraphElement).innerText = t('lifecycleIntro');
        (document.getElementById('nameLabel') as HTMLLabelElement).innerText = t('name');
        (document.getElementById('srcLabel') as HTMLLabelElement).innerText = t('sourceLanguage');
        (document.getElementById('tgtLabel') as HTMLLabelElement).innerText = t('targetLanguage');
        (document.getElementById('memoryLabel') as HTMLLabelElement).innerText = t('memory');
        (document.getElementById('glossaryLabel') as HTMLLabelElement).innerText = t('defaultGlossary');
        (document.getElementById('filesLabel') as HTMLLabelElement).innerText = t('selectSourceFiles');
        (document.getElementById('selectFilesButton') as HTMLButtonElement).innerText = t('selectSourceFiles');
        (document.getElementById('exportLabel') as HTMLLabelElement).innerText = t('exportFolder');
        (document.getElementById('browseExportButton') as HTMLButtonElement).innerText = t('browse');
        (document.getElementById('openEditorLabel') as HTMLLabelElement).innerText = t('openEditorVisible');
        (document.getElementById('runQaLabel') as HTMLLabelElement).innerText = t('runQa');
        (document.getElementById('confirmAfterLabel') as HTMLLabelElement).innerText = t('confirmAfterTranslate');
        (document.getElementById('exportAfterLabel') as HTMLLabelElement).innerText = t('exportAfterComplete');
        (document.getElementById('logLabel') as HTMLLabelElement).innerText = t('log');
        (document.getElementById('startButton') as HTMLButtonElement).innerText = t('startLifecycle');
        (document.getElementById('cancelButton') as HTMLButtonElement).innerText = t('cancelLifecycle');
    }

    renderSteps(): void {
        let panel: HTMLDivElement = document.getElementById('stepsPanel') as HTMLDivElement;
        panel.innerHTML = '';
        STEPS.forEach((step: LifecycleStep, index: number) => {
            let row: HTMLDivElement = document.createElement('div');
            row.className = 'lifecycle-step waiting';
            row.id = 'step-' + step.id;
            row.innerHTML = '<div class="lifecycle-step-index">' + (index + 1) + '</div>' +
                '<div><div>' + t(step.labelKey) + '</div><div class="hint" id="detail-' + step.id + '">' + t('waiting') + '</div></div>';
            panel.appendChild(row);
        });
    }

    setStep(id: string, state: StepState, detail?: string): void {
        let row: HTMLElement | null = document.getElementById('step-' + id);
        if (row) {
            row.className = 'lifecycle-step ' + state;
        }
        let detailEl: HTMLElement | null = document.getElementById('detail-' + id);
        if (detailEl) {
            detailEl.innerText = detail || t(state);
        }
    }

    appendLog(line: string): void {
        let log: HTMLDivElement = document.getElementById('logArea') as HTMLDivElement;
        let stamp: string = new Date().toLocaleTimeString();
        log.textContent = (log.textContent || '') + '[' + stamp + '] ' + line + '\n';
        log.scrollTop = log.scrollHeight;
    }

    setLanguages(arg: any): void {
        let array: Language[] = arg.languages;
        let options: string = '<option value="none">' + t('selectLanguage') + '</option>';
        for (let lang of array) {
            options += '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        (document.getElementById('srcLangSelect') as HTMLSelectElement).innerHTML = options;
        (document.getElementById('tgtLangSelect') as HTMLSelectElement).innerHTML = options;
        (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang || 'none';
        (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang || 'none';
    }

    setOptions(selectId: string, items: any[], selectLabel: string, emptyLabel: string): void {
        let select: HTMLSelectElement = document.getElementById(selectId) as HTMLSelectElement;
        if (!items || items.length === 0) {
            select.innerHTML = '<option value="none">' + emptyLabel + '</option>';
            return;
        }
        let options: string = '<option value="none">' + selectLabel + '</option>';
        for (let item of items) {
            options += '<option value="' + item.id + '">' + item.name + '</option>';
        }
        select.innerHTML = options;
    }

    start(): void {
        let name: string = (document.getElementById('nameInput') as HTMLInputElement).value.trim();
        let srcLang: string = (document.getElementById('srcLangSelect') as HTMLSelectElement).value;
        let tgtLang: string = (document.getElementById('tgtLangSelect') as HTMLSelectElement).value;
        if (name === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('lifecycleNeedName'), parent: 'aiLifecycle' });
            return;
        }
        if (srcLang === 'none' || tgtLang === 'none') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('lifecycleNeedLangs'), parent: 'aiLifecycle' });
            return;
        }
        if (this.files.length === 0) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('lifecycleNeedFiles'), parent: 'aiLifecycle' });
            return;
        }
        let exportAfter: boolean = (document.getElementById('exportAfter') as HTMLInputElement).checked;
        let exportFolder: string = (document.getElementById('exportFolder') as HTMLInputElement).value.trim();
        if (exportAfter && exportFolder === '') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('lifecycleNeedExport'), parent: 'aiLifecycle' });
            return;
        }
        this.running = true;
        (document.getElementById('startButton') as HTMLButtonElement).disabled = true;
        (document.getElementById('logArea') as HTMLDivElement).textContent = '';
        this.renderSteps();
        ipcRenderer.send('run-ai-lifecycle', {
            name: name,
            srcLang: srcLang,
            tgtLang: tgtLang,
            memory: (document.getElementById('memorySelect') as HTMLSelectElement).value,
            glossary: (document.getElementById('glossarySelect') as HTMLSelectElement).value,
            files: this.files,
            exportFolder: exportFolder,
            openEditor: (document.getElementById('openEditor') as HTMLInputElement).checked,
            runQa: (document.getElementById('runQa') as HTMLInputElement).checked,
            confirmAfter: (document.getElementById('confirmAfter') as HTMLInputElement).checked,
            exportAfter: exportAfter
        });
    }
}
