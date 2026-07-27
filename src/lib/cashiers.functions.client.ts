// Клиентский шим для Capacitor. Единственное, что нужно кассиру — resolveCashierEmail.
// createCashier / deleteCashier требуют service role — в APK делать нечего, кидаем ошибку.
const CASHIER_DOMAIN = "cashier.gotti.local";

function nicknameToEmail(nickname: string): string {
  return `${nickname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@${CASHIER_DOMAIN}`;
}

export const resolveCashierEmail = async ({ data }: { data: { nickname: string } }) => {
  return { email: nicknameToEmail(data.nickname) };
};

export const createCashier = async (_: any): Promise<never> => {
  throw new Error("Создание кассира доступно только в веб-кабинете");
};

export const deleteCashier = async (_: any): Promise<never> => {
  throw new Error("Удаление кассира доступно только в веб-кабинете");
};
