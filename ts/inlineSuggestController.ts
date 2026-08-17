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
import {
    CompletionContext,
    CompletionItem,
    InlineSuggestion,
    InlineSuggestPreferences,
    buildInlineCompletionPrompt,
    consumeTypedPrefix,
    defaultInlineSuggest,
    isCurrentRequest,
    lastWordPrefix,
    normalizeInlineSuggest,
    plainTextFromHtml,
    rankLocalItems,
    shouldRequestAi,
    takeNextWord
} from "./inlineCompletion.js";
import { Match } from "./match.js";
import { Term } from "./term.js";

export interface InlineSuggestHost {
    srcLang: string;
    tgtLang: string;
    getSourceHtml: () => string;
    getNeighbors: () => { previous?: { source: string; target: string }; next?: { source: string; target: string } };
    insertHtml: (html: string) => void;
    onInserted: () => void;
}

export class InlineSuggestController {

    private host: InlineSuggestHost;
    private cell: HTMLTableCellElement | undefined;
    private ghostEl: HTMLDivElement;
    private widgetEl: HTMLDivElement;
    private prefs: InlineSuggestPreferences = defaultInlineSuggest();
    private terms: Term[] = [];
    private tmMatches: Match[] = [];
    private items: CompletionItem[] = [];
    private selectedIndex: number = 0;
    private widgetVisible: boolean = false;
    private ghost: InlineSuggestion | null = null;
    private ghostOriginPrefix: string = '';
    private requestId: number = 0;
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private invokeAll: boolean = false;

    private inputHandler: () => void = () => this.onInput();
    private keyHandler: (event: KeyboardEvent) => void = (event: KeyboardEvent) => this.onKeyDown(event);
    private caretMoveHandler: () => void = () => this.onCaretMove();
    private scrollHandler: () => void = () => this.reposition();
    private resultHandler: (event: IpcRendererEvent, arg: any) => void = (_event: IpcRendererEvent, arg: any) => this.onAiResult(arg);

    constructor(host: InlineSuggestHost) {
        this.host = host;
        this.ghostEl = document.createElement('div');
        this.ghostEl.className = 'ghost-suggestion';
        this.ghostEl.style.display = 'none';
        document.body.appendChild(this.ghostEl);
        this.widgetEl = document.createElement('div');
        this.widgetEl.className = 'suggest-widget';
        this.widgetEl.style.display = 'none';
        document.body.appendChild(this.widgetEl);
        ipcRenderer.on('inline-completion-result', this.resultHandler);
        window.addEventListener('scroll', this.scrollHandler, true);
        window.addEventListener('resize', this.scrollHandler);
    }

    setPreferences(prefs: InlineSuggestPreferences | undefined | null): void {
        this.prefs = normalizeInlineSuggest(prefs);
        if (!this.prefs.enabled) {
            this.dismiss();
        }
    }

    setTerms(terms: Term[]): void {
        this.terms = terms || [];
        if (this.cell) {
            this.refreshLocal(false);
        }
    }

    setMatches(matches: Match[]): void {
        this.tmMatches = (matches || []).filter((match: Match) => match.type === 'tm');
        if (this.cell) {
            this.refreshLocal(false);
        }
    }

    attach(cell: HTMLTableCellElement): void {
        this.detach();
        this.cell = cell;
        cell.addEventListener('input', this.inputHandler);
        cell.addEventListener('keyup', this.inputHandler);
        cell.addEventListener('mouseup', this.caretMoveHandler);
        cell.addEventListener('click', this.caretMoveHandler);
        cell.addEventListener('keydown', this.keyHandler, true);
        this.refreshLocal(false);
        this.scheduleAi();
    }

    detach(): void {
        this.clearTimer();
        this.requestId++;
        if (this.cell) {
            this.cell.removeEventListener('input', this.inputHandler);
            this.cell.removeEventListener('keyup', this.inputHandler);
            this.cell.removeEventListener('mouseup', this.caretMoveHandler);
            this.cell.removeEventListener('click', this.caretMoveHandler);
            this.cell.removeEventListener('keydown', this.keyHandler, true);
        }
        this.cell = undefined;
        this.hideGhost();
        this.hideWidget();
        this.ghost = null;
        this.items = [];
    }

