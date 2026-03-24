import { LoginBrandPanel } from "@/components/auth/login-brand-panel";
import { LoginFormPanel } from "@/components/auth/login-form-panel";

export function LoginShell() {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:min-h-[760px] lg:grid-cols-[1.08fr_0.92fr]">
        <LoginBrandPanel />
        <LoginFormPanel />
      </div>
    </section>
  );
}
