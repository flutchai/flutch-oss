import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface ChangePasswordPageProps {
  redirectTo?: string;
}

export function ChangePasswordPage({ redirectTo = "/" }: ChangePasswordPageProps) {
  const navigate = useNavigate();
  const passwordChanged = useAuthStore(s => s.passwordChanged);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      passwordChanged();
      navigate({ to: redirectTo });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-warning/20 mb-4">
            <ShieldAlert className="text-warning" size={24} />
          </div>
          <h1 data-testid="change-password-heading" className="text-2xl font-bold text-foreground">Change password</h1>
          <p data-testid="change-password-subtitle" className="text-sm text-muted-fg mt-1">
            You must change your password before continuing
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label data-testid="current-password-label" className="text-sm font-medium">Current password</label>
              <Input
                {...register("currentPassword")}
                data-testid="current-password-input"
                type="password"
                placeholder="••••••••"
                autoFocus
              />
              {errors.currentPassword && (
                <p data-testid="current-password-error" className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label data-testid="new-password-label" className="text-sm font-medium">New password</label>
              <Input
                {...register("newPassword")}
                data-testid="new-password-input"
                type="password"
                placeholder="At least 8 characters"
              />
              {errors.newPassword && (
                <p data-testid="new-password-error" className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label data-testid="confirm-password-label" className="text-sm font-medium">Confirm password</label>
              <Input {...register("confirmPassword")} data-testid="confirm-password-input" type="password" placeholder="••••••••" />
              {errors.confirmPassword && (
                <p data-testid="confirm-password-error" className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {mutation.isError && (
              <p data-testid="change-password-error" className="text-xs text-destructive bg-destructive/10 rounded p-2">
                Incorrect current password
              </p>
            )}

            <Button data-testid="change-password-submit" type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
