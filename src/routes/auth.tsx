import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Brand } from "@/components/vi/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — MyVisa visa evidence engine" },
      {
        name: "description",
        content: "Sign in to MyVisa to open your visa research workspace, cases and application auditor.",
      },
      { property: "og:title", content: "Sign in — MyVisa" },
      { property: "og:description", content: "Open your visa research workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/research";
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const dest = safePath(search.redirect);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
  }, [navigate, dest]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentEmail(true);
          return;
        }
        navigate({ to: dest, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: dest, replace: true });
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      sessionStorage.setItem("myvisa:next", dest);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: dest, replace: true });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-canvas flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-6">
        <Brand />
      </div>
      <main className="flex flex-1 items-start justify-center px-5 pb-20 pt-6">
        <div className="animate-rise w-full max-w-md">
          <h1 className="font-display text-3xl">
            {mode === "signin" ? "Sign in to MyVisa" : "Create your MyVisa account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your case details and uploads are private to your account and can be deleted at any
            time.
          </p>

          {sentEmail ? (
            <div className="surface-card mt-8 p-6 text-sm">
              <p className="font-medium">Check your email</p>
              <p className="mt-2 text-muted-foreground">
                We sent a confirmation link to {email}. Your account becomes active once you confirm
                it.
              </p>
            </div>
          ) : (
            <div className="surface-card mt-8 p-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={google}
                disabled={busy}
              >
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create one" : "Sign in"}
                </button>
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}