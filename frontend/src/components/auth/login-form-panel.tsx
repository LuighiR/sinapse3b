"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LoginTransitionOverlay } from "@/components/auth/login-transition-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPostLoginDestination } from "@/lib/auth-flow";

export function LoginFormPanel() {
  const router = useRouter();
  const [isTransitionVisible, setIsTransitionVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setFormError("Informe email ou usuario e senha para continuar.");
      return;
    }

    setFormError(null);
    setIsTransitionVisible(true);

    window.setTimeout(() => {
      startTransition(() => {
        router.push(getPostLoginDestination({ role: "demo-user" }));
      });
    }, 420);
  }

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,248,251,0.98))] px-8 py-8 shadow-[var(--shadow-panel)]">
      <LoginTransitionOverlay active={isTransitionVisible || isPending} />
      <div>
        <div className="rounded-2xl border border-[color:rgba(15,23,42,0.08)] bg-[var(--color-paper)] px-4 py-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
            acesso seguro
          </span>
          <h2 className="mt-3 text-3xl leading-[1.02] text-balance">
            Entrar no workspace Sinapse Hub.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-[var(--color-muted)]">
            O mesmo login futuramente podera encaminhar cada usuario para a area
            administrativa ou operacional, conforme o perfil.
          </p>
        </div>
      </div>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className="mb-2 block text-[13px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Email ou usuario
          </span>
          <Input
            aria-invalid={Boolean(formError)}
            aria-label="Email ou usuario"
            autoComplete="username"
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (formError) {
                setFormError(null);
              }
            }}
            placeholder="voce@sinapsehub.com"
            required
            value={identifier}
          />
        </label>

        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className="mb-2 block text-[13px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Senha
          </span>
          <Input
            aria-invalid={Boolean(formError)}
            aria-label="Senha"
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              if (formError) {
                setFormError(null);
              }
            }}
            placeholder="Digite sua senha"
            required
            type="password"
            value={password}
          />
        </label>

        {formError ? (
          <p className="rounded-2xl border border-[color:rgba(208,68,68,0.18)] bg-[color:rgba(208,68,68,0.06)] px-4 py-3 text-sm font-medium text-[#8E2323]">
            {formError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
          <label className="inline-flex items-center gap-3">
            <input className="h-4 w-4 rounded border-[color:var(--color-line)]" type="checkbox" />
            <span>Lembrar acesso</span>
          </label>
          <button className="font-semibold text-[var(--color-navy)]" type="button">
            Esqueci minha senha
          </button>
        </div>

        <Button className="mt-1 w-full" disabled={isTransitionVisible || isPending} type="submit">
          {isTransitionVisible || isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-10 rounded-2xl border border-[color:var(--color-line)] bg-[var(--color-paper)] px-4 py-4 text-xs leading-6 text-[var(--color-muted)]">
        Ao continuar, voce entra na camada inicial do produto. A autenticacao real e
        a decisao de rota por perfil entram no proximo passo da integracao.
      </div>
    </div>
  );
}
