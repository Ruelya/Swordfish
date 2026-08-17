/*******************************************************************************
 * End-to-end lifecycle test against a live TmsServer and a local mock AI.
 *******************************************************************************/

import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyAlignedTargets, asTextPairs, buildAlignPrompt, buildTermsPrompt, parseJsonPayload, stripHtml, xmlTarget } from "./aiJsonTasks.js";
import { CustomAITranslator } from "./customAITranslator.js";

const TMS = process.env.TMS_URL || 'http://127.0.0.1:18070';
const AI_PORT = Number(process.env.AI_PORT || '8765');
const WORK = process.env.E2E_WORK || '/tmp/swordfish-e2e-work';
const SUCCESS = 'Success';

function assert(condition: unknown, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

async function post(path: string, body: Record<string, unknown>): Promise<any> {
    let response: Response = await fetch(TMS + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
    });
    let text: string = await response.text();
    if (!response.ok) {
        throw new Error(path + ' HTTP ' + response.status + ' ' + text);
    }
    return JSON.parse(text);
}

async function waitForProcess(processId: string, timeoutMs: number = 60000): Promise<any> {
    let start: number = Date.now();
    while (Date.now() - start < timeoutMs) {
        let data: any = await post('/projects/status', { process: processId });
        if (data.progress === 'Completed') {
            return data;
        }
        if (data.progress === 'Error') {
            throw new Error(data.reason || 'process failed');
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('timeout waiting for process ' + processId);
}

function parseNumberedBlock(text: string, label: string): string[] {
    let match: RegExpMatchArray | null = text.match(new RegExp(label + ':\\n([\\s\\S]*?)(?:\\n\\n|$)'));
    if (!match) {
        return [];
    }
    return match[1].split('\n').map((line: string) => line.replace(/^\d+\.\s*/, '').trim()).filter((line: string) => line.length > 0);
}

function startMockAi(): Server {
    return createServer((req: IncomingMessage, res: ServerResponse) => {
        let chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            let raw: string = Buffer.concat(chunks).toString('utf8');
            let prompt: string = '';
            try {
                let json: any = JSON.parse(raw || '{}');
                if (Array.isArray(json.messages)) {
                    prompt = json.messages.map((item: any) => String(item.content || '')).join('\n');
                } else {
                    prompt = String(json.prompt || json.input || raw);
                }
            } catch (_error) {
                prompt = raw;
            }
            let content: string;
            if (prompt.includes('Align these bilingual')) {
                let sources: string[] = parseNumberedBlock(prompt, 'SOURCE');
                let targets: string[] = parseNumberedBlock(prompt, 'TARGET');
                let pairs: Array<{ source: string, target: string }> = [];
                let count: number = Math.min(sources.length, targets.length);
                for (let i = 0; i < count; i++) {
                    pairs.push({ source: sources[i], target: targets[i] });
                }
                content = JSON.stringify(pairs);
            } else if (prompt.includes('Extract bilingual terminology')) {
                content = JSON.stringify([
                    { source: 'file', target: '文件' },
                    { source: 'document', target: '文档' }
                ]);
            } else {
                content = 'OK';
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content: content } }] }));
        });
    }).listen(AI_PORT, '127.0.0.1');
}

async function fetchAllSegments(projectId: string): Promise<any[]> {
    let countData: any = await post('/projects/count', { project: projectId });
    if (countData.status && countData.status !== SUCCESS) {
        throw new Error('count failed: ' + JSON.stringify(countData));
    }
    let total: number = countData.count || 0;
    let segments: any[] = [];
    for (let start: number = 0; start < total; start += 200) {
        let page: any = await post('/projects/segments', {
            project: projectId,
            start: start,
            count: 200,
            filterText: '',
            filterLanguage: 'source',
            caseSensitiveFilter: false,
            regExp: false,
            showUntranslated: true,
            showTranslated: true,
            showConfirmed: true,
            showReviewed: true,
            sortOption: 'none',
            sortDesc: false
        });
        if (Array.isArray(page.segments)) {
            segments = segments.concat(page.segments);
        }
    }
    return segments;
}

async function createProject(name: string, files: string[], srcLang: string, tgtLang: string): Promise<string> {
    let typed: any = await post('/services/getFileType', { files: files });
    assert(typed.status === SUCCESS, 'getFileType: ' + JSON.stringify(typed));
    assert(Array.isArray(typed.files) && typed.files.length > 0, 'no typed files');
    for (let file of typed.files) {
        assert(file.type && file.type !== 'Unknown', 'unknown type for ' + file.file + ': ' + JSON.stringify(file));
        if (!file.encoding || file.encoding === 'Unknown') {
            file.encoding = 'UTF-8';
        }
    }
    let created: any = await post('/projects/create', {
        description: name,
        files: typed.files,
        subject: '',
        client: '',
        srcLang: srcLang,
        tgtLang: tgtLang,
        memory: 'none',
        applyTM: false,
        glossary: 'none',
        searchTerms: false,
        xmlfilter: join(process.cwd(), 'xmlfilter'),
        from: 'e2e'
    });
    assert(created.status === SUCCESS, 'create: ' + JSON.stringify(created));
    await waitForProcess(created.process);
    return created.process;
}

