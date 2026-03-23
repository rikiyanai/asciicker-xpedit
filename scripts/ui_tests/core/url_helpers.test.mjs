import { strict as assert } from 'node:assert';
import { resolveRoute } from './url_helpers.mjs';

// Root-hosted
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/workbench'),
  'http://127.0.0.1:5071/workbench'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/wizard'),
  'http://127.0.0.1:5071/wizard'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/termpp-skin-lab'),
  'http://127.0.0.1:5071/termpp-skin-lab'
);

// Prefixed
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/workbench'),
  'http://127.0.0.1:5073/xpedit/workbench'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/wizard'),
  'http://127.0.0.1:5073/xpedit/wizard'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/termpp-skin-lab'),
  'http://127.0.0.1:5073/xpedit/termpp-skin-lab'
);

// Query params on baseUrl stripped
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench?job_id=123', '/wizard'),
  'http://127.0.0.1:5073/xpedit/wizard'
);

// Deep prefix
assert.equal(
  resolveRoute('http://host/a/b/workbench', '/wizard'),
  'http://host/a/b/wizard'
);

console.log('url_helpers: all tests passed');
