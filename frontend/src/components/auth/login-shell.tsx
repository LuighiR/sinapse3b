import { LoginBrandPanel } from "@/components/auth/login-brand-panel";
import { LoginFormPanel } from "@/components/auth/login-form-panel";

export function LoginShell() {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1540px] items-center px-6 py-8 lg:px-10">
      <div className="grid w-full gap-5 rounded-[32px] border border-[color:rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.42)] p-3 shadow-[var(--shadow-soft)] lg:min-h-[760px] lg:grid-cols-[minmax(0,1.2fr)_560px]">
        <LoginBrandPanel />
        <LoginFormPanel />
      </div>
    </section>
  );
}
