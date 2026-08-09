#!/usr/bin/env node
// Guarda do prompt da Lia.
//
// Existem dois artefatos: o .txt, que é a fonte no Git, e o .b64.ts, que é o
// que realmente executa (o runtime do edge não empacota .txt solto). Se alguém
// editar o .txt e esquecer de regerar o .b64.ts, o hash continua batendo, a Lia
// segue rodando o prompt antigo e o repositório passa a dizer uma coisa
// diferente do que está no ar. Regra escrita não resolve; verificação resolve.
//
//   node scripts/lia-prompt.mjs --gerar      reescreve o .b64.ts a partir do .txt
//   node scripts/lia-prompt.mjs --verificar  falha se .txt, .b64.ts e registro divergirem
//
// O verificador fecha o triângulo: bytes do .txt = bytes do .b64.ts = hash
// registrado em ia_prompt_versoes (espelhado em registro.json).

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = `${RAIZ}/supabase/functions/lia-brain/prompt`;
const VERSAO = "lia-canoas-v3.1";

export const CAMINHOS = {
  txt: `${DIR}/${VERSAO}.txt`,
  b64: `${DIR}/${VERSAO}.b64.ts`,
  registro: `${DIR}/registro.json`,
};

const COMANDO_REGERAR = "node scripts/lia-prompt.mjs --gerar";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function quebrar(b64) {
  const linhas = [];
  for (let i = 0; i < b64.length; i += 100) linhas.push(b64.slice(i, i + 100));
  return linhas.join("\n");
}

export function gerar() {
  const bytes = readFileSync(CAMINHOS.txt);
  const hash = sha256(bytes);
  const corpo =
    `// GERADO A PARTIR DE ${VERSAO}.txt - nao editar a mao.\n` +
    `// O runtime do edge nao empacota .txt, entao os BYTES CRUS do arquivo viajam\n` +
    `// aqui em base64. O hash e calculado sobre os bytes decodificados, identicos\n` +
    `// aos do .txt. Regerar com: ${COMANDO_REGERAR}\n` +
    `// SHA-256: ${hash}\n` +
    `export const LIA_PROMPT_B64 = \`\n${quebrar(bytes.toString("base64"))}\n\`.replace(/\\s+/g, "");\n`;
  writeFileSync(CAMINHOS.b64, corpo);
  return { hash, bytes: bytes.length };
}

/**
 * Confere .txt x .b64.ts x hash registrado. Devolve a lista de problemas —
 * vazia quer dizer aprovado.
 */
export function verificar() {
  const problemas = [];

  const bytesTxt = readFileSync(CAMINHOS.txt);
  const hashTxt = sha256(bytesTxt);

  const fonteB64 = readFileSync(CAMINHOS.b64, "utf8");
  const casado = /LIA_PROMPT_B64\s*=\s*`([\s\S]*?)`/.exec(fonteB64);
  if (!casado) {
    problemas.push(`Não achei LIA_PROMPT_B64 em ${VERSAO}.b64.ts. Regere com: ${COMANDO_REGERAR}`);
    return problemas;
  }

  const bytesB64 = Buffer.from(casado[1].replace(/\s+/g, ""), "base64");
  if (!bytesB64.equals(bytesTxt)) {
    problemas.push(
      `O .b64.ts não bate com o .txt (${bytesTxt.length} bytes no arquivo, ` +
        `${bytesB64.length} no gerado). Alguém editou o prompt sem regerar. ` +
        `Rode: ${COMANDO_REGERAR}`,
    );
  }

  const registro = JSON.parse(readFileSync(CAMINHOS.registro, "utf8"));
  if (registro.versao !== VERSAO) {
    problemas.push(`registro.json aponta para ${registro.versao}, esperado ${VERSAO}.`);
  }
  if (registro.hash_sha256 !== hashTxt) {
    problemas.push(
      `O hash registrado em ia_prompt_versoes (${registro.hash_sha256}) não bate com o ` +
        `arquivo (${hashTxt}). Ou o prompt mudou sem novo registro, ou o registro mudou ` +
        `sem o arquivo. A Lia bloqueia em runtime nesse caso.`,
    );
  }

  return problemas;
}

const executadoDireto = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (executadoDireto) {
  const modo = process.argv[2] ?? "--verificar";
  if (modo === "--gerar") {
    const { hash, bytes } = gerar();
    console.log(`prompt da Lia regerado: ${bytes} bytes, sha256 ${hash}`);
    console.log("Se o conteúdo mudou, atualize também registro.json e ia_prompt_versoes.");
  } else {
    const problemas = verificar();
    if (problemas.length > 0) {
      console.error("Guarda do prompt da Lia reprovou:");
      for (const p of problemas) console.error(` - ${p}`);
      process.exit(1);
    }
    console.log("Guarda do prompt da Lia: .txt = .b64.ts = registro.");
  }
}
