/** Unofficial iClub SDK. Uses observed SignalR calls; no association with iClub. */
import { IClubClient } from "./services/iclub-client.js";
import { IClubBrowserClient } from "./services/iclub-legacy-browser-client.js";
export { AppError as IClubError } from "./utils/app-error.js";
export { SignalRConnection, createGuid } from "./services/iclub-signalr/protocol.js";
export { IClubSignalRSession, getSignalRGyms } from "./services/iclub-signalr/client.js";
export class IClub {
    core = new IClubClient();
    static async listGyms() { return IClubClient.getGyms(); }
    async listGyms() { return IClub.listGyms(); }
    async login(email, password, gymName) { return this.core.login(email, password, gymName); }
    async getUser() { return this.core.getUser(); }
    async getCustomerStats() { return this.core.getCustomerStats(); }
    async getAvailableTickets() { return this.core.getAvailableTickets(); }
    async getMemberships() { return this.core.getAvailableTickets(); }
    async getHomePageText() { return this.core.getHomePageText(); }
    async getCredit() { return this.core.getCredit(); }
    async getVisitsTransactions(limit = 20) { return this.core.getVisitsTransactions(limit); }
    async getSalesTransactions(limit = 20) { return this.core.getSalesTransactions(limit); }
    async getPayments(limit = 20) { return this.core.getSalesTransactions(limit); }
    async getTransaction(id) { return this.core.getTransaction(id); }
    async getVisitHistory() { return this.core.getVisitHistory(); }
    async getVisitDetail(id) { return this.core.getVisitDetail(id); }
    async getCustomerEvents(at = new Date()) { return this.core.getCustomerEvents(at); }
    async getRooms() { return this.core.getRooms(); }
    async getRoomsEvents(startIso, endIso) { return this.core.getRoomsEvents(startIso, endIso); }
    async getCalendar(options) { return this.core.getCalendar(options); }
    async getEventDetail(id, options) { return this.core.getEventDetail(id, options); }
    async reserveEvent(id, options) { return this.core.reserveEvent(id, options); }
    async getProfile() { return this.core.getProfile(); }
    async getDashboard() { return this.core.getDashboard(); }
    async updateContactInformation(contact) {
        return this.core.updateContactInformation(contact);
    }
    async changePassword(oldPassword, newPassword, confirmation) {
        return this.core.changePassword(oldPassword, newPassword, confirmation);
    }
    async prepareCreditDeposit(amount) { return this.core.prepareCreditDeposit(amount); }
    async getLiveQrCode() { return this.core.getLiveQrCode(); }
    async resetQrPage() { return this.core.resetQrPage(); }
    /** Advanced: remote hub may expose mutations; avoid undocumented calls on accounts you do not own. */
    async rawInvoke(hub, method, args = [], withContext = true) {
        return this.core.rawInvoke(hub, method, args, withContext);
    }
    static async register(details) {
        if (!details.acceptPrivacyPolicy || !details.acceptTerms)
            throw new Error("Consent is required");
        const browser = new IClubBrowserClient();
        try {
            return await browser.register({ ...details, agreeNewsletter: details.agreeNewsletter ?? false });
        }
        finally {
            await browser.dispose();
        }
    }
    async close() { return this.core.dispose(); }
    async logout() { return this.close(); }
}
