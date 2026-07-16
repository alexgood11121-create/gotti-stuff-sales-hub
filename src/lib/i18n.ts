// Простой словарь ru/uz
export type Lang = "ru" | "uz";

const dict: Record<string, { ru: string; uz: string }> = {
  sales: { ru: "Продажи", uz: "Sotuvlar" },
  receipts: { ru: "Чеки", uz: "Cheklar" },
  products: { ru: "Товары", uz: "Mahsulotlar" },
  reports: { ru: "Отчёты", uz: "Hisobotlar" },
  settings: { ru: "Настройки", uz: "Sozlamalar" },
  dashboard: { ru: "Дашборд", uz: "Boshqaruv paneli" },
  branches: { ru: "Филиалы", uz: "Filiallar" },
  cashiers: { ru: "Кассиры", uz: "Kassirlar" },
  operations: { ru: "Операции", uz: "Operatsiyalar" },
  income: { ru: "Приход", uz: "Kirim" },
  expense: { ru: "Расход", uz: "Chiqim" },
  pay: { ru: "ОПЛАТИТЬ", uz: "TO'LASH" },
  openReceipts: { ru: "ОТКРЫТЫЕ ЧЕКИ", uz: "OCHIQ CHEKLAR" },
  logout: { ru: "Выйти", uz: "Chiqish" },
  total: { ru: "Итого", uz: "Jami" },
  cash: { ru: "Наличные", uz: "Naqd" },
  card: { ru: "Карта", uz: "Karta" },
  mixed: { ru: "Смешанная", uz: "Aralash" },
  clientGave: { ru: "Клиент дал", uz: "Mijoz berdi" },
  change: { ru: "Сдача", uz: "Qaytim" },
  cashier: { ru: "Кассир", uz: "Kassir" },
  admin: { ru: "Админ", uz: "Admin" },
  online: { ru: "Онлайн", uz: "Onlayn" },
  offline: { ru: "Офлайн", uz: "Oflayn" },
  syncing: { ru: "Синхронизация", uz: "Sinxronlash" },
  addProduct: { ru: "Добавить товар", uz: "Mahsulot qo'shish" },
  addCategory: { ru: "Добавить категорию", uz: "Kategoriya qo'shish" },
  addBranch: { ru: "Добавить филиал", uz: "Filial qo'shish" },
  addCashier: { ru: "Добавить кассира", uz: "Kassir qo'shish" },
  nickname: { ru: "Никнейм", uz: "Nick" },
  pin: { ru: "PIN-код", uz: "PIN kod" },
  email: { ru: "Email", uz: "Email" },
  password: { ru: "Пароль", uz: "Parol" },
  signIn: { ru: "Войти", uz: "Kirish" },
  signUp: { ru: "Регистрация", uz: "Ro'yxatdan o'tish" },
  branch: { ru: "Филиал", uz: "Filial" },
  name: { ru: "Название", uz: "Nomi" },
  address: { ru: "Адрес", uz: "Manzil" },
  costPrice: { ru: "Закупочная цена", uz: "Xarid narxi" },
  salePrice: { ru: "Продающая цена", uz: "Sotish narxi" },
  category: { ru: "Категория", uz: "Kategoriya" },
  qty: { ru: "Количество", uz: "Miqdor" },
  save: { ru: "Сохранить", uz: "Saqlash" },
  cancel: { ru: "Отмена", uz: "Bekor qilish" },
  delete: { ru: "Удалить", uz: "O'chirish" },
  edit: { ru: "Редактировать", uz: "Tahrirlash" },
  create: { ru: "Создать", uz: "Yaratish" },
  profit: { ru: "Прибыль", uz: "Foyda" },
  revenue: { ru: "Выручка", uz: "Tushum" },
  today: { ru: "Сегодня", uz: "Bugun" },
  period: { ru: "Период", uz: "Davr" },
  notifications: { ru: "Уведомления", uz: "Bildirishnomalar" },
  photo: { ru: "Фото", uz: "Rasm" },
  choosePayment: { ru: "Способ оплаты", uz: "To'lov usuli" },
  insufficient: { ru: "Недостаточно средств", uz: "Yetarli mablag' yo'q" },
  cartEmpty: { ru: "Корзина пуста", uz: "Savat bo'sh" },
  addToCart: { ru: "Добавить", uz: "Qo'shish" },
  loading: { ru: "Загрузка...", uz: "Yuklanmoqda..." },
  noData: { ru: "Нет данных", uz: "Ma'lumot yo'q" },
  createAdminHint: { ru: "Первый зарегистрированный аккаунт становится администратором", uz: "Birinchi ro'yxatdan o'tgan hisob administrator bo'ladi" },
  adminLogin: { ru: "Вход администратора", uz: "Administrator kirishi" },
  cashierLogin: { ru: "Вход кассира", uz: "Kassir kirishi" },
};

export function t(key: keyof typeof dict, lang: Lang = "ru"): string {
  return dict[key]?.[lang] ?? key;
}

const LS_KEY = "gotti-lang";

export function getLang(): Lang {
  if (typeof window === "undefined") return "ru";
  return (localStorage.getItem(LS_KEY) as Lang) ?? "ru";
}

export function setLang(lang: Lang) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, lang);
}
