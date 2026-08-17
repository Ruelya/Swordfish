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
import { setAppLang, t } from "./i18n.js";

export class AiPreTranslate {

    memSelect: HTMLSelectElement;
    penalty: HTMLInputElement;
    engineList: HTMLDivElement;
    project: string = '';
    srcLang: string = '';
    tgtLang: string = '';

    constructor() {
        setAppLang(ipcRenderer.sendSync('get-app-lang'));
        this.memSelect = document.getElementById('memorySelect') as HTMLSelectElement;
        this.penalty = document.getElementById('penalty') as HTMLInputElement;
        this.engineList = document.getElementById('engineCheckList') as HTMLDivElement;
        this.penalty.value = '0';

        (document.getElementById('titleText') as HTMLSpanElement).innerText = t('preTranslateTitle');
        document.title = t('preTranslateTitle');
        (document.getElementById('introText') as HTMLParagraphElement).innerText = t('preTranslateIntro');
        (document.getElementById('memoryLabel') as HTMLLabelElement).innerText = t('memory');
        (document.getElementById('penaltyLabel') as HTMLLabelElement).innerText = t('penalization');
        (document.getElementById('applyTmFirstLabel') as HTMLLabelElement).innerText = t('applyTmFirst');
        (document.getElementById('thenAiTranslateLabel') as HTMLLabelElement).innerText = t('thenAiTranslate');
        (document.getElementById('autoAcceptAiLabel') as HTMLLabelElement).innerText = t('autoAcceptAi');
        (document.getElementById('autoConfirmAiLabel') as HTMLLabelElement).innerText = t('autoConfirmAi');
        (document.getElementById('engineSelectLabel') as HTMLLabelElement).innerText = t('selectMtEngines');
        (document.getElementById('startButton') as HTMLButtonElement).innerText = t('startPreTranslate');

        ipcRenderer.send('get-theme');
        ipcRenderer.on('set-theme', (_event: IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                ipcRenderer.send('close-ai-pretranslate');
            }
            if (event.code === 'Enter' || event.code === 'NumpadEnter') {
                this.start();
            }
        });
        ipcRenderer.send('get-memories');
        ipcRenderer.on('set-memories', (_event: IpcRendererEvent, arg: any) => {
            this.setMemories(arg);
        });
        ipcRenderer.on('set-memory', (_event: IpcRendererEvent, memory: string) => {
            this.memSelect.value = memory;
        });
        ipcRenderer.send('get-ai-pretranslate-context');
        ipcRenderer.on('set-ai-pretranslate-context', (_event: IpcRendererEvent, ctx: any) => {
            this.project = ctx.project || '';
            this.srcLang = ctx.srcLang || '';
            this.tgtLang = ctx.tgtLang || '';
            if (ctx.memory) {
                this.memSelect.value = ctx.memory;
            }
            this.setEngines(ctx.engines || [], ctx.selectedMtEngines || []);
        });
        this.penalty.addEventListener('keydown', (event: KeyboardEvent) => {
            let numberKeys: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace', 'Delete', 'Escape', 'Enter', 'NumpadEnter'];
            if (!numberKeys.includes(event.key)) {
                event.preventDefault();
            }
        });
        (document.getElementById('startButton') as HTMLButtonElement).addEventListener('click', () => {
            this.start();
        });
        setTimeout(() => {
            ipcRenderer.send('set-height', { window: 'aiPreTranslate', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }

    start(): void {
        let applyTmFirst: boolean = (document.getElementById('applyTmFirst') as HTMLInputElement).checked;
        let thenAiTranslate: boolean = (document.getElementById('thenAiTranslate') as HTMLInputElement).checked;
        let autoAcceptAi: boolean = (document.getElementById('autoAcceptAi') as HTMLInputElement).checked;
        let autoConfirmAi: boolean = (document.getElementById('autoConfirmAi') as HTMLInputElement).checked;
        if (applyTmFirst && this.memSelect.value === 'none') {
            ipcRenderer.send('show-message', { type: 'warning', message: t('selectMemory'), parent: 'aiPreTranslate' });
            return;
        }
        if (!thenAiTranslate && !applyTmFirst) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('thenAiTranslate'), parent: 'aiPreTranslate' });
            return;
        }
        let selectedMtEngines: string[] = this.selectedEngineIds();
        if (thenAiTranslate && selectedMtEngines.length === 0) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('noMtEngineSelected'), parent: 'aiPreTranslate' });
            return;
        }
        if (this.penalty.value.length === 0) {
            this.penalty.value = '0';
        }
        let penalization: number = Number.parseInt(this.penalty.value);
        if (penalization > 59) {
            ipcRenderer.send('show-message', { type: 'warning', message: t('penalizationLimit'), parent: 'aiPreTranslate' });
            return;
        }
        ipcRenderer.send('run-ai-pretranslate', {
            project: this.project,
            srcLang: this.srcLang,
            tgtLang: this.tgtLang,
            memory: this.memSelect.value,
            penalization: penalization,
            applyTmFirst: applyTmFirst,
            thenAiTranslate: thenAiTranslate,
            autoAcceptAi: autoAcceptAi,
            autoConfirmAi: autoConfirmAi,
            selectedMtEngines: selectedMtEngines
        });
    }

    setEngines(engines: Array<{ id: string; label: string; enabled: boolean }>, selected: string[]): void {
        this.engineList.innerHTML = '';
        let enabled: Array<{ id: string; label: string; enabled: boolean }> = engines.filter((engine) => engine.enabled);
        if (enabled.length === 0) {
            let empty: HTMLDivElement = document.createElement('div');
            empty.classList.add('hint');
            empty.innerText = t('preTranslateNeedEngine');
            this.engineList.appendChild(empty);
            return;
        }
        for (let engine of enabled) {
            let row: HTMLDivElement = document.createElement('div');
            row.classList.add('row');
            row.classList.add('middle');
            let check: HTMLInputElement = document.createElement('input');
            check.type = 'checkbox';
            check.id = 'engine-' + engine.id;
            check.value = engine.id;
            check.checked = selected.length === 0 || selected.indexOf(engine.id) >= 0;
            let label: HTMLLabelElement = document.createElement('label');
            label.setAttribute('for', check.id);
            label.innerText = engine.label;
            row.appendChild(check);
            row.appendChild(label);
            this.engineList.appendChild(row);
        }
    }

    selectedEngineIds(): string[] {
        let selected: string[] = [];
        let boxes: NodeListOf<HTMLInputElement> = this.engineList.querySelectorAll('input[type="checkbox"]');
        boxes.forEach((box: HTMLInputElement) => {
            if (box.checked) {
                selected.push(box.value);
            }
        });
        return selected;
    }

    setMemories(memories: any[]): void {
        if (memories.length === 0) {
            this.memSelect.innerHTML = '<option value="none" class="error">' + t('noMemory') + '</option>';
            return;
        }
        let options = '<option value="none" class="error">' + t('selectMemoryOption') + '</option>';
        for (let memory of memories) {
            options = options + '<option value="' + memory.id + '">' + memory.name + '</option>';
        }
        this.memSelect.innerHTML = options;
        this.memSelect.value = 'none';
        ipcRenderer.send('get-memory-param');
    }
}
