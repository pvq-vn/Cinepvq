// ==============================================================================
// lib/supabase/server.ts
// Supabase Server Client & Authentication Guard for Next.js Route Handlers
// ==============================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length > 0
  );
}

export async function createServerSupabase() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Invoked from a read-only Server Component or handler context
          }
        },
      },
    }
  );
}

/**
 * Validates the authenticated user on the server side.
 * Validates cryptographic JWT signature against Supabase Auth.
 * Never trusts any client-provided userId parameter.
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<User | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  // 1. Check Bearer token from Authorization header if present
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          return user;
        }
      }
    }
  }

  // 2. Check session cookies
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user;
    }
  } catch (err) {
    console.error("[Supabase Server Auth Error]", err);
  }

  return null;
}
