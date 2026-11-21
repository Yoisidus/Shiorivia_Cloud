import { NextRequest, NextResponse } from "next/server";
import {
  listProjects, createProject, listWorkspaceFiles, readWorkspaceFile,
  searchWorkspace, createWorkspaceFolder, writeWorkspaceFile,
  deleteWorkspaceFile, workspaceSnapshot, previewWorkspaceEdit, applyWorkspaceEdit,
} from "../../../lib/ideWorkspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});
const fail = (error: unknown) => respond({ error: error instanceof Error ? error.message : "IDE 操作失败" }, 400);

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const action = query.get("action") || "projects";
  const project = query.get("project") || "";
  try {
    if (action === "projects") return respond({ projects: await listProjects() });
    if (action === "tree") return respond({ entries: await listWorkspaceFiles(project) });
    if (action === "snapshot") return respond({ files: await workspaceSnapshot(project) });
    if (action === "read") return respond(await readWorkspaceFile(project, query.get("path"), Number(query.get("start") || 1), Number(query.get("end") || 160)));
    if (action === "search") return respond({ matches: await searchWorkspace(project, query.get("query")) });
    return respond({ error: "不支持的 IDE 查询。" }, 400);
  } catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  // The IDE filesystem is intended for the locally hosted application only.
  // Disallow cross-site writes even if a browser tries to send a simple request.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return respond({ error: "Cross-origin IDE writes are forbidden." }, 403);
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return respond({ error: "无效请求" }, 400);
    if (body.action === "createProject") return respond({ project: await createProject(body.name) });
    if (body.action === "createFolder") {
      await createWorkspaceFolder(body.project, body.path);
      return respond({ success: true });
    }
    if (body.action === "previewEdit") {
      return respond(await previewWorkspaceEdit(body.project, body.path, body.edits));
    }
    if (body.action === "applyEdit") {
      await applyWorkspaceEdit(body.project, body.path, body.edits, body.version);
      return respond({ success: true });
    }
    if (body.action === "write") {
      await writeWorkspaceFile(body.project, body.path, body.content);
      return respond({ success: true });
    }
    if (body.action === "delete") {
      await deleteWorkspaceFile(body.project, body.path);
      return respond({ success: true });
    }
    return respond({ error: "不支持的 IDE 写入操作。" }, 400);
  } catch (error) { return fail(error); }
}
