"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function login(formData: FormData) {
  const email = getText(formData, "email").toLowerCase();
  const password = getText(formData, "password");
  const next = safeNext(getText(formData, "next") || "/");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password.")}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Unable to sign in. Check your email and password.")}&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function signup(formData: FormData) {
  const email = getText(formData, "email").toLowerCase();
  const password = getText(formData, "password");
  const confirmPassword = getText(formData, "confirmPassword");

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("Enter an email and password.")}`);
  }

  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Use a password with at least 8 characters.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent("Passwords do not match.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent("Unable to create the account. Try signing in if this email is already registered.")}`);
  }

  // Hosted Supabase projects normally require email confirmation. If the
  // project has confirmation disabled, a session is returned immediately.
  if (data.session) redirect("/onboarding");
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}
