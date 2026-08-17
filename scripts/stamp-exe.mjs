#!/usr/bin/env node
/*******************************************************************************
 * Stamp a Windows Electron executable with Swordfish icon and version info.
 * Runs on Linux/macOS via the pure-JS resedit library (no Wine required).
 *******************************************************************************/

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import * as ResEdit from 'resedit';

const { values } = parseArgs({
    options: {
        exe: { type: 'string' },
        png: { type: 'string' },
        version: { type: 'string', default: '5.26.0' },
        name: { type: 'string', default: 'Swordfish' },
        description: { type: 'string', default: 'Swordfish Translation Editor' },
        company: { type: 'string', default: 'Maxprograms' },
        copyright: { type: 'string', default: 'Copyright (c) 2007-2026 Maxprograms' }
    }
});

if (!values.exe || !values.png) {
    console.error('Usage: stamp-exe.mjs --exe Swordfish.exe --png icon.png --version 5.26.0');
    process.exit(1);
}

const versionParts = values.version.split('.').map((part) => Number.parseInt(part, 10) || 0);
while (versionParts.length < 4) {
    versionParts.push(0);
}
const versionMS = ((versionParts[0] & 0xffff) << 16) | (versionParts[1] & 0xffff);
const versionLS = ((versionParts[2] & 0xffff) << 16) | (versionParts[3] & 0xffff);

function pngToIco(png) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0);
    entry.writeUInt8(0, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(22, 12);
    return Buffer.concat([header, entry, png]);
}

const exe = ResEdit.NtExecutable.from(readFileSync(values.exe), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const lang = 1033;

const iconFile = ResEdit.Data.IconFile.from(pngToIco(readFileSync(values.png)));
const existingIcons = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const iconId = existingIcons.length > 0 ? existingIcons[0].id : 1;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    iconId,
    lang,
    iconFile.icons.map((icon) => icon.data)
);

const versionList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const versionInfo = versionList.length > 0 ? versionList[0] : ResEdit.Resource.VersionInfo.createEmpty();
versionInfo.fixedInfo.fileVersionMS = versionMS;
versionInfo.fixedInfo.fileVersionLS = versionLS;
versionInfo.fixedInfo.productVersionMS = versionMS;
versionInfo.fixedInfo.productVersionLS = versionLS;
versionInfo.fixedInfo.fileFlags = 0;
versionInfo.fixedInfo.fileOS = 0x00040004;
versionInfo.fixedInfo.fileType = 1;
versionInfo.fixedInfo.fileSubtype = 0;
versionInfo.setStringValues(
    { lang, codepage: 1200 },
    {
        CompanyName: values.company,
        FileDescription: values.description,
        FileVersion: values.version,
        InternalName: values.name,
        LegalCopyright: values.copyright,
        OriginalFilename: `${values.name}.exe`,
        ProductName: values.name,
        ProductVersion: values.version
    }
);
versionInfo.outputToResourceEntries(res.entries);

res.outputResource(exe, true);
writeFileSync(values.exe, Buffer.from(exe.generate()));
console.log(`Stamped ${values.exe} (${values.name} ${values.version})`);
