import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Upload direto do navegador para o Vercel Blob (até 25 MB).
 * A emissão do token exige sessão; o aviso de conclusão vem assinado pela própria Vercel.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await isValidSession(req.cookies.get(SESSION_COOKIE)?.value))) throw new Error("Sessão expirada.");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
