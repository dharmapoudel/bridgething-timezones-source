export type GatewayTarget = {
    name: string;
    host: string;
    port: number;
};
export declare const DEFAULT_DEVICE_HOST = "bridgething.local";
export declare function deviceHostName(host?: string): string;
export declare function resolveGatewayTarget(host?: string): Promise<GatewayTarget>;
export declare function resolveHost(name: string): Promise<string>;
export declare function parseUuid(s: string): Uint8Array;
export declare function freshMsgId(): Uint8Array;
export declare function uuidToString(bytes: Uint8Array): string;
export declare function bundleDirName(id: string): string;
export declare function frame(message: unknown): Uint8Array<ArrayBuffer>;
export type GatewayMsg = {
    id: Uint8Array;
    meta: GatewayMeta;
    data: unknown;
};
export type GatewayMeta = {
    kind: 'event';
} | {
    kind: 'request';
} | {
    kind: 'command';
} | {
    kind: 'response';
    data: {
        requestId: Uint8Array;
    };
};
export declare class FrameAccumulator {
    private buffer;
    append(chunk: Uint8Array): void;
    next(): GatewayMsg | null;
}
export declare function bytesEqual(a: Uint8Array, b: Uint8Array): boolean;
export type Kind = 'request' | 'command';
export declare class GatewayLink {
    private readonly ws;
    readonly url: string;
    private readonly acc;
    private readonly pending;
    private readonly handlers;
    private readonly closers;
    private closed;
    private constructor();
    static open(target: GatewayTarget): Promise<GatewayLink>;
    get isOpen(): boolean;
    onMessage(handler: (data: unknown) => void): () => void;
    onClose(handler: (reason: string) => void): () => void;
    event(data: unknown): void;
    request(kind: Kind, data: unknown): Promise<unknown>;
    close(): void;
    private write;
    private receive;
    private dispatch;
    private finish;
}
export type Outcome<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    reason: string;
};
export type ActiveWebapp = {
    id?: Uint8Array | null;
    name?: string | null;
};
export type Slots = {
    launcher?: Uint8Array | null;
    overlay?: Uint8Array | null;
};
export type Slot = 'launcher' | 'overlay';
export type ListedWebapp = {
    id: Uint8Array;
    name: string;
    version: string;
};
export type ConfigEntry = {
    key: string;
    value: string;
};
export declare function switchTo(target: GatewayTarget, id: string): Promise<Outcome<ActiveWebapp>>;
export declare function setSlot(target: GatewayTarget, slot: Slot, id: string | null): Promise<Outcome<Slots>>;
export declare function listWebapps(target: GatewayTarget): Promise<Outcome<{
    webapps: ListedWebapp[];
}>>;
export declare function navigateKiosk(target: GatewayTarget, url: string): Promise<void>;
export declare function getActive(link: GatewayLink): Promise<Outcome<ActiveWebapp>>;
export declare function listConfig(link: GatewayLink, id: string): Promise<Outcome<{
    entries: ConfigEntry[];
}>>;
export declare function getNickname(link: GatewayLink): Promise<string | null>;
//# sourceMappingURL=gateway.d.ts.map