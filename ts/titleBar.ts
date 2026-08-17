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

/**
 * Windows-only custom title bar. Replaces the native caption + menu bar
 * (the two stacked chrome rows) with a single themed strip that hosts
 * the application menu and leaves room for titleBarOverlay controls.
 */
export class TitleBar {

    bar: HTMLDivElement | null = null;
    menuHost: HTMLElement | null = null;
    openIndex: number = -1;

    constructor() {
        let config: { enabled: boolean, icon: string, name: string } = ipcRenderer.sendSync('get-titlebar-config');
        this.bar = document.getElementById('appTitlebar') as HTMLDivElement | null;
        if (!config || !config.enabled || !this.bar) {
            return;
        }
        document.body.classList.add('has-app-titlebar');
        this.bar.hidden = false;
        this.bar.innerHTML = '';

        let icon: HTMLImageElement = document.createElement('img');
        icon.className = 'app-titlebar-icon';
        icon.src = config.icon;
        icon.alt = config.name;
        this.bar.appendChild(icon);

        let name: HTMLSpanElement = document.createElement('span');
        name.className = 'app-titlebar-name';
        name.innerText = config.name;
        this.bar.appendChild(name);

        this.menuHost = document.createElement('nav');
        this.menuHost.className = 'app-titlebar-menu';
        this.bar.appendChild(this.menuHost);

        let drag: HTMLDivElement = document.createElement('div');
        drag.className = 'app-titlebar-drag';
        this.bar.appendChild(drag);

        ipcRenderer.on('set-app-menu', (_event: IpcRendererEvent, items: { label: string }[]) => {
            this.renderMenu(items || []);
        });
        ipcRenderer.on('app-menu-closed', () => {
            this.clearOpen();
        });
        ipcRenderer.send('get-app-menu');
    }

    static reservedHeight(): number {
        if (!document.body.classList.contains('has-app-titlebar')) {
            return 0;
        }
        let bar: HTMLElement | null = document.getElementById('appTitlebar');
        return bar && !bar.hidden ? bar.offsetHeight : 0;
    }

    clearOpen(): void {
        this.openIndex = -1;
        if (!this.menuHost) {
            return;
        }
        this.menuHost.querySelectorAll('.app-titlebar-item').forEach((node: Element) => {
            node.classList.remove('open');
        });
    }

    openMenu(index: number): void {
        if (!this.menuHost) {
            return;
        }
        let buttons: NodeListOf<HTMLButtonElement> = this.menuHost.querySelectorAll('.app-titlebar-item');
        let button: HTMLButtonElement | undefined = buttons[index];
        if (!button) {
            return;
        }
        this.menuHost.querySelectorAll('.app-titlebar-item').forEach((node: Element) => {
            node.classList.remove('open');
        });
        this.openIndex = index;
        button.classList.add('open');
        let rect: DOMRect = button.getBoundingClientRect();
        ipcRenderer.send('popup-app-menu', {
            index: index,
            x: Math.round(rect.left),
            y: Math.round(rect.bottom)
        });
    }

    renderMenu(items: { label: string }[]): void {
        let menuHost: HTMLElement | null = this.menuHost;
        if (!menuHost) {
            return;
        }
        menuHost.innerHTML = '';
        items.forEach((item: { label: string }, index: number) => {
            let button: HTMLButtonElement = document.createElement('button');
            button.type = 'button';
            button.className = 'app-titlebar-item';
            button.innerText = (item.label || '').replace(/&/g, '');
            button.addEventListener('click', () => {
                this.openMenu(index);
            });
            button.addEventListener('mouseenter', () => {
                if (this.openIndex >= 0 && this.openIndex !== index) {
                    this.openMenu(index);
                }
            });
            menuHost.appendChild(button);
        });
    }
}
