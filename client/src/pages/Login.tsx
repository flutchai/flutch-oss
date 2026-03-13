import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

interface LoginPageProps {
  redirectTo?: string;
}

export function LoginPage({ redirectTo = "/" }: LoginPageProps) {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const changePasswordRedirect = redirectTo.startsWith("/m") ? "/m/change-password" : "/change-password";

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data.username, data.password),
    onSuccess: data => {
      login(data.access_token, data.must_change_password);
      navigate({ to: data.must_change_password ? changePasswordRedirect : redirectTo });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <span className="text-white text-xl font-bold">F</span>
          </div>
          <h1 data-testid="login-brand-title" className="text-2xl font-bold text-foreground">Flutch OSS</h1>
          <p data-testid="login-brand-subtitle" className="text-sm text-muted-fg mt-1">Admin Panel</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input {...register("username")} data-testid="login-username-input" placeholder="admin" autoFocus />
              {errors.username && (
                <p data-testid="login-username-error" className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input {...register("password")} data-testid="login-password-input" type="password" placeholder="••••••••" />
              {errors.password && (
                <p data-testid="login-password-error" className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {mutation.isError && (
              <p data-testid="login-error" className="text-xs text-destructive bg-destructive/10 rounded p-2">
                Invalid username or password
              </p>
            )}

            <Button data-testid="login-submit-button" type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
