import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePKCE, getAuthorizationUrl } from "@/lib/mercadolivre/oauth";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const authorizationUrl = getAuthorizationUrl(codeChallenge);

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set("ml_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[ML OAuth Authorize] Error:", error);
    return NextResponse.json(
      { error: "Erro ao iniciar autorização do Mercado Livre" },
      { status: 500 }
    );
  }
}
