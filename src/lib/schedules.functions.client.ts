// Заглушки для Capacitor SPA — админский раздел графиков доступен только в веб-кабинете.
export const listSchedules = async (_?: any): Promise<any[]> => [];
export const createSchedule = async (_: any): Promise<never> => {
  throw new Error("Доступно только в веб-кабинете");
};
export const deleteSchedule = async (_: any): Promise<never> => {
  throw new Error("Доступно только в веб-кабинете");
};
