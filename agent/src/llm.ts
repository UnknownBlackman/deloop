// Invoice reading entry point.
// If LLM_BASE_URL, LLM_API_KEY and LLM_MODEL are set (any OpenAI-compatible API, e.g. NEAR AI Cloud),
// the LLM extracts fields under a strict JSON schema. Otherwise (or if the LLM call fails) the regex
// parser is used, so the demo always works without a key.
import { nearToYocto } from "./amount.ts";
import { parseInvoiceRegex, type ReadResult } from "./reader.ts";

const SCHEMA = {
  name: "invoice",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["invoice_ref", "creditor", "debtor", "amount_near"],
    properties: {
      invoice_ref: { type: "string", description: "Invoice reference, e.g. INV-A1" },
      creditor: { type: "string", description: "Short lowercase business id of the issuer (who is owed)" },
      debtor: { type: "string", description: "Short lowercase business id of the recipient (who owes)" },
      amount_near: { type: "string", description: "Total amount due in NEAR as a plain decimal string, e.g. \"10\" or \"7.5\"" },
    },
  },
} as const;

const PROMPT =
  "Extract the invoice fields. creditor = the business that issued the invoice and is owed money; " +
  "debtor = the business billed. Use the short lowercase business id (e.g. 'alpha' from 'Alpha Trading (alpha)'). " +
  "amount_near = the TOTAL due (not a line item), digits and optional decimal point only.";

export const llmEnabled = () => Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);

async function parseInvoiceLlm(file: string, text: string): Promise<ReadResult> {
  const res = await fetch(`${process.env.LLM_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: SCHEMA },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const out = JSON.parse(body.choices[0].message.content) as Record<string, string>;
  for (const k of SCHEMA.schema.required) {
    if (typeof out[k] !== "string" || !out[k].trim()) throw new Error(`LLM output missing ${k}`);
  }
  return {
    ok: true,
    invoice: {
      file,
      invoice_ref: out.invoice_ref.trim().toUpperCase(),
      creditor: out.creditor.trim().toLowerCase(),
      debtor: out.debtor.trim().toLowerCase(),
      amount: nearToYocto(out.amount_near),
      source: "llm",
    },
  };
}

export async function readInvoice(file: string, text: string): Promise<ReadResult> {
  if (!llmEnabled()) return parseInvoiceRegex(file, text);
  try {
    return await parseInvoiceLlm(file, text);
  } catch (e) {
    console.warn(`[reader] LLM failed for ${file} (${(e as Error).message}); using regex parser`);
    return parseInvoiceRegex(file, text);
  }
}
