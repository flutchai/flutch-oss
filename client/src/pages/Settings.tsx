import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsApi, type WebhookResult } from "@/api/settings";
import { agentsApi } from "@/api/agents";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Send, CheckCircle, XCircle } from "lucide-react";

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

export function SettingsPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: agentsApi.list });
  const passwordChanged = useAuthStore(s => s.passwordChanged);

  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
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
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold" data-testid="settings-heading">
        Settings
      </h1>

      {/* Engine */}
      <Card data-testid="engine-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-fg">Config Mode</span>
            <Badge variant="outline" className="font-mono" data-testid="settings-config-mode">
              {settings?.configMode ?? "—"}
            </Badge>
          </div>
          {settings?.flutchPlatformUrl && (
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Flutch Platform URL</span>
              <span className="font-mono text-xs">{settings.flutchPlatformUrl}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-fg">OpenAI API Key</span>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs bg-muted rounded px-2 py-1"
                data-testid="openai-key-value"
              >
                {settings?.openaiKeyMasked
                  ? showOpenai
                    ? settings.openaiKeyMasked
                    : "••••••••••••"
                  : "Not configured"}
              </span>
              {settings?.openaiKeyMasked && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowOpenai(v => !v)}
                  className="h-7 w-7 p-0"
                >
                  {showOpenai ? <EyeOff size={12} /> : <Eye size={12} />}
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-fg">Anthropic API Key</span>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs bg-muted rounded px-2 py-1"
                data-testid="anthropic-key-value"
              >
                {settings?.anthropicKeyMasked
                  ? showAnthropic
                    ? settings.anthropicKeyMasked
                    : "••••••••••••"
                  : "Not configured"}
              </span>
              {settings?.anthropicKeyMasked && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAnthropic(v => !v)}
                  className="h-7 w-7 p-0"
                >
                  {showAnthropic ? <EyeOff size={12} /> : <Eye size={12} />}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Webhooks */}
      {telegramAgents.length > 0 && (
        <Card data-testid="telegram-webhooks-section">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Telegram Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {telegramAgents.map(agent => {
              const result = webhookResults[agent.id];
              return (
                <div key={agent.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{agent.id}</p>
                    <p className="text-xs text-muted-fg font-mono">
                      {agent.platforms.telegram?.botTokenMasked}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => changePassword.mutate(d))} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-fg">Current password</label>
              <Input
                {...register("currentPassword")}
                type="password"
                data-testid="current-password-input"
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-fg">New password</label>
              <Input
                {...register("newPassword")}
                type="password"
                data-testid="new-password-input"
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-fg">Confirm password</label>
              <Input
                {...register("confirmPassword")}
                type="password"
                data-testid="confirm-password-input"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
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
              size="sm"
              disabled={changePassword.isPending}
              data-testid="change-password-submit"
            >
              {changePassword.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
