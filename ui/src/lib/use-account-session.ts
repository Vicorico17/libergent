"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type AccountSessionState = {
  status: "checking" | "signed_out" | "signed_in";
  userId: string;
  email: string;
  displayName: string;
  provider: string;
};

const SIGNED_OUT: AccountSessionState = {
  status: "signed_out",
  userId: "",
  email: "",
  displayName: "",
  provider: "",
};

function accountFromSession(session: Session | null): AccountSessionState {
  const user = session?.user;
  if (!user?.id) return SIGNED_OUT;

  const metadata = user.user_metadata || {};
  return {
    status: "signed_in",
    userId: user.id,
    email: user.email || "",
    displayName: String(metadata.full_name || metadata.name || metadata.user_name || "").trim(),
    provider: String(user.app_metadata?.provider || "email"),
  };
}

export function useAccountSession(): AccountSessionState {
  const [account, setAccount] = useState<AccountSessionState>({ ...SIGNED_OUT, status: "checking" });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setAccount(SIGNED_OUT));
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAccount(accountFromSession(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAccount(accountFromSession(session));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return account;
}
