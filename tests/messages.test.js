// docs/MESSAGES.md is generated from the code (tools/messages.js). This fails when a
// messageBus topic, payload or publisher/subscriber changed without regenerating the doc.
// Fix: npm run docs:messages (hand-written Notes are kept).

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { generate, DOC } = require('../tools/messages');

it('docs/MESSAGES.md matches the messageBus usage in the code', () => {
    const current = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
    assert.ok(current === generate(), 'docs/MESSAGES.md is out of date — run `npm run docs:messages`');
});
