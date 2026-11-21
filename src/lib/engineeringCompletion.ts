/** Officina code-file protocol is optional for conversation, required for requested complete files. */
export function engineeringOutputIncomplete(userText: string, answer: string): boolean {
  const result = String(answer || "").trim();
  if (!result) return false;
  const opens = (result.match(/<file\b[^>]*>/gi) || []).length;
  const closes = (result.match(/<\/file>/gi) || []).length;
  if (opens !== closes) return true;
  const requestsWholeFile = /(?:完整(?:代码|文件)|生成(?:一份|一个|完整)?(?:文件|组件|脚本)|写(?:一份|一个|完整)?(?:文件|组件|脚本)|创建(?:一份|一个|完整)?(?:文件|组件|脚本)|implement (?:a |the )?(?:file|component)|write (?:a |the )?(?:file|script)|create (?:a |the )?(?:file|component))/i.test(userText);
  return requestsWholeFile && opens === 0;
}

export const OFFICINA_COMPLETION_REQUEST =
  "请检查上一条工程回复的文件输出协议：如用户要求生成完整可执行文件，但上一条缺失 <file name=\"filename.ext\">...</file> 块，请补全缺少的完整代码文件；如上一条文件块未闭合，请完整重发该文件。不要重复无关解释，不要伪造没有要求的文件。";
