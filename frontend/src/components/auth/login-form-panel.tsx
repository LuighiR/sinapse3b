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

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTransitionVisible(true);

    window.setTimeout(() => {
      startTransition(() => {
        router.push(getPostLoginDestination({ role: "demo-user" }));
      });
    }, 420);
  }

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-shell)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,239,232,0.92))] px-7 py-8 shadow-[var(--shadow-panel)]">
      <LoginTransitionOverlay active={isTransitionVisible || isPending} />
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
          acesso seguro
        </span>
        <h2 className="mt-4 text-4xl leading-[0.98] text-balance">
          Entre para acompanhar os KPIs da operacao.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-[var(--color-muted)]">
          O mesmo login futuramente podera direcionar para a area administrativa ou
          para o dashboard operacional, mantendo a mesma porta de entrada.
        </p>
      </div>

      <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className="mb-2 block">Email ou usuario</span>
          <Input aria-label="Email ou usuario" placeholder="voce@sinapsehub.com" />
        </label>

        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className="mb-2 block">Senha</span>
          <Input aria-label="Senha" placeholder="Digite sua senha" type="password" />
        </label>

        <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
          <label className="inline-flex items-center gap-3">
            <input className="h-4 w-4 rounded border-[color:var(--color-line)]" type="checkbox" />
            <span>Lembrar acesso</span>
          </label>
          <button className="font-semibold text-[var(--color-navy)]" type="button">
            Esqueci minha senha
          </button>
        </div>

        <Button className="w-full" disabled={isTransitionVisible || isPending} type="submit">
          {isTransitionVisible || isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-10 border-t border-[color:var(--color-line)] pt-5 text-xs leading-6 text-[var(--color-muted)]">
        Ao continuar, voce entra na camada inicial do produto. A autenticacao real e
        a decisao de rota por perfil entram no proximo passo da integracao.
      </div>
    </div>
  );
}
