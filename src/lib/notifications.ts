import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import type { Conta } from "./queries";

export async function requestNotificationPermissions() {
  if (!Capacitor.isNativePlatform()) return false;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === "granted";
}

/**
 * Agenda notificações locais para contas pendentes:
 * - 1 dia antes do vencimento às 09:00
 * - No dia do vencimento às 09:00
 */
export async function agendarNotificacoesContas(contas: Conta[]) {
  if (!Capacitor.isNativePlatform()) return;

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
    schedule: { at: Date };
  }>;

  let idx = 1;
  for (const conta of contas) {
    if (conta.status === "paga" || conta.status === "quitada") continue;

    const venc = new Date(conta.vencimento + "T09:00:00");
    const umDiaAntes = new Date(venc.getTime() - 24 * 60 * 60 * 1000);

    if (umDiaAntes.getTime() > agora) {
      notifications.push({
        id: idx++,
        title: "Conta vence amanhã",
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        schedule: { at: umDiaAntes },
      });
    }

    if (venc.getTime() > agora) {
      notifications.push({
        id: idx++,
        title: "Conta vence hoje!",
        body: `${conta.nome} - R$ ${conta.valor.toFixed(2)}`,
        schedule: { at: venc },
      });
    }

    if (idx > 400) break; // limite seguro
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}
