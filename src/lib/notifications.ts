import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import type { Conta } from "./queries";

const CONTAS_CHANNEL_ID = "contas_vencimentos";

type NotificationPermissionState = "web" | "granted" | "denied" | "prompt";

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
  if (!Capacitor.isNativePlatform()) return "web";
  const perm = await LocalNotifications.checkPermissions();
  return perm.display;
}

export async function requestNotificationPermissions() {
  if (!Capacitor.isNativePlatform()) return false;
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
  if (!Capacitor.isNativePlatform()) return;
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
    smallIcon?: string;
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
      smallIcon: "ic_launcher_foreground",
      iconColor: "#10B981",
    });
    localStorage.setItem(avisoAtrasadasHoje, "ok");
  }

  for (const conta of contas) {
    if (conta.status === "paga" || conta.status === "quitada") continue;

    const venc = new Date(conta.vencimento + "T09:00:00");
    const umDiaAntes = new Date(venc.getTime() - 24 * 60 * 60 * 1000);

    if (umDiaAntes.getTime() > agora) {
      notifications.push({
        id: idx++,
        title: "Conta vence amanhã",
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        schedule: { at: umDiaAntes, allowWhileIdle: true },
        channelId: CONTAS_CHANNEL_ID,
        smallIcon: "ic_launcher_foreground",
        iconColor: "#10B981",
      });
    }

    if (venc.getTime() > agora) {
      notifications.push({
        id: idx++,
        title: "Conta vence hoje!",
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        schedule: { at: venc, allowWhileIdle: true },
        channelId: CONTAS_CHANNEL_ID,
        smallIcon: "ic_launcher_foreground",
        iconColor: "#10B981",
      });
    }

    if (conta.vencimento === hoje && venc.getTime() <= agora) {
      notifications.push({
        id: idx++,
        title: "Conta vence hoje!",
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        channelId: CONTAS_CHANNEL_ID,
        smallIcon: "ic_launcher_foreground",
        iconColor: "#10B981",
      });
    }

    if (idx > 400) break; // limite seguro
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}
