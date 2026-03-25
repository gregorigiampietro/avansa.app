import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForToken } from "@/lib/mercadolivre/oauth";
import type { MlUserResponse } from "@/lib/mercadolivre/types";
export const dynamic = "force-dynamic";

const ML_API_BASE_URL = "https://api.mercadolibre.com";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const code = request.nextUrl.searchParams.get("code");
    const codeVerifier = request.cookies.get("ml_code_verifier")?.value;

    if (!code || !codeVerifier) {
      return NextResponse.redirect(
        `${appUrl}/accounts?error=missing_params`
      );
    }

    // Clear the code_verifier cookie
    const clearCookieHeaders = new Headers();
    clearCookieHeaders.append(
      "Set-Cookie",
      "ml_code_verifier=; Path=/; Max-Age=0; HttpOnly"
    );

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForToken(code, codeVerifier);

    // Fetch ML user info
    const userResponse = await fetch(`${ML_API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error(
        "[ML OAuth Callback] Failed to fetch ML user:",
        await userResponse.text()
      );
      return NextResponse.redirect(
        `${appUrl}/accounts?error=ml_user_fetch_failed`
      );
    }

    const mlUser: MlUserResponse = await userResponse.json();

    // Get the authenticated Supabase user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        `${appUrl}/accounts?error=not_authenticated`
      );
    }

    // Calculate token expiration timestamp
    const tokenExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    // Upsert ML account into database
    const { error: upsertError } = await supabase
      .from("ml_accounts")
      .upsert(
        {
          user_id: user.id,
          ml_user_id: tokenData.user_id,
          nickname: mlUser.nickname,
          email: mlUser.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: tokenExpiresAt,
          status: "active",
        },
        { onConflict: "user_id,ml_user_id" }
      );

    if (upsertError) {
      console.error(
        "[ML OAuth Callback] Upsert error:",
        upsertError.message
      );
      return NextResponse.redirect(
        `${appUrl}/accounts?error=db_save_failed`
      );
    }

    const response = NextResponse.redirect(
      `${appUrl}/accounts?success=connected`
    );

    // Clear the code_verifier cookie on the success response
    response.cookies.set("ml_code_verifier", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[ML OAuth Callback] Unexpected error:", error);
    return NextResponse.redirect(
      `${appUrl}/accounts?error=oauth_failed`
    );
  }
}
