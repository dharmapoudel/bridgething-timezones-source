import { decode as msgpackDecode, encode as msgpackEncode } from '@msgpack/msgpack';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
export const DEFAULT_DEVICE_HOST = 'bridgething.local';
export function deviceHostName(host) {
    return host ?? process.env.SUPERBIRD_HOST ?? DEFAULT_DEVICE_HOST;
}
export async function resolveGatewayTarget(host) {
    const name = deviceHostName(host);
    const port = Number(process.env.BRIDGETHING_GATEWAY_PORT ?? 8892);
    return { name, host: await resolveHost(name), port };
}
export async function resolveHost(name) {
    if (isIP(name))
        return name;
    try {
        return (await lookup(name, { family: 4 })).address;
    }
    catch {
        return name;
    }
}
export function parseUuid(s) {
    const hex = s.replace(/-/g, '').toLowerCase();
    if (hex.length !== 32 || !/^[0-9a-f]+$/.test(hex)) {
        throw new Error(`invalid uuid: ${s}`);
    }
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++)
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}
export function freshMsgId() {
    return parseUuid(randomUUID());
}
export function uuidToString(bytes) {
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function bundleDirName(id) {
    const hex = id.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex))
        throw new Error(`manifest id is not a uuid: ${id}`);
    return hex;
}
const FRAME_HEADER_LENGTH = 16;
const FRAME_MAGIC = 0xdead;
const FRAME_VERSION = 2;
const COMPRESSION_NONE = 0x00;
const ENCODING_MSGPACK = 0x00;
const PRIORITY_NORMAL = 0x00;
function writeFrameHeader(payloadLength) {
    const buf = new Uint8Array(FRAME_HEADER_LENGTH);
    const view = new DataView(buf.buffer);
    view.setUint16(0, FRAME_MAGIC, false);
    view.setUint8(2, FRAME_VERSION);
    view.setUint8(3, COMPRESSION_NONE);
    view.setUint8(4, ENCODING_MSGPACK);
    view.setUint8(5, PRIORITY_NORMAL);
    view.setBigUint64(8, BigInt(payloadLength), false);
    return buf;
}
export function frame(message) {
    const body = msgpackEncode(message);
    const header = writeFrameHeader(body.length);
    const out = new Uint8Array(header.length + body.length);
    out.set(header, 0);
    out.set(body, header.length);
    return out;
}
export class FrameAccumulator {
    buffer = new Uint8Array(0);
    append(chunk) {
        if (chunk.length === 0)
            return;
        const merged = new Uint8Array(this.buffer.length + chunk.length);
        merged.set(this.buffer, 0);
        merged.set(chunk, this.buffer.length);
        this.buffer = merged;
    }
    next() {
        if (this.buffer.length < FRAME_HEADER_LENGTH)
            return null;
        const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        const magic = view.getUint16(0, false);
        if (magic !== FRAME_MAGIC)
            throw new Error(`bad framing magic 0x${magic.toString(16)}`);
        const version = view.getUint8(2);
        if (version !== FRAME_VERSION)
            throw new Error(`unsupported frame version ${version}`);
        const compression = view.getUint8(3);
        if (compression !== COMPRESSION_NONE) {
            throw new Error(`unsupported inbound compression ${compression} (this script only handles uncompressed)`);
        }
        const encoding = view.getUint8(4);
        if (encoding !== ENCODING_MSGPACK)
            throw new Error(`unsupported inbound encoding ${encoding}`);
        const len = Number(view.getBigUint64(8, false));
        const total = FRAME_HEADER_LENGTH + len;
        if (this.buffer.length < total)
            return null;
        const body = this.buffer.subarray(FRAME_HEADER_LENGTH, total);
        const decoded = msgpackDecode(body);
        this.buffer = this.buffer.slice(total);
        return decoded;
    }
}
export function bytesEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
const OPEN_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 15_000;
export class GatewayLink {
    ws;
    url;
    acc = new FrameAccumulator();
    pending = new Map();
    handlers = new Set();
    closers = new Set();
    closed = null;
    constructor(ws, url) {
        this.ws = ws;
        this.url = url;
        ws.addEventListener('message', (event) => this.receive(event.data));
        ws.addEventListener('close', (event) => this.finish(`gateway closed (code ${event.code})`));
        ws.addEventListener('error', () => this.finish('gateway socket error'));
    }
    static open(target) {
        const url = `ws://${target.host}:${target.port}/`;
        return new Promise((res, rej) => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            const timer = setTimeout(() => {
                ws.close();
                rej(new Error(`gateway connect timed out (${OPEN_TIMEOUT_MS / 1000}s) against ${url}`));
            }, OPEN_TIMEOUT_MS);
            ws.addEventListener('open', () => {
                clearTimeout(timer);
                res(new GatewayLink(ws, url));
            });
            ws.addEventListener('error', () => {
                clearTimeout(timer);
                rej(new Error(`could not reach the gateway at ${url}`));
            });
            ws.addEventListener('close', (event) => {
                clearTimeout(timer);
                rej(new Error(`gateway closed before opening (code ${event.code})`));
            });
        });
    }
    get isOpen() {
        return this.closed === null;
    }
    onMessage(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    onClose(handler) {
        this.closers.add(handler);
        return () => this.closers.delete(handler);
    }
    event(data) {
        this.write({ id: freshMsgId(), meta: { kind: 'event' }, data });
    }
    request(kind, data) {
        if (this.closed !== null)
            return Promise.reject(new Error(this.closed));
        const id = freshMsgId();
        const key = uuidToString(id);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(key);
                reject(new Error(`gateway ${kind} timed out (${REQUEST_TIMEOUT_MS / 1000}s) against ${this.url}`));
            }, REQUEST_TIMEOUT_MS);
            this.pending.set(key, { resolve, reject, timer });
            this.write({ id, meta: { kind }, data });
        });
    }
    close() {
        try {
            this.ws.close();
        }
        catch { }
        this.finish('gateway link closed');
    }
    write(message) {
        if (this.closed !== null)
            return;
        this.ws.send(frame(message));
    }
    receive(raw) {
        const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw instanceof Uint8Array ? raw : null;
        if (!bytes)
            return;
        try {
            this.acc.append(bytes);
            for (let msg = this.acc.next(); msg !== null; msg = this.acc.next())
                this.dispatch(msg);
        }
        catch (err) {
            this.finish(err instanceof Error ? err.message : String(err));
            this.close();
        }
    }
    dispatch(msg) {
        if (msg.meta?.kind === 'response') {
            const waiting = this.pending.get(uuidToString(msg.meta.data.requestId));
            if (waiting) {
                this.pending.delete(uuidToString(msg.meta.data.requestId));
                clearTimeout(waiting.timer);
                waiting.resolve(msg.data);
                return;
            }
        }
        for (const handler of [...this.handlers])
            handler(msg.data);
    }
    finish(reason) {
        if (this.closed !== null)
            return;
        this.closed = reason;
        for (const waiting of this.pending.values()) {
            clearTimeout(waiting.timer);
            waiting.reject(new Error(reason));
        }
        this.pending.clear();
        for (const closer of [...this.closers])
            closer(reason);
    }
}
async function exchange(target, kind, data) {
    const link = await GatewayLink.open(target);
    try {
        return await link.request(kind, data);
    }
    finally {
        link.close();
    }
}
function interpret(data, expected) {
    const outer = data;
    if (outer?.type !== 'webapp') {
        return { ok: false, reason: `unexpected response type ${JSON.stringify(outer?.type)}` };
    }
    const inner = outer.data;
    if (inner?.event === expected)
        return { ok: true, value: inner.data };
    if (inner?.event === 'webappError') {
        const err = inner.data;
        return { ok: false, reason: `daemon refused: ${err?.type} ${JSON.stringify(err?.data ?? {})}` };
    }
    return { ok: false, reason: `unexpected webapp response variant ${JSON.stringify(inner?.event)}` };
}
export async function switchTo(target, id) {
    const data = { type: 'webapp', data: { event: 'switchTo', data: { id: parseUuid(id) } } };
    return interpret(await exchange(target, 'request', data), 'switched');
}
export async function setSlot(target, slot, id) {
    const data = {
        type: 'webapp',
        data: { event: 'setSlot', data: { slot, id: id === null ? null : parseUuid(id) } },
    };
    return interpret(await exchange(target, 'request', data), 'slots');
}
export async function listWebapps(target) {
    const data = { type: 'webapp', data: { event: 'list' } };
    return interpret(await exchange(target, 'request', data), 'webapps');
}
export async function navigateKiosk(target, url) {
    await exchange(target, 'command', { type: 'chrome', data: { event: 'navigate', data: { url } } });
}
export async function getActive(link) {
    return interpret(await link.request('request', { type: 'webapp', data: { event: 'getActive' } }), 'active');
}
export async function listConfig(link, id) {
    const data = { type: 'webapp', data: { event: 'configList', data: { id: parseUuid(id) } } };
    return interpret(await link.request('request', data), 'configList');
}
export async function getNickname(link) {
    const reply = (await link.request('request', { type: 'system', data: { event: 'deviceGetNickname' } }));
    if (reply?.type !== 'system' || reply.data?.event !== 'deviceNickname')
        return null;
    return reply.data.data?.nickname ?? null;
}
//# sourceMappingURL=gateway.js.map