    dispose(): void {
        this.detach();
        ipcRenderer.removeListener('inline-completion-result', this.resultHandler);
        window.removeEventListener('scroll', this.scrollHandler, true);
        window.removeEventListener('resize', this.scrollHandler);
        this.ghostEl.remove();
        this.widgetEl.remove();
    }

    hasActiveSuggestion(): boolean {
        return this.widgetVisible || !!(this.ghost && this.ghost.text);
    }

    dismiss(): boolean {
        let had: boolean = this.hasActiveSuggestion();
        this.clearTimer();
        this.requestId++;
        this.invokeAll = false;
        this.ghost = null;
        this.items = [];
        this.hideGhost();
        this.hideWidget();
        return had;
    }

    accept(): boolean {
        if (this.widgetVisible && this.items[this.selectedIndex]) {
            this.insertText(this.items[this.selectedIndex].insertText);
            return true;
        }
        if (this.ghost && this.ghost.text) {
            this.insertText(this.ghost.text);
            return true;
        }
        return false;
    }

    acceptWord(): boolean {
        if (!this.ghost || !this.ghost.text) {
            return false;
        }
        let word: string = takeNextWord(this.ghost.text);
        if (!word) {
            return false;
        }
        this.insertText(word);
        return true;
    }

    invokeWidget(): void {
        if (!this.prefs.enabled || !this.cell) {
            return;
        }
        this.invokeAll = true;
        this.refreshLocal(true);
        if (this.items.length === 0) {
            this.invokeAll = false;
        }
    }

    requestAiNow(): void {
        if (!this.prefs.enabled || !this.cell) {
            return;
        }
        this.clearTimer();
        this.fetchAi();
    }

    private onCaretMove(): void {
        if (!this.prefs.enabled || !this.cell) {
            return;
        }
        this.refreshLocal(false);
    }

