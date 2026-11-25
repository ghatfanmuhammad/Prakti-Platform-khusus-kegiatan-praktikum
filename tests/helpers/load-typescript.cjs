const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute production TS against explicitly supplied adapters (no native runtime).
module.exports = function load(filename, adapters = {}, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (request) => {
    if (Object.hasOwn(adapters, request)) return adapters[request];
    if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), `${request}.ts`), adapters, cache);
    return require(request);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
};
