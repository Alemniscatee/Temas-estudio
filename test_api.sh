#!/usr/bin/env bash
# ============================================================
# Prueba de los 3 modelos de MODEL_CONFIGS contra la API real.
# La key NUNCA se imprime; .api_key se elimina al terminar.
# ============================================================

KEY_FILE=".api_key"
if [ ! -f "$KEY_FILE" ]; then
  echo "❌ No existe .api_key. Créalo con tu key (una línea) y reintenta."
  exit 1
fi

KEY="$(tr -d ' \t\r\n' < "$KEY_FILE")"
[ -z "$KEY" ] && { echo "❌ .api_key vacío"; rm -f "$KEY_FILE"; exit 1; }

echo "Key cargada (${#KEY} caracteres, no se mostrará)."
echo "=== Prueba de los 3 modelos de MODEL_CONFIGS (shape real de la app) ==="

MODELS=("gemini-3.5-flash-lite" "gemini-3.8-flash" "gemini-3.1-pro-preview")
PROMPT='Actúa como un mentor experto. Enseña un concepto profundo de Matematicas Aplicadas y Logica. Responde SOLO con JSON valido: {"id":"u1","titulo":"...","categoria":"...","explicacion_informal":"...","profundidad":"<p>...</p>","esquema_visual":"ascii"}'
# El body se serializa con JSON.stringify (como hace la app) para que las
# comillas del prompt no rompan el payload:
BODY=$(node -e "
console.log(JSON.stringify({
  contents: [{ parts: [{ text: process.argv[1] }] }],
  generationConfig: { temperature: 1.0, maxOutputTokens: 4096, responseMimeType: 'application/json' }
}));" "$PROMPT")

FALLAS=0
for M in "${MODELS[@]}"; do
  printf "%-24s " "$M"
  CODE=$(curl -s --max-time 60 -o rlv_body.json -w "%{http_code}" \
    -X POST "https://generativelanguage.googleapis.com/v1beta/models/${M}:generateContent?key=${KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  echo "→ HTTP $CODE"
  node -e "
const fs=require('fs');
try{
  const d=JSON.parse(fs.readFileSync('rlv_body.json','utf8'));
  if(d.error){ console.log('    ✗ ' + d.error.code + ' · ' + d.error.message.slice(0,110)); process.exit(1); }
  const raw=(d.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  const j=JSON.parse(raw);
  console.log('    ✓ JSON válido · finish: ' + (d.candidates?.[0]?.finishReason||'?') + ' · titulo: ' + JSON.stringify((j.titulo||'').slice(0,55)));
}catch(e){ console.log('    ? cuerpo no parseable: ' + e.message); process.exit(2); }
"
  RC=$?
  if [ $RC -eq 1 ]; then FALLAS=$((FALLAS+1)); fi
done

rm -f rlv_body.json "$KEY_FILE"
echo ""
[ $FALLAS -eq 0 ] && echo "✅ 3/3 modelos operativos. .api_key eliminado del disco." || echo "⚠️ $FALLAS falla(s). .api_key eliminado del disco."
exit $FALLAS
