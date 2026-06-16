// scripts/obfuscate.js
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

const input = fs.readFileSync('script.js', 'utf8');
const obfuscated = JavaScriptObfuscator.obfuscate(input, {
    compact: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    renameGlobals: false,
    selfDefending: true
}).getObfuscatedCode();

fs.writeFileSync('script.obfuscated.js', obfuscated);
console.log('Obfuscated script written to script.obfuscated.js');