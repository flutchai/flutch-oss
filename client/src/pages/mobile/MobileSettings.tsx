import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Send, CheckCircle, XCircle } from "lucide-react";
import { settingsApi, type WebhookResult } from "@/api/settings";
import { agentsApi } from "@/api/agents";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export function MobileSettings() {
  const logout = useAuthStore(s => s.logout);
  const passwordChanged = useAuthStore(s => s.passwordChanged);
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: agentsApi.list });
  const [webhookResults, setWebhookResults] = useState<Record<string, WebhookResult>>({});

  const changePassword = useMutation({
    mutationFn: (d: PasswordForm) => authApi.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      passwordChanged();
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const registerWebhook = async (agentId: string) => {
    const result = await settingsApi.registerWebhook(agentId);
    setWebhookResults(r => ({ ...r, [agentId]: result }));
  };

  const telegramAgents = agents?.filter(a => a.platforms.telegram?.configured) ?? [];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold pt-2">Settings</h1>

      {/* Engine */}
      <Card data-testid="engine-section">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Engine</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Config mode</span>
            <Badge
              variant="outline"
              className="font-mono"
              data-testid="settings-config-mode"
            >
              {settings?.configMode ?? "—"}
            </Badge>
          </div>
          {settings?.flutchPlatformUrl && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-fg">Platform URL</span>
              <span className="text-xs font-mono truncate max-w-[60%]">
                {settings.flutchPlatformUrl}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">API Keys</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">OpenAI</span>
            <span
              className="font-mono text-xs bg-muted rounded px-2 py-1"
              data-testid="openai-key-value"
            >
              {settings?.openaiKeyMasked ? "••••••••" : "Not configured"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Anthropic</span>
            <span
              className="font-mono text-xs bg-muted rounded px-2 py-1"
              data-testid="anthropic-key-value"
            >
              {settings?.anthropicKeyMasked ? "••••••••" : "Not configured"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Webhooks */}
      {telegramAgents.length > 0 && (
        <Card data-testid="telegram-webhooks-section">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
              Telegram Webhooks
            </p>
            {telegramAgents.map(agent => {
              const result = webhookResults[agent.id];
              return (
                <div key={agent.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{agent.id}</p>
                    <p className="text-xs text-muted-fg font-mono">
                      {agent.platforms.telegram?.botTokenMasked}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result &&
                      (result.success ? (
                        <CheckCircle size={14} className="text-success" />
                      ) : (
                        <XCircle size={14} className="text-destructive" />
                      ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => registerWebhook(agent.id)}
                      className="gap-1.5"
                      data-testid={`webhook-register-${agent.id}`}
                    >
                      <Send size={12} /> Register
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Change Password */}
      <Card data-testid="change-password-section">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg mb-3">
            Change password
          </p>
          <form
            onSubmit={handleSubmit(d => changePassword.mutate(d))}
            className="space-y-3"
          >
            <Input
              {...register("currentPassword")}
              type="password"
              placeholder="Current password"
              data-testid="current-password-input"
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
            <Input
              {...register("newPassword")}
              type="password"
              placeholder="New password"
              data-testid="new-password-input"
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
            <Input
              {...register("confirmPassword")}
              type="password"
              placeholder="Confirm password"
              data-testid="confirm-password-input"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
            {changePassword.isError && (
              <p className="text-xs text-destructive" data-testid="change-password-error">
                Incorrect current password
              </p>
            )}
            {changePassword.isSuccess && (
              <p className="text-xs text-success" data-testid="change-password-success">
                Password changed
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={changePassword.isPending}
              data-testid="save-password-button"
            >
              {changePassword.isPending ? "Saving..." : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logout + desktop link */}
      <div className="space-y-2 pt-2 pb-6">
        <Button
          data-testid="mobile-logout-button"
          variant="outline"
          className="w-full text-destructive border-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut size={16} className="mr-2" />
          Log out
        </Button>
        <a
          href="/admin/"
          className="block text-center text-xs text-muted-fg py-2"
          data-testid="switch-to-desktop"
        >
          Switch to desktop version
        </a>
      </div>
    </div>
  );
}
