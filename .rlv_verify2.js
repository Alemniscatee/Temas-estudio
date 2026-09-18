const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Extraer y compilar el JS inline (chequeo de sintaxis sin ejecutar)
const m = html.match(/<script>([\s\S]*?)<\/script>/);
new Function(m[1]);
console.log('PASS  Sintaxis JS inline');

// Requisitos literales del spec (búsqueda de cadena exacta)
const checks = [
  ['MODEL_CONFIGS: 1.5-flash-latest', "const MODEL_CONFIGS = {\n      'gemini-1.5-flash-latest': { maxTokens: 2048, delayMs: 2500, retry429Ms: 12000 },\n      'gemini-2.0-flash-exp':    { maxTokens: 4096, delayMs: 3000, retry429Ms: 15000 },\n      'gemini-1.5-pro-latest':   { maxTokens: 4096, delayMs: 4500, retry429Ms: 20000 }\n    };"],
  ['getSelectedModel con trim', "return (localStorage.getItem(LS_MODEL) || 'gemini-1.5-flash-latest').trim();"],
  ['Bloque HTML del select (literal)', '<option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Rápido, Cuota amplia)</option>'],
  ['option 2.0-flash-exp', '<option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>'],
  ['option 1.5-pro-latest', '<option value="gemini-1.5-pro-latest">Gemini 1.5 Pro (Razonamiento profundo)</option>'],
  ['save con trim', "localStorage.setItem(LS_MODEL, el.modelSelect.value.trim());"],
  ['model + fallback', "const config = MODEL_CONFIGS[model] || MODEL_CONFIGS['gemini-1.5-flash-latest'];"],
  ['cleanApiKey', 'const cleanApiKey = apiKey.trim();'],
  ['apiUrl dinámica', 'const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;']
];

let fails = 0;
for (const [name, needle] of checks) {
  const ok = html.includes(needle);
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
}

// IDs viejos NO deben quedar en value/configs (los textos de UI ya no los usan)
for (const old of ['"gemini-1.5-flash"', "'gemini-1.5-flash'", "'gemini-2.0-flash'", "'gemini-1.5-pro'"]) {
  const ok = !html.includes(old);
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL') + '  sin resto de: ' + old);
}

// Coherencia del fetch
console.log((html.includes('await fetch(apiUrl') && !html.includes('await fetch(url') ? 'PASS' : 'FAIL') + '  fetch usa apiUrl');
process.exit(fails ? 1 : 0);
