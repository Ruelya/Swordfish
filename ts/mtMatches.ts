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

import { ipcRenderer } from "electron";
import { t } from "./i18n.js";
import { Match } from "./match.js";
import { MtEngineOption } from "./mtEngineSelection.js";
import { TranslationView } from "./translation.js";

export class MtMatches {

    container: HTMLDivElement;
    projectId: string;

    listHolder: HTMLDivElement;
    matches: Map<string, Match>;
    matchOrder: string[] = [];
    selectedId: string = '';
    cards: Map<string, HTMLDivElement> = new Map();
    pickerPanel: HTMLDivElement;
    pickerButton: HTMLAnchorElement;
    emptyLabel: HTMLDivElement;
    hidePicker: () => void;

    constructor(div: HTMLDivElement, projectId: string) {
        this.container = div;
        this.projectId = projectId;
        this.matches = new Map<string, Match>();

        this.listHolder = document.createElement('div');
        this.listHolder.classList.add('mtCandidateList');
        this.container.appendChild(this.listHolder);

        this.emptyLabel = document.createElement('div');
        this.emptyLabel.classList.add('mtCandidateEmpty');
        this.emptyLabel.innerText = t('noMtCandidates');
        this.listHolder.appendChild(this.emptyLabel);

        let toolbar: HTMLDivElement = document.createElement('div');
        toolbar.classList.add('toolbar');
        toolbar.classList.add('middle');
        toolbar.classList.add('roundedBottom');
        toolbar.style.marginTop = '4px';
        this.container.appendChild(toolbar);

        let acceptTranslation = document.createElement('a');
        acceptTranslation.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M21 11H6.83l3.58-3.59L9 6l-6 6 6 6 1.41-1.41L6.83 13H21v-2z"/></svg>' +
            '<span class="tooltiptext bottomTooltip">' + t('acceptMt') + '</span>';
        acceptTranslation.className = 'tooltip bottomTooltip';
        acceptTranslation.addEventListener('click', () => {
            this.acceptTranslation();
        });
        toolbar.appendChild(acceptTranslation);

        let requestTranslation = document.createElement('a');
        requestTranslation.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>' +
            '<span class="tooltiptext bottomTooltip">' + t('getMt') + '</span>';
        requestTranslation.className = 'tooltip bottomTooltip';
        requestTranslation.addEventListener('click', () => {
            ipcRenderer.send('get-mt-matches');
        });
        toolbar.appendChild(requestTranslation);

        let autoTranslate = document.createElement('a');
        autoTranslate.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5.495 2h16.505v-2h-17c-1.657 0-3 1.343-3 3v18c0 1.657 1.343 3 3 3h17v-20h-16.505c-1.375 0-1.375-2 0-2zm.505 4h14v16h-14v-16z"/></svg>' +
            '<span class="tooltiptext bottomTooltip">' + t('getAutoTranslations') + '</span>';
        autoTranslate.className = 'tooltip bottomTooltip';
        autoTranslate.addEventListener('click', () => {
            ipcRenderer.send('get-am-matches');
        });
        toolbar.appendChild(autoTranslate);

        let pickerWrap: HTMLDivElement = document.createElement('div');
        pickerWrap.classList.add('mtEnginePickerWrap');
        toolbar.appendChild(pickerWrap);

        this.pickerButton = document.createElement('a');
        this.pickerButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M3 5h18v2H3V5zm4 6h10v2H7v-2zm3 6h4v2h-4v-2z"/></svg>' +
            '<span class="tooltiptext bottomTooltip">' + t('mtEnginePicker') + '</span>';
        this.pickerButton.className = 'tooltip bottomTooltip';
        pickerWrap.appendChild(this.pickerButton);

        this.pickerPanel = document.createElement('div');
        this.pickerPanel.classList.add('mtEnginePicker');
        this.pickerPanel.classList.add('hidden');
        document.body.appendChild(this.pickerPanel);

        this.pickerButton.addEventListener('click', (event: MouseEvent) => {
            event.stopPropagation();
            this.pickerPanel.classList.toggle('hidden');
            if (!this.pickerPanel.classList.contains('hidden')) {
                this.renderEnginePicker();
            }
        });
        this.pickerPanel.addEventListener('click', (event: MouseEvent) => {
            event.stopPropagation();
        });
        this.hidePicker = () => {
            this.pickerPanel.classList.add('hidden');
        };
        document.addEventListener('click', this.hidePicker);

        ipcRenderer.on('accept-mt-match', () => {
            this.acceptTranslation();
        });
        ipcRenderer.on('set-mt-engine-selection', () => {
            if (!this.pickerPanel.classList.contains('hidden')) {
                this.renderEnginePicker();
            }
        });

        let config: MutationObserverInit = { attributes: true, childList: false, subtree: false };
        let observer = new MutationObserver((mutationsList) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes') {
                    this.listHolder.style.height = (this.container.clientHeight - toolbar.clientHeight) + 'px';
                }
            }
        });
        observer.observe(this.container, config);
    }

    dispose(): void {
        document.removeEventListener('click', this.hidePicker);
        this.pickerPanel.classList.add('hidden');
        this.pickerPanel.remove();
    }

    clear(): void {
        this.matches.clear();
        this.matchOrder = [];
        this.selectedId = '';
        this.cards.clear();
        this.listHolder.innerHTML = '';
        this.emptyLabel = document.createElement('div');
        this.emptyLabel.classList.add('mtCandidateEmpty');
        this.emptyLabel.innerText = t('noMtCandidates');
        this.listHolder.appendChild(this.emptyLabel);
    }

    add(match: Match): void {
        if (this.emptyLabel.parentElement === this.listHolder) {
            this.listHolder.removeChild(this.emptyLabel);
        }
        this.matches.set(match.matchId, match);
        if (this.matchOrder.indexOf(match.matchId) < 0) {
            this.matchOrder.push(match.matchId);
        }

        let card: HTMLDivElement = document.createElement('div');
        card.classList.add('mtCandidate');
        card.dataset.matchId = match.matchId;

        let header: HTMLDivElement = document.createElement('div');
        header.classList.add('mtCandidateHeader');

        let origin: HTMLSpanElement = document.createElement('span');
        origin.classList.add('mtCandidateOrigin');
        origin.innerText = match.origin || t('mtCandidates');
        header.appendChild(origin);

        let acceptBtn: HTMLButtonElement = document.createElement('button');
        acceptBtn.classList.add('mtCandidateAccept');
        acceptBtn.innerText = t('acceptThisCandidate');
        acceptBtn.addEventListener('click', (event: MouseEvent) => {
            event.stopPropagation();
            this.select(match.matchId);
            this.acceptTranslation();
        });
        header.appendChild(acceptBtn);
        card.appendChild(header);

        let body: HTMLDivElement = document.createElement('div');
        body.classList.add('mtCandidateTarget');
        body.classList.add('machineContainer');
        body.classList.add('zoom');
        body.innerHTML = match.target;
        if (TranslationView.isBiDi(match.tgtLang)) {
            body.dir = 'rtl';
        }
        card.appendChild(body);

        card.addEventListener('click', () => {
            this.select(match.matchId);
        });

        this.listHolder.appendChild(card);
        this.cards.set(match.matchId, card);
        if (this.matchOrder.length === 1) {
            this.select(match.matchId);
        }
    }

    select(matchId: string): void {
        this.selectedId = matchId;
        this.cards.forEach((card: HTMLDivElement, id: string) => {
            if (id === matchId) {
                card.classList.add('selected');
                card.scrollIntoView({ block: 'nearest' });
            } else {
                card.classList.remove('selected');
            }
        });
    }

    acceptTranslation(): void {
        if (!this.selectedId) {
            return;
        }
        let match: Match | undefined = this.matches.get(this.selectedId);
        if (match) {
            ipcRenderer.send('accept-match', match);
        }
    }

    nextMatch(): void {
        if (this.matchOrder.length < 2) {
            return;
        }
        let index: number = this.matchOrder.indexOf(this.selectedId);
        if (index < this.matchOrder.length - 1) {
            this.select(this.matchOrder[index + 1]);
        }
    }

    previousMatch(): void {
        if (this.matchOrder.length < 2) {
            return;
        }
        let index: number = this.matchOrder.indexOf(this.selectedId);
        if (index > 0) {
            this.select(this.matchOrder[index - 1]);
        }
    }

    positionEnginePicker(): void {
        let rect: DOMRect = this.pickerButton.getBoundingClientRect();
        let width: number = Math.max(180, this.pickerPanel.offsetWidth || 180);
        let left: number = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        this.pickerPanel.style.left = left + 'px';
        this.pickerPanel.style.bottom = Math.max(8, window.innerHeight - rect.top + 4) + 'px';
        this.pickerPanel.style.top = 'auto';
    }

    renderEnginePicker(): void {
        let selection: { options: MtEngineOption[]; selected: string[] } = ipcRenderer.sendSync('get-mt-engine-selection');
        this.pickerPanel.innerHTML = '';
        let title: HTMLDivElement = document.createElement('div');
        title.classList.add('mtEnginePickerTitle');
        title.innerText = t('selectMtEngines');
        this.pickerPanel.appendChild(title);
        this.positionEnginePicker();
        let enabled: MtEngineOption[] = (selection?.options || []).filter((option: MtEngineOption) => option.enabled);
        if (enabled.length === 0) {
            let empty: HTMLDivElement = document.createElement('div');
            empty.innerText = t('preTranslateNeedEngine');
            this.pickerPanel.appendChild(empty);
            this.positionEnginePicker();
            return;
        }
        for (let option of enabled) {
            let row: HTMLLabelElement = document.createElement('label');
            row.classList.add('mtEnginePickerRow');
            let check: HTMLInputElement = document.createElement('input');
            check.type = 'checkbox';
            check.value = option.id;
            check.checked = (selection.selected || []).indexOf(option.id) >= 0;
            check.addEventListener('change', () => {
                let selected: string[] = [];
                let boxes: NodeListOf<HTMLInputElement> = this.pickerPanel.querySelectorAll('input[type="checkbox"]');
                boxes.forEach((box: HTMLInputElement) => {
                    if (box.checked) {
                        selected.push(box.value);
                    }
                });
                ipcRenderer.send('set-selected-mt-engines', selected);
            });
            row.appendChild(check);
            row.appendChild(document.createTextNode(option.label));
            this.pickerPanel.appendChild(row);
        }
        this.positionEnginePicker();
    }
}
