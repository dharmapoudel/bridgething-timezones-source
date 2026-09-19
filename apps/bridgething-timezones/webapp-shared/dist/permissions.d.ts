export declare class PermissionError extends Error {
    readonly descriptor: string;
    constructor(descriptor: string, reason: string);
}
export declare function denoFlags(descriptors: string[], home?: string): string[];
//# sourceMappingURL=permissions.d.ts.map