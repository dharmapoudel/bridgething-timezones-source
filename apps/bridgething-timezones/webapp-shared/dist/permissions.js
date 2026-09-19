import { join } from 'node:path';
const KINDS = ['net', 'read', 'write', 'run', 'env', 'sys', 'ffi'];
const PATHY = new Set(['read', 'write', 'run', 'ffi']);
export class PermissionError extends Error {
    descriptor;
    constructor(descriptor, reason) {
        super(`invalid permission ${JSON.stringify(descriptor)}: ${reason}`);
        this.descriptor = descriptor;
        this.name = 'PermissionError';
    }
}
function parse(descriptor) {
    const cut = descriptor.indexOf(':');
    const kind = cut < 0 ? descriptor : descriptor.slice(0, cut);
    const scope = cut < 0 ? null : descriptor.slice(cut + 1);
    if (scope === '')
        throw new PermissionError(descriptor, 'scope is empty');
    if (scope?.includes(','))
        throw new PermissionError(descriptor, 'scope contains a comma');
    if (kind === 'all') {
        if (scope !== null)
            throw new PermissionError(descriptor, '`all` takes no scope');
        return { kind: 'all' };
    }
    if (!KINDS.includes(kind))
        throw new PermissionError(descriptor, 'unknown permission kind');
    return { kind: kind, scope };
}
function expandHome(permission, home) {
    if (permission.kind === 'all' || permission.scope === null || !PATHY.has(permission.kind))
        return permission;
    const { scope } = permission;
    if (scope === '~')
        return { ...permission, scope: home };
    if (scope.startsWith('~/'))
        return { ...permission, scope: join(home, scope.slice(2)) };
    return permission;
}
export function denoFlags(descriptors, home) {
    const permissions = descriptors.map(parse).map(p => (home === undefined ? p : expandHome(p, home)));
    if (permissions.some(p => p.kind === 'all'))
        return ['--allow-all'];
    const flags = [];
    for (const kind of KINDS) {
        const ofKind = permissions.filter((p) => p.kind === kind);
        if (ofKind.length === 0)
            continue;
        const scopes = [];
        let bare = false;
        for (const permission of ofKind) {
            if (permission.scope === null)
                bare = true;
            else if (!scopes.includes(permission.scope))
                scopes.push(permission.scope);
        }
        flags.push(bare || scopes.length === 0 ? `--allow-${kind}` : `--allow-${kind}=${scopes.join(',')}`);
    }
    return flags;
}
//# sourceMappingURL=permissions.js.map