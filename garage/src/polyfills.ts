import { Buffer } from 'buffer';

window.global = window.global ?? window;
(window as any).Buffer = (window as any).Buffer ?? Buffer;
window.process = window.process ?? { env: {} }; // Minimal process polyfill

export {};
