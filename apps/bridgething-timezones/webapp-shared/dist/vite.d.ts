import { type UserConfig } from 'vite';
export type BridgethingViteOverrides = {
    plugins?: NonNullable<UserConfig['plugins']>;
    build?: UserConfig['build'];
    server?: UserConfig['server'];
};
export declare function defineBridgethingConfig(overrides?: BridgethingViteOverrides): Promise<UserConfig>;
//# sourceMappingURL=vite.d.ts.map