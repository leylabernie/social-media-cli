/**
 * Minimal type declarations for playwright-core.
 * playwright-core is a peer dependency of playwright-extra.
 * These declarations provide the types needed by the project.
 */

declare module 'playwright-core' {
  export interface Page {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<Response | null>;
    url(): string;
    $(selector: string): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
    $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]>;
    waitForSelector(selector: string, options?: { state?: string; timeout?: number }): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
    locator(selector: string): Locator;
    evaluate<R, Arg>(fn: (arg: Arg) => R, arg: Arg): Promise<R>;
    evaluate<R>(fn: () => R): Promise<R>;
    keyboard: Keyboard;
    mouse: Mouse;
    click(selector: string, options?: { timeout?: number }): Promise<void>;
    hover(selector: string, options?: { timeout?: number }): Promise<void>;
    focus(selector: string): Promise<void>;
    setInputFiles(selector: string, files: string | string[]): Promise<void>;
    screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
    viewportSize(): { width: number; height: number } | null;
    context(): BrowserContext;
    on(event: string, listener: (...args: any[]) => void): void;
    addInitScript(fn: () => void): Promise<void>;
    addInitScript(options: { content: string }): Promise<void>;
  }

  export interface Locator {
    first(): Locator;
    isVisible(options?: { timeout?: number }): Promise<boolean>;
    waitFor(options?: { state?: string; timeout?: number }): Promise<void>;
    getAttribute(name: string, options?: { timeout?: number }): Promise<string | null>;
    setInputFiles(files: string | string[]): Promise<void>;
    boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    type(text: string, options?: { delay?: number }): Promise<void>;
    press(key: string): Promise<void>;
    textContent(): Promise<string | null>;
    innerText(): Promise<string>;
    innerHTML(): Promise<string>;
    dispose(): Promise<void>;
  }

  export interface Keyboard {
    type(text: string, options?: { delay?: number }): Promise<void>;
    press(key: string, options?: { delay?: number }): Promise<void>;
  }

  export interface Mouse {
    click(x: number, y: number): Promise<void>;
    move(x: number, y: number, options?: { steps?: number }): Promise<void>;
  }

  export interface Response {
    ok(): boolean;
    status(): number;
    statusText(): string;
    text(): Promise<string>;
    json(): Promise<any>;
  }

  export interface ElementHandle<T = any> {
    getAttribute(name: string): Promise<string | null>;
    setInputFiles(files: string | string[]): Promise<void>;
    click(): Promise<void>;
    type(text: string, options?: { delay?: number }): Promise<void>;
    fill(value: string): Promise<void>;
    evaluate<R>(fn: (el: T) => R): Promise<R>;
    dispose(): Promise<void>;
    boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
    $(selector: string): Promise<ElementHandle | null>;
    waitForSelector(selector: string, options?: { state?: string; timeout?: number }): Promise<ElementHandle | null>;
  }

  export interface BrowserContext {
    pages(): Page[];
    newPage(): Promise<Page>;
    close(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export interface Browser {
    newContext(options?: any): Promise<BrowserContext>;
    newPage(options?: any): Promise<Page>;
    close(): Promise<void>;
    contexts(): BrowserContext[];
  }

  export interface BrowserType {
    launch(options?: any): Promise<Browser>;
    launchPersistentContext(userDataDir: string, options?: any): Promise<BrowserContext>;
    connect(options?: any): Promise<Browser>;
    connectOverCDP(endpointUR: string, options?: any): Promise<Browser>;
  }

  export const chromium: BrowserType;
  export const firefox: BrowserType;
  export const webkit: BrowserType;
}
