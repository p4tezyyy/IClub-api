/** Unofficial iClub SDK. Uses observed SignalR calls; no association with iClub. */
import { IClubClient } from "./services/iclub-client.js";
import { IClubBrowserClient } from "./services/iclub-legacy-browser-client.js";
export { AppError as IClubError } from "./utils/app-error.js";
export { SignalRConnection, createGuid } from "./services/iclub-signalr/protocol.js";
export { IClubSignalRSession, getSignalRGyms } from "./services/iclub-signalr/client.js";
export type { VisitRecord } from "./services/iclub/types.js";

export type Gym = { id: string; name: string };
export type CalendarOptions = { start?: string; end?: string; view?: "week" | "month" };
export type Registration = {
  gymName: string; gender: "man" | "woman"; firstName: string; lastName: string;
  phone: string; email: string; acceptPrivacyPolicy: boolean; acceptTerms: boolean;
  agreeNewsletter?: boolean;
};

export class IClub {
  private core = new IClubClient();
  static async listGyms(): Promise<Gym[]> { return IClubClient.getGyms(); }
  async listGyms(): Promise<Gym[]> { return IClub.listGyms(); }
  async login(email: string, password: string, gymName: string) { return this.core.login(email, password, gymName); }
  async getUser() { return this.core.getUser(); }
  async getCustomerStats() { return this.core.getCustomerStats(); }
  async getAvailableTickets() { return this.core.getAvailableTickets(); }
  async getMemberships() { return this.core.getAvailableTickets(); }
  async getHomePageText() { return this.core.getHomePageText(); }
  async getCredit() { return this.core.getCredit(); }
  async getVisitsTransactions(limit = 20) { return this.core.getVisitsTransactions(limit); }
  async getSalesTransactions(limit = 20) { return this.core.getSalesTransactions(limit); }
  async getPayments(limit = 20) { return this.core.getSalesTransactions(limit); }
  async getTransaction(id: number | string) { return this.core.getTransaction(id); }
  async getVisitHistory() { return this.core.getVisitHistory(); }
  async getVisitDetail(id: number) { return this.core.getVisitDetail(id); }
  async getCustomerEvents(at = new Date()) { return this.core.getCustomerEvents(at); }
  async getRooms() { return this.core.getRooms(); }
  async getRoomsEvents(startIso: string, endIso: string) { return this.core.getRoomsEvents(startIso, endIso); }
  async getCalendar(options?: CalendarOptions) { return this.core.getCalendar(options); }
  async getEventDetail(id: number, options?: CalendarOptions) { return this.core.getEventDetail(id, options); }
  async reserveEvent(id: number, options?: CalendarOptions) { return this.core.reserveEvent(id, options); }
  async getProfile() { return this.core.getProfile(); }
  async getDashboard() { return this.core.getDashboard(); }
  async updateContactInformation(contact: Parameters<IClubClient["updateContactInformation"]>[0]) {
    return this.core.updateContactInformation(contact);
  }
  async changePassword(oldPassword: string, newPassword: string, confirmation: string) {
    return this.core.changePassword(oldPassword, newPassword, confirmation);
  }
  async prepareCreditDeposit(amount: number) { return this.core.prepareCreditDeposit(amount); }
  async getLiveQrCode() { return this.core.getLiveQrCode(); }
  async resetQrPage() { return this.core.resetQrPage(); }
  /** Advanced: remote hub may expose mutations; avoid undocumented calls on accounts you do not own. */
  async rawInvoke(hub: string, method: string, args: unknown[] = [], withContext = true) {
    return this.core.rawInvoke(hub, method, args, withContext);
  }
  static async register(details: Registration) {
    if (!details.acceptPrivacyPolicy || !details.acceptTerms) throw new Error("Consent is required");
    const browser = new IClubBrowserClient();
    try { return await browser.register({ ...details, agreeNewsletter: details.agreeNewsletter ?? false }); }
    finally { await browser.dispose(); }
  }
  async close() { return this.core.dispose(); }
  async logout() { return this.close(); }
}
