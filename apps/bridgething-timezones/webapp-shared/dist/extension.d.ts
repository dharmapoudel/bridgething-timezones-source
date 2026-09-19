import type { BuildOptions } from 'esbuild';
import { type GatewayTarget } from './gateway.js';
export declare const EXTENSION_SOURCE = "extension/main.ts";
export declare const EXTENSION_DATA_DIR = ".dev-extension";
export declare const DENO_PACKAGE_VERSION = "2.9.6";
export type ExtensionHostLog = {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
export type ExtensionManifest = {
    entry: string;
    permissions?: string[];
    api: number;
};
export type WebappManifest = {
    id: string;
    name?: string;
    version?: string;
    extension?: ExtensionManifest;
};
export declare function readManifest(publicDir: string): WebappManifest;
export declare function extensionBuildOptions(source: string, outfile: string): BuildOptions;
export declare function buildExtension(root: string, outDir: string, extension: ExtensionManifest): Promise<string>;
export declare function resolveDeno(root: string): Promise<string>;
export declare function openInBrowser(url: string): Promise<void>;
export type ExtensionDevHostOptions = {
    root: string;
    manifest: WebappManifest & {
        extension: ExtensionManifest;
    };
    target: GatewayTarget;
    log: ExtensionHostLog;
    authorizePage?: string;
    openUrl?: (url: string) => Promise<void>;
};
export type PendingAuthorize = {
    url: string;
};
export declare class ExtensionDevHost {
    private readonly opts;
    readonly dataDir: string;
    private readonly kvPath;
    private readonly outfile;
    private readonly kv;
    private readonly log;
    private readonly id;
    private deno;
    private context;
    private child;
    private generation;
    private crashes;
    private restartTimer;
    private link;
    private device;
    private waiting;
    private closing;
    private linkLoop;
    constructor(opts: ExtensionDevHostOptions);
    start(): Promise<void>;
    get running(): boolean;
    get pendingAuthorize(): PendingAuthorize | null;
    settleAuthorize(callback: string): boolean;
    cancelAuthorize(): boolean;
    close(): Promise<void>;
    private built;
    private spawnChild;
    private stopChild;
    private exited;
    private write;
    private reply;
    private fromChild;
    private persist;
    private authorize;
    private tap;
    private appName;
    private connected;
    private sendToDevice;
    private publishRunning;
    private runLink;
    private linked;
    private fromDevice;
}
//# sourceMappingURL=extension.d.ts.map