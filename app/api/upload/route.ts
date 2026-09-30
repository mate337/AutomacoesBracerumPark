import { NextRequest, NextResponse } from "next/server";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX = 25 * 1024 * 1024;
const TYPES = ["application/pdf"];

async function requireSession(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(SESSION_COOKIE)?.value))) throw new Error("Sessão expirada. Entre novamente.");
}

/**
 * Upload direto do navegador para o Vercel Blob (até 25 MB).
 * - Blob novo (BLOB_STORE_ID, autenticação OIDC da Vercel): URL pré-assinada.
 * - Blob antigo (BLOB_READ_WRITE_TOKEN): token de cliente.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await handleUpload({
        body: body as HandleUploadBody,
        request: req,
        onBeforeGenerateToken: async () => {
          await requireSession(req);
          return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(result);
    }

    const result = await handleUploadPresigned({
      body: body as HandleUploadPresignedBody,
      request: req,
      getSignedToken: async (pathname) => {
        await requireSession(req);
        if (!pathname.startsWith("materiais/") || !pathname.endsWith(".pdf")) throw new Error("Destino inválido.");
        const token = await issueSignedToken({
          pathname: "*",
          operations: ["put"],
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX,
          validUntil: Date.now() + 15 * 60 * 1000,
        });
        return { token, urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export function GET() {
  const mode = process.env.BLOB_READ_WRITE_TOKEN ? "token" : process.env.BLOB_STORE_ID ? "presigned" : "none";
  return NextResponse.json({ mode });
}
