import type { Browser } from "playwright";
export declare function getBrowser(): Promise<Browser>;
export declare function getGyms(): Promise<{
    id: string;
    name: string;
}[]>;
export declare function warmGymCache(): Promise<void>;
