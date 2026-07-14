import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import type { Conta } from "./queries";

const CONTAS_CHANNEL_ID = "contas_vencimentos";

type NotificationPermissionState = "web" | "granted" | "denied" | "prompt" | "prompt-with-rationale";

async function ensureNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: CONTAS_CHANNEL_ID,
    name: "Vencimentos de contas",
    description: "Avisos de contas vencendo hoje e contas atrasadas.",
    importance: 5,
    visibility: 1,
    lights: true,
    lightColor: "#10B981",
    vibration: true,
  }).catch(() => undefined);
}

export async function checkNotificationPermissions(): Promise<NotificationPermissionState> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    const p = Notification.permission;
    if (p === "granted") return "granted";
    if (p === "denied") return "denied";
    return "prompt";
  }
  const perm = await LocalNotifications.checkPermissions();
  return perm.display;
}

export async function requestNotificationPermissions() {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const r = await Notification.requestPermission();
    return r === "granted";
  }
  await ensureNotificationChannel();
  const current = await LocalNotifications.checkPermissions();
  const perm = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
  await LocalNotifications.checkExactNotificationSetting()
    .then((setting) => {
      if (setting.exact_alarm !== "granted") return LocalNotifications.changeExactNotificationSetting();
      return setting;
    })
    .catch(() => undefined);
  return perm.display === "granted";
}

/**
 * Agenda notificações locais para contas pendentes:
 * - 1 dia antes do vencimento às 09:00
 * - No dia do vencimento às 09:00
 */
export async function agendarNotificacoesContas(contas: Conta[]) {
  // Web: sem agendamento nativo; dispara Notification imediata para atrasadas/hoje
  if (!Capacitor.isNativePlatform()) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const hoje = new Date().toISOString().slice(0, 10);
    const atrasadas = contas.filter((c) => c.status === "atrasada");
    const vencemHoje = contas.filter((c) => c.status === "pendente" && c.vencimento === hoje);
    const chaveDia = `web-notif-${hoje}`;
    if (localStorage.getItem(chaveDia) === "ok") return;
    if (atrasadas.length === 0 && vencemHoje.length === 0) return;
    try {
      if (atrasadas.length > 0) {
        new Notification("Contas atrasadas", {
          body: `${atrasadas.length} conta(s) precisam de atenção.`,
          icon: "/manifest-icon-192.png",
          tag: "contas-atrasadas",
        });
      }
      if (vencemHoje.length > 0) {
        new Notification("Contas vencem hoje", {
          body: vencemHoje.map((c) => c.nome).slice(0, 3).join(", "),
          icon: "/manifest-icon-192.png",
          tag: "contas-hoje",
        });
      }
      localStorage.setItem(chaveDia, "ok");
    } catch {
      // ignora
    }
    return;
  }

  await ensureNotificationChannel();

  // Limpa agendadas anteriores
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const agora = Date.now();
  const notifications = [] as Array<{
    id: number;
    title: string;
    body: string;
    schedule?: { at: Date; allowWhileIdle?: boolean };
    channelId?: string;
    iconColor?: string;
  }>;

  let idx = 1;
  const vencidas = contas.filter((conta) => conta.status === "atrasada");
  const hoje = new Date().toISOString().slice(0, 10);
  const avisoAtrasadasHoje = `contas-atrasadas-${hoje}`;

  if (vencidas.length > 0 && localStorage.getItem(avisoAtrasadasHoje) !== "ok") {
    notifications.push({
      id: 900001,
      title: "Você tem contas atrasadas",
      body: `${vencidas.length} conta(s) precisam de atenção no Contas Fácil.`,
      channelId: CONTAS_CHANNEL_ID,
      iconColor: "#10B981",
    });
    localStorage.setItem(avisoAtrasadasHoje, "ok");
  }

  for (const conta of contas) {
    if (conta.status === "paga" || conta.status === "quitada") continue;

    const venc = new Date(conta.vencimento + "T09:00:00");
    const doisDiasAntes = new Date(venc.getTime() - 2 * 24 * 60 * 60 * 1000);
    const umDiaAntes = new Date(venc.getTime() - 24 * 60 * 60 * 1000);
    const umDiaDepois = new Date(venc.getTime() + 24 * 60 * 60 * 1000);
    const push = (at: Date | undefined, title: string) => {
      if (at && at.getTime() <= agora) return;
      notifications.push({
        id: idx++,
        title,
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        schedule: at ? { at, allowWhileIdle: true } : undefined,
        channelId: CONTAS_CHANNEL_ID,
        iconColor: "#10B981",
      });
    };

    push(doisDiasAntes, "Conta vence em 2 dias");
    push(umDiaAntes, "Conta vence amanhã");
    push(venc, "Conta vence hoje!");
    push(umDiaDepois, "Conta atrasada há 1 dia");

    if (idx > 400) break; // limite seguro
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

/** Dispara uma notificação de teste imediata, útil para o botão "Testar" */
export async function dispararNotificacaoTeste() {
  if (Capacitor.isNativePlatform()) {
    await ensureNotificationChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: "Contas Fácil",
          body: "Notificações estão funcionando! ✅",
          channelId: CONTAS_CHANNEL_ID,
          iconColor: "#10B981",
        },
      ],
    });
    return true;
  }
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification("Contas Fácil", { body: "Notificações estão funcionando! ✅" });
    return true;
  } catch {
    return false;
  }
}
