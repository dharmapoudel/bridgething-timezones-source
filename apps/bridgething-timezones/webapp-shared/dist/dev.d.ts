import type { Plugin, ProxyOptions } from 'vite';
export { buildExtension } from './extension.js';
export declare const DEVICE_MODE = "device";
export declare const AUTHORIZE_PATH = "/__extension/authorize";
export declare function daemonProxyTarget(): Promise<string>;
export declare function daemonProxy(): Promise<Record<string, ProxyOptions>>;
export declare function bridgething(): Plugin;
//# sourceMappingURL=dev.d.ts.map