    private onInput(): void {
        if (!this.prefs.enabled || !this.cell) {
            this.dismiss();
            return;
        }
        let caret = this.caret();
        if (this.ghost && this.ghost.text) {
            let consumed: string | null = consumeTypedPrefix(this.ghostOriginPrefix, this.ghost.text, caret.prefix);
            if (consumed !== null) {
                this.ghost.text = consumed;
                this.ghostOriginPrefix = caret.prefix;
                if (!consumed) {
                    this.ghost = null;
                    this.hideGhost();
                } else {
                    this.renderGhost();
                }
                this.refreshWidgetOnly(caret.prefix, false);
                return;
            }
        }
        this.refreshLocal(false);
        this.scheduleAi();
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (this.widgetVisible) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
                this.renderWidget();
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
                this.renderWidget();
                return;
            }
            if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                this.accept();
                return;
            }
        }
    }

    private refreshLocal(showWidget: boolean): void {
        if (!this.cell) {
            return;
        }
        let caret = this.caret();
        let ranked = rankLocalItems(caret.prefix, lastWordPrefix(caret.prefix), this.terms, this.tmMatches, this.invokeAll || showWidget);
        this.ghost = ranked.ghost;
        this.ghostOriginPrefix = caret.prefix;
        this.items = ranked.items;
        this.selectedIndex = 0;
        if (this.ghost && this.ghost.text) {
            this.renderGhost();
        } else {
            this.hideGhost();
        }
        let word: string = lastWordPrefix(caret.prefix);
        if ((showWidget || this.invokeAll || word.length > 0) && this.items.some((item: CompletionItem) => item.kind === 'term' || showWidget || this.invokeAll)) {
            if (!showWidget && !this.invokeAll) {
                this.items = this.items.filter((item: CompletionItem) => item.kind === 'term');
            }
            if (this.items.length > 0) {
                this.widgetVisible = true;
                this.renderWidget();
                return;
            }
        }
        this.hideWidget();
    }

    private refreshWidgetOnly(prefix: string, showWidget: boolean): void {
        let ranked = rankLocalItems(prefix, lastWordPrefix(prefix), this.terms, this.tmMatches, showWidget);
        this.items = ranked.items.filter((item: CompletionItem) => item.kind === 'term');
        this.selectedIndex = 0;
        if (this.items.length > 0 && lastWordPrefix(prefix)) {
            this.widgetVisible = true;
            this.renderWidget();
        } else {
            this.hideWidget();
        }
    }

    private scheduleAi(): void {
        this.clearTimer();
        if (!shouldRequestAi(this.ghost, this.prefs)) {
            return;
        }
        this.debounceTimer = setTimeout(() => this.fetchAi(), this.prefs.debounceMs);
    }

    private fetchAi(): void {
        if (!this.cell || !shouldRequestAi(this.ghost, this.prefs)) {
            return;
        }
        this.requestId++;
        let requestId: number = this.requestId;
        let caret = this.caret();
        let neighbors = this.host.getNeighbors();
        let ctx: CompletionContext = {
            srcLang: this.host.srcLang,
            tgtLang: this.host.tgtLang,
            source: this.host.getSourceHtml(),
            prefix: caret.prefix,
            suffix: caret.suffix,
            terms: this.terms,
            tmMatches: this.tmMatches.slice(0, 3),
            previous: neighbors.previous,
            next: neighbors.next
        };
        ipcRenderer.send('request-inline-completion', {
            requestId: requestId,
            prompt: buildInlineCompletionPrompt(ctx),
            srcLang: ctx.srcLang,
            tgtLang: ctx.tgtLang,
            prefix: caret.prefix
        });
    }

    private onAiResult(arg: any): void {
        if (!arg || !isCurrentRequest(arg.requestId, this.requestId)) {
            return;
        }
        let text: string = typeof arg.text === 'string' ? arg.text : '';
        if (!text || !this.cell) {
            return;
        }
        if (this.ghost && this.ghost.confidence === 'high') {
            return;
        }
        this.ghost = { text: text, origin: 'AI', confidence: 'low' };
        this.ghostOriginPrefix = this.caret().prefix;
        this.renderGhost();
    }

    private insertText(text: string): void {
        if (!text) {
            this.dismiss();
            return;
        }
        this.host.insertHtml(text);
        this.dismiss();
        this.host.onInserted();
        this.refreshLocal(false);
    }

    private caret(): { prefix: string; suffix: string } {
        if (!this.cell) {
            return { prefix: '', suffix: '' };
        }
        let selection: Selection | null = document.getSelection();
        if (!selection || selection.rangeCount === 0 || !this.cell.contains(selection.anchorNode)) {
            let text: string = plainTextFromHtml(this.cell.innerHTML);
            return { prefix: text, suffix: '' };
        }
        let range: Range = selection.getRangeAt(0);
        let before: Range = document.createRange();
        before.selectNodeContents(this.cell);
        before.setEnd(range.startContainer, range.startOffset);
        let after: Range = document.createRange();
        after.selectNodeContents(this.cell);
        after.setStart(range.endContainer, range.endOffset);
        return { prefix: before.toString(), suffix: after.toString() };
    }

    private isUsableRect(rect: DOMRect): boolean {
        return Number.isFinite(rect.left) && Number.isFinite(rect.top) && (rect.left !== 0 || rect.top !== 0 || rect.width > 0 || rect.height > 0);
    }

    private firstUsableRect(rects: DOMRectList): DOMRect | undefined {
        for (let i: number = 0; i < rects.length; i++) {
            if (this.isUsableRect(rects[i])) {
                return rects[i];
            }
        }
        return undefined;
    }

    private snapToCell(rect: DOMRect): DOMRect {
        if (!this.cell) {
            return rect;
        }
        let cell: DOMRect = this.cell.getBoundingClientRect();
        let inside: boolean = rect.left >= cell.left - 8 && rect.left <= cell.right + 8
            && rect.top >= cell.top - 8 && rect.top <= cell.bottom + 8;
        if (inside && this.isUsableRect(rect)) {
            return rect;
        }
        return cell;
    }

    private caretRect(): DOMRect {
        if (this.cell) {
            let selection: Selection | null = document.getSelection();
            if (selection && selection.rangeCount > 0 && this.cell.contains(selection.anchorNode)) {
                let range: Range = selection.getRangeAt(0);
                let fromList: DOMRect | undefined = this.firstUsableRect(range.getClientRects());
                if (fromList) {
                    return this.snapToCell(fromList);
                }
                let rect: DOMRect = range.getBoundingClientRect();
                if (this.isUsableRect(rect)) {
                    return this.snapToCell(rect);
                }
            }
            let end: Range = document.createRange();
            end.selectNodeContents(this.cell);
            end.collapse(false);
            let endFromList: DOMRect | undefined = this.firstUsableRect(end.getClientRects());
            if (endFromList) {
                return this.snapToCell(endFromList);
            }
            let endRect: DOMRect = end.getBoundingClientRect();
            if (this.isUsableRect(endRect)) {
                return this.snapToCell(endRect);
            }
            return this.cell.getBoundingClientRect();
        }
        return new DOMRect(0, 0, 0, 0);
    }

    private clipToCell(left: number, top: number, width: number): { left: number; top: number; maxWidth: number } {
        if (!this.cell) {
            return { left: left, top: top, maxWidth: width };
        }
        let cell: DOMRect = this.cell.getBoundingClientRect();
        let clippedLeft: number = Math.min(Math.max(left, cell.left + 2), Math.max(cell.left + 2, cell.right - 8));
        let clippedTop: number = Math.min(Math.max(top, cell.top), Math.max(cell.top, cell.bottom - 12));
        return {
            left: clippedLeft,
            top: clippedTop,
            maxWidth: Math.max(32, cell.right - clippedLeft - 2)
        };
    }

    private renderGhost(): void {
        if (!this.ghost || !this.ghost.text) {
            this.hideGhost();
            return;
        }
        let rect: DOMRect = this.caretRect();
        let clipped = this.clipToCell(rect.right || rect.left, rect.top, 240);
        this.ghostEl.textContent = this.ghost.text;
        this.ghostEl.style.display = 'block';
        this.ghostEl.style.left = clipped.left + 'px';
        this.ghostEl.style.top = clipped.top + 'px';
        this.ghostEl.style.maxWidth = clipped.maxWidth + 'px';
        if (this.cell) {
            let style: CSSStyleDeclaration = window.getComputedStyle(this.cell);
            this.ghostEl.style.fontSize = style.fontSize;
            this.ghostEl.style.fontFamily = style.fontFamily;
            this.ghostEl.style.lineHeight = style.lineHeight;
        }
    }

    private renderWidget(): void {
        this.widgetEl.innerHTML = '';
        for (let i: number = 0; i < this.items.length; i++) {
            let item: CompletionItem = this.items[i];
            let row: HTMLDivElement = document.createElement('div');
            row.className = 'suggest-widget-item' + (i === this.selectedIndex ? ' selected' : '');
            let label: HTMLSpanElement = document.createElement('span');
            label.textContent = item.label;
            row.appendChild(label);
            let origin: HTMLSpanElement = document.createElement('span');
            origin.className = 'suggest-widget-origin';
            origin.textContent = item.origin;
            row.appendChild(origin);
            row.addEventListener('mousedown', (event: MouseEvent) => {
                event.preventDefault();
                this.selectedIndex = i;
                this.accept();
            });
            this.widgetEl.appendChild(row);
        }
        let rect: DOMRect = this.caretRect();
        let clipped = this.clipToCell(rect.left, rect.bottom + 4, 220);
        let left: number = Math.min(Math.max(8, clipped.left), window.innerWidth - 228);
        let top: number = clipped.top;
        if (top + 80 > window.innerHeight) {
            top = Math.max(8, rect.top - 84);
        }
        this.widgetEl.style.display = 'block';
        this.widgetEl.style.left = left + 'px';
        this.widgetEl.style.top = top + 'px';
        this.widgetVisible = true;
    }

    private hideGhost(): void {
        this.ghostEl.style.display = 'none';
        this.ghostEl.textContent = '';
    }

    private hideWidget(): void {
        this.widgetVisible = false;
        this.invokeAll = false;
        this.widgetEl.style.display = 'none';
        this.widgetEl.innerHTML = '';
    }

    private reposition(): void {
        if (this.ghost && this.ghost.text) {
            this.renderGhost();
        }
        if (this.widgetVisible) {
            this.renderWidget();
        }
    }

    private clearTimer(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
    }
}
