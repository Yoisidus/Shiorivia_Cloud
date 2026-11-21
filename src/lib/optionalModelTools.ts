import "server-only";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerLocalProvider } from "./localProviderServer";

type Provider = { id: string; apiKey: string; baseURL?: string };
export type ToolPlan = { image: boolean; webQuery: string | null };
type ModelMessage = { role: string; content: unknown };
type Choice = { tool: "generate_image" | "web_search" | "done"; query?: string };

const textContent = (content: unknown) => typeof content === "string" ? content : JSON.stringify(content ?? "");
const excerpt = (messages: ModelMessage[]) =>
  messages.slice(-6).map(message => message.role + ": " + textContent(message.content).slice(0, 1400)).join("\n");

async function ask(provider: Provider, model: string, system: string, user: string): Promise<string> {
  if (provider.id === "google") {
    const google = new GoogleGenerativeAI(provider.apiKey);
    const engine = google.getGenerativeModel({ model: model.replace(/^google\//, ""), systemInstruction: system });
    return (await engine.generateContent(user)).response.text();
  }
  const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, fetch: globalThis.fetch });
  const response = await client.chat.completions.create({
    model, stream: false, temperature: 0.1,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return response.choices[0]?.message?.content || "";
}

function decodeChoice(raw: string): Choice {
  const cleaned = raw.trim().replace(/^`{3}(?:json)?\s*\n?/i, "").replace(/\n?`{3}$/, "").trim();
  const answer = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
  let parsed: unknown;
  try { parsed = JSON.parse(answer); } catch { throw new Error("工具规划模型未返回有效 JSON。"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("工具规划模型返回格式错误。");
  const value = parsed as Record<string, unknown>;
  if (!["generate_image", "web_search", "done"].includes(String(value.tool)))
    throw new Error("工具规划模型选择了未知的工具。");
  if (value.tool === "web_search" && (typeof value.query !== "string" || !value.query.trim() || value.query.length > 400))
    throw new Error("联网搜索工具缺少有效的搜索词。");
  return { tool: value.tool as Choice["tool"], ...(typeof value.query === "string" ? { query: value.query.trim() } : {}) };
}

/** Selection only: never invoke drawing or search unless the model chooses that tool. */
export async function planOptionalTools(input: {
  provider: Provider; model: string; messages: ModelMessage[];
  allowImage: boolean; allowWeb: boolean;
}): Promise<ToolPlan> {
  const plan: ToolPlan = { image: false, webQuery: null };
  if (!input.allowImage && !input.allowWeb) return plan;
  const available = [
    ...(input.allowImage ? ['generate_image: request a new illustration when visual output would materially help the response. Selecting this exposes the existing <draw> protocol; rendering still requires a separate user confirmation.'] : []),
    ...(input.allowWeb ? ['web_search: look up up-to-date external facts, docs or references; required argument query is a concise search query. Use only if external verification is needed.'] : []),
  ];
  const history = excerpt(input.messages);
  const calls: string[] = [];
  // Max one selection per type, no search/image API call until the model selects it.
  for (let i = 0; i < 3; i++) {
    const choices = available.filter(x => !calls.some(name => x.startsWith(name + ":")));
    const sys = [
      "You decide whether the current user request needs an optional tool. Tools can be omitted.",
      "Only these tools are enabled:", ...choices,
      'Reply with exactly one JSON object: {"tool":"done"}, {"tool":"generate_image"}, or {"tool":"web_search","query":"..."} when listed.',
      "Never choose a disabled or already used tool. Do not add explanations or markdown.",
      "For ordinary text conversation without a visual need or fresh factual lookup, choose done.",
      "Tool results are used by a separate final response. Do not write the final response here.",
    ].join("\n");
    const choice = decodeChoice(await ask(input.provider, input.model, sys,
      history + "\nTools already chosen: " + (calls.join(", ") || "none") + "\nChoose next tool or done."));
    if (choice.tool === "done") break;
    if (choice.tool === "generate_image") {
      if (!input.allowImage || plan.image) throw new Error("生图规划器返回了禁用或重复的工具。");
      plan.image = true;
    } else {
      if (!input.allowWeb || plan.webQuery) throw new Error("搜索规划器返回了禁用或重复的工具。");
      plan.webQuery = choice.query || null;
    }
    calls.push(choice.tool);
    if (calls.length === available.length) break;
  }
  return plan;
}

/**
 * A provider/model-specific web tool invocation, never a hidden Tavily fallback.
 * Fails explicitly if the provider or model does not expose a compatible tool.
 */
export async function searchWithProvider(query: string, providerId: string, modelId: string): Promise<string> {
  const provider = getServerLocalProvider(providerId);
  const model = modelId.trim();
  if (!provider) throw new Error("联网搜索供应商尚未正确配置。");
  if (!model) throw new Error("联网搜索模型 ID 不能为空。");
  if (provider.id === "fal") throw new Error("fal.ai 是图像供应商，不支持文本联网搜索。");
  try {
    if (provider.id === "google") {
      const google = new GoogleGenerativeAI(provider.apiKey);
      const engine = google.getGenerativeModel({
        model: model.replace(/^google\//, ""), tools: [{ googleSearch: {} } as any],
      });
      const response = (await engine.generateContent(
        "Search the live web to answer this factual query. Give a concise factual result and cite original source URLs when possible:\n" + query
      )).response;
      const grounded = response.candidates?.some(candidate => Boolean((candidate as any).groundingMetadata?.groundingChunks?.length));
      if (!grounded) throw new Error("Google 模型未返回联网检索依据，无法确认已实际搜索。");
      const refs = (response.candidates || []).flatMap(candidate =>
        (((candidate as any).groundingMetadata?.groundingChunks || []) as any[])
          .map(chunk => chunk?.web?.uri).filter((url): url is string => typeof url === "string")
      );
      return response.text() + "\nSources:\n" + [...new Set(refs)].slice(0, 8).join("\n");
    }
    if (provider.id === "openrouter") {
      // OpenRouter's web tool may fall back to third-party search even
      // with native requested on unsupported models. Fail closed for unknown
      // model families rather than silently changing the engine.
      const supportedFamily = /^(?:openai\/(?:gpt-(?:4\.1|5|[6-9])(?:[.\w-]*)?|o[34](?:[.\w-]*)?)|anthropic\/claude-(?:3[.-]5-haiku|3[.-]7|[4-9])\S*|google\/gemini-(?:3|[4-9])\S*|x-ai\/grok-(?:4|[5-9])\S*|perplexity\/\S+)$/i.test(model);
      if (!supportedFamily) throw new Error("当前 OpenRouter 模型不在已验证的原生联网搜索家族中；已停止调用以防使用第三方回退。请改用支持原生联网的模型或自定义提供商。");
      // Use OpenRouter's current model-callable server tool rather than the deprecated plugin.

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + provider.apiKey,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Shiorivia Local",
        },
        body: JSON.stringify({
          model, stream: false, tools: [{ type: "openrouter:web_search", parameters: { engine: "native", max_results: 5 } }],
          messages: [{ role: "user", content: "Use web search to research this query; return factual findings with source links:\n" + query }],
        }),
        signal: AbortSignal.timeout(45000), cache: "no-store",
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "OpenRouter HTTP " + res.status);
      const message = data?.choices?.[0]?.message;
      if (typeof message?.content !== "string" || !message.content.trim()) throw new Error("OpenRouter 未返回可用的搜索结果。");
      const citations = Array.isArray(message.annotations) ? message.annotations
        .map((annotation: any) => annotation?.url_citation?.url)
        .filter((url: unknown): url is string => typeof url === "string" && /^https?:\/\//.test(url))
        .slice(0, 10) : [];
      if (!citations.length) throw new Error("OpenRouter 未返回实际联网检索的来源引用；已拒绝将普通模型回答冒充搜索结果。");
      return message.content + "\nSources:\n" + [...new Set(citations)].join("\n");
    }
    if (provider.id === "deepseek") {
      throw new Error("当前 DeepSeek 接口未提供兼容的内置联网搜索工具；请选择其他搜索供应商。");
    }
    // OpenAI-compatible user endpoints: attempt the native Responses web_search tool.
    // Unsupported endpoints must surface their own error. Do NOT fall back to ordinary chat.
    const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, fetch: globalThis.fetch });
    const result = await client.responses.create({
      model, input: "Search the live web and provide concise sourced findings:\n" + query,
      tools: [{ type: "web_search" }],
    } as any);
    const resultItems = (result as any).output;
    if (!Array.isArray(resultItems) || !resultItems.some((item: any) => item?.type === "web_search_call"))
      throw new Error("搜索供应商未报告实际 web_search 工具调用。");
    const reply = (result as any).output_text;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("搜索供应商没有返回可用结果。");
    return reply;
  } catch (error) {
    throw new Error("模型联网搜索失败（" + provider.id + " / " + model + "）：" +
      (error instanceof Error ? error.message : "未知错误"));
  }
}
