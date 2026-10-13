import type { IClubClientContext } from "./types.js";
export declare function getCalendar(client: IClubClientContext): Promise<{
    rangeLabel: string;
    roomLabel: string;
    events: {
        id: number;
        time: string;
        title: string;
        trainer: string;
        occupancy: string;
        room?: string;
        day?: string;
    }[];
    upcomingMessage: string;
}>;
export declare function getEventDetail(client: IClubClientContext, eventId: number): Promise<{
    title: string;
    fields: {
        label: string;
        value: string;
    }[];
    primaryActionLabel: string | undefined;
}>;
