import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bridgething, daemonProxy } from './dev.js';
export async function defineBridgethingConfig(overrides = {}) {
    return defineConfig({
        plugins: [react(), tailwindcss(), bridgething(), ...(overrides.plugins ?? [])],
        build: {
            target: 'es2022',
            sourcemap: true,
            ...(overrides.build ?? {}),
        },
        server: {
            host: true,
            proxy: await daemonProxy(),
            ...(overrides.server ?? {}),
        },
    });
}
//# sourceMappingURL=vite.js.map