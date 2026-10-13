import type { IClubClientContext, VisitRecord } from "./types.js";
export declare function scrapeVisitHistory(client: IClubClientContext, limit?: number): Promise<VisitRecord[]>;
export declare function getVisitHistory(client: IClubClientContext): Promise<{
    visits: VisitRecord[];
}>;
export declare function getVisitDetail(client: IClubClientContext, transactionId: number): Promise<{
    transactionId: number;
    ticketType: string | undefined;
    billingType: string | undefined;
    transactionStatus: string | undefined;
    entryDate: string | undefined;
    exitDate: string | undefined;
    totalTime: string | undefined;
    discountName: string | undefined;
    billingDesk: string | undefined;
    loggedInBy: string | undefined;
    loggedOutBy: string | undefined;
    appliedCredit: string | undefined;
    totalWithVat: string | undefined;
    goodsServices: {
        name: string;
        price?: string;
        discount?: string;
        quantity?: string;
        totalUnitPrice?: string;
    }[];
    rented: {
        name: string;
        price?: string;
        discount?: string;
        quantity?: string;
        totalUnitPrice?: string;
    }[];
}>;