async function main(): Promise<void> {
    mkdirSync(WORK, { recursive: true });
    let sourceFile: string = join(WORK, 'manual.md');
    let targetFile: string = join(WORK, 'manual-zh.md');
    writeFileSync(sourceFile, 'Open the file.\n\nSave the document.\n', 'utf8');
    writeFileSync(targetFile, '打开文件。\n\n保存文档。\n', 'utf8');

    let mock: Server = startMockAi();
    try {
        let version: any = await post('/', { command: 'version' });
        assert(version.tool === 'TMSServer' || version.status === 'OK' || version.version, 'server version: ' + JSON.stringify(version));

        let projectId: string = await createProject('E2E Lifecycle', [sourceFile], 'en', 'zh');
        let sourceSegments: any[] = await fetchAllSegments(projectId);
        assert(sourceSegments.length >= 2, 'expected at least 2 source segments, got ' + sourceSegments.length);

        let memoryId: string = 'mem-e2e-' + Date.now();
        let memory: any = await post('/memories/create', {
            id: memoryId,
            name: 'E2E Lifecycle TM',
            project: 'E2E Lifecycle',
            subject: '',
            client: ''
        });
        assert(memory.status === SUCCESS, 'create memory: ' + JSON.stringify(memory));
        let setMemory: any = await post('/projects/setMemory', { project: projectId, memory: memoryId });
        assert(setMemory.status === SUCCESS, 'setMemory: ' + JSON.stringify(setMemory));

        let targetProjectId: string = await createProject('E2E Lifecycle · align-tgt', [targetFile], 'zh', 'en');
        let targetSegments: any[] = await fetchAllSegments(targetProjectId);
        assert(targetSegments.length >= 2, 'expected at least 2 target segments, got ' + targetSegments.length);

        let translator: CustomAITranslator = new CustomAITranslator({
            enabled: true,
            name: 'Mock AI',
            baseUrl: 'http://127.0.0.1:' + AI_PORT + '/v1',
            apiKey: 'test',
            model: 'mock',
            format: 'openai-chat',
            requestTemplate: '',
            responsePath: 'choices.0.message.content',
            extraHeaders: '',
            fixTags: false
        });
        translator.setSourceLanguage('en');
        translator.setTargetLanguage('zh');

        let sourceTexts: string[] = sourceSegments.map((segment: any) => stripHtml(segment.source || '')).filter((text: string) => text.length > 0);
        let targetTexts: string[] = targetSegments.map((segment: any) => stripHtml(segment.source || '') || stripHtml(segment.target || '')).filter((text: string) => text.length > 0);
        let rawAlign: string = await translator.complete(
            buildAlignPrompt('en', 'zh', sourceTexts, targetTexts),
            'You align bilingual sentences. Reply with JSON only.'
        );
        let pairs = asTextPairs(parseJsonPayload(rawAlign));
        assert(pairs.length >= 2, 'aligned pairs: ' + JSON.stringify(pairs));

        let mapped = applyAlignedTargets(sourceSegments.map((segment: any) => {
            return {
                file: segment.file,
                unit: segment.unit,
                segment: segment.segment,
                text: stripHtml(segment.source || '')
            };
        }), pairs);
        assert(mapped.length >= 2, 'mapped targets: ' + mapped.length);
        for (let item of mapped) {
            let setTarget: any = await post('/projects/setTarget', {
                project: projectId,
                file: item.file,
                unit: item.unit,
                segment: item.segment,
                target: xmlTarget(item.target)
            });
            assert(setTarget.status === SUCCESS, 'setTarget: ' + JSON.stringify(setTarget));
        }

        let afterAlign: any[] = await fetchAllSegments(projectId);
        let translated: any[] = afterAlign.filter((segment: any) => stripHtml(segment.target || '') && segment.state === 'translated');
        assert(translated.length >= 2, 'aligned segments should be translated, got ' + JSON.stringify(afterAlign.map((segment: any) => ({ state: segment.state, target: stripHtml(segment.target || '') }))));
        assert(translated.some((segment: any) => stripHtml(segment.target || '').includes('打开')), 'missing 打开 in targets');
        assert(translated.some((segment: any) => stripHtml(segment.target || '').includes('保存')), 'missing 保存 in targets');

        let applyMt: any = await post('/projects/applyMtAll', { project: projectId, srcLang: 'en', tgtLang: 'zh' });
        assert(applyMt.status === SUCCESS, 'applyMtAll: ' + JSON.stringify(applyMt));
        if (applyMt.process) {
            await waitForProcess(applyMt.process);
        }
        let afterMt: any[] = await fetchAllSegments(projectId);
        for (let segment of afterMt) {
            let target: string = stripHtml(segment.target || '');
            if (target.includes('打开') || target.includes('保存')) {
                assert(segment.state !== 'initial', 'MT must not reset aligned state');
            }
        }

        let confirm: any = await post('/projects/confirmAllTranslations', { project: projectId, memory: memoryId });
        assert(confirm.status === SUCCESS, 'confirmAll: ' + JSON.stringify(confirm));
        if (confirm.process) {
            await waitForProcess(confirm.process);
        }
        let confirmed: any[] = await fetchAllSegments(projectId);
        assert(confirmed.filter((segment: any) => segment.state === 'final').length >= 2, 'expected confirmed segments');

        let tmxPath: string = join(WORK, 'E2E_Lifecycle.tmx');
        let exportTmx: any = await post('/projects/exportTmx', { project: projectId, output: tmxPath });
        assert(exportTmx.status === SUCCESS, 'exportTmx: ' + JSON.stringify(exportTmx));
        if (exportTmx.process) {
            await waitForProcess(exportTmx.process);
        }
        assert(existsSync(tmxPath), 'TMX was not written');
        let tmx: string = readFileSync(tmxPath, 'utf8');
        assert(tmx.includes('Open the file') || tmx.includes('Open the file.'), 'TMX missing source');
        assert(tmx.includes('打开'), 'TMX missing aligned target');

        let bilingual = afterMt.map((segment: any) => {
            return { source: stripHtml(segment.source || ''), target: stripHtml(segment.target || '') };
        }).filter((pair) => pair.source && pair.target);
        let rawTerms: string = await translator.complete(
            buildTermsPrompt('en', 'zh', bilingual),
            'You extract bilingual terminology. Reply with JSON only.'
        );
        let terms = asTextPairs(parseJsonPayload(rawTerms));
        assert(terms.length >= 2, 'extracted terms: ' + JSON.stringify(terms));

        let glossaryId: string = 'gls-e2e-' + Date.now();
        let glossary: any = await post('/glossaries/create', {
            id: glossaryId,
            name: 'E2E Lifecycle TB',
            project: 'E2E Lifecycle',
            subject: '',
            client: ''
        });
        assert(glossary.status === SUCCESS, 'create glossary: ' + JSON.stringify(glossary));
        for (let term of terms) {
            let added: any = await post('/glossaries/addTerm', {
                glossary: glossaryId,
                sourceTerm: term.source,
                targetTerm: term.target,
                srcLang: 'en',
                tgtLang: 'zh'
            });
            assert(added.status === SUCCESS, 'addTerm: ' + JSON.stringify(added));
        }
        let setGlossary: any = await post('/projects/setGlossary', { project: projectId, glossary: glossaryId });
        assert(setGlossary.status === SUCCESS, 'setGlossary: ' + JSON.stringify(setGlossary));
        let project: any = await post('/projects/get', { project: projectId });
        assert(project.glossary === glossaryId, 'project glossary not attached: ' + JSON.stringify(project));
        assert(project.memory === memoryId, 'project memory not attached: ' + JSON.stringify(project));

        let memories: any = await post('/memories/list', {});
        assert((memories.memories || []).some((item: any) => item.id === memoryId), 'memory missing from list');
        let glossaries: any = await post('/glossaries/list', {});
        assert((glossaries.glossaries || []).some((item: any) => item.id === glossaryId), 'glossary missing from list');

        let exportFolder: string = join(WORK, 'export');
        mkdirSync(exportFolder, { recursive: true });
        let exportFile: string = join(exportFolder, 'manual_zh.md');
        let exported: any = await post('/projects/translations', { project: projectId, output: exportFile });
        assert(exported.status === SUCCESS, 'export translations: ' + JSON.stringify(exported));
        if (exported.process) {
            await waitForProcess(exported.process);
        }
        assert(existsSync(exportFile), 'translated file was not written');
        let translatedFile: string = readFileSync(exportFile, 'utf8');
        assert(translatedFile.includes('打开') && translatedFile.includes('保存'), 'exported markdown missing aligned text: ' + translatedFile);

        await post('/projects/delete', { projects: [projectId, targetProjectId] });

        console.log(JSON.stringify({
            ok: true,
            projectId: projectId,
            aligned: mapped.length,
            confirmed: confirmed.filter((segment: any) => segment.state === 'final').length,
            memoryId: memoryId,
            glossaryId: glossaryId,
            terms: terms,
            tmxPath: tmxPath
        }, null, 2));
        console.log('lifecycle e2e passed');
    } finally {
        mock.close();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
});
