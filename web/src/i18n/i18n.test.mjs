import assert from 'node:assert/strict';
import en from './messages/en.js';
import zhCN from './messages/zh-CN.js';
import { createTranslator, translateText } from './index.js';
import { resolveLocale } from './locale.js';
import manifest from '../../../docs/i18n/locale-key-manifest.json' with { type: 'json' };

const enKeys = Object.keys(en.messages).sort();
const zhKeys = Object.keys(zhCN.messages).sort();
assert.deepEqual(enKeys, zhKeys, 'English and Chinese dictionaries must have identical key sets');
assert.deepEqual(enKeys, [...manifest.keys].sort(), 'locale key manifest must match dictionaries');
assert.deepEqual(Object.keys(en.legacy).sort(), Object.keys(zhCN.legacy).sort(), 'Legacy key sets must match');

const placeholder = (value) => [...String(value).matchAll(/\{(\w+)(?:,|\})/g)].map((match) => match[1]).sort();
for (const key of enKeys) assert.deepEqual(placeholder(en.messages[key]), placeholder(zhCN.messages[key]), `placeholder mismatch: ${key}`);

const translate = createTranslator('en');
assert.equal(translate('settings.languageChanged', { language: 'English' }), 'Language changed to English.');
assert.equal(translate('count.nodes', { count: 1 }), '1 node');
assert.equal(translate('count.nodes', { count: 3 }), '3 nodes');
assert.equal(translate('node.skillsCount', { count: 1 }), '1 skill');
assert.equal(translate('node.skillsCount', { count: 2 }), '2 skills');
assert.equal(translate('status.charsCount', { count: 1 }), '1 char');
assert.equal(translate('status.charsCount', { count: 2 }), '2 chars');
assert.equal(translateText('添加节点', 'en'), 'Add node');
assert.equal(translateText('添加节点', 'zh-CN'), '添加节点');
assert.equal(createTranslator('zh-CN')('settings.languageChanged', { language: 'English' }), '界面语言已切换为English。');
assert.equal(resolveLocale({ languages: ['fr-FR', 'en-US'] }), 'en');
assert.equal(resolveLocale({ languages: ['zh-Hans', 'en-US'] }), 'zh-CN');
console.log('i18n tests passed');
