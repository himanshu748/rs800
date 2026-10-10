import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCountUp } from "../components/landing/motion";

let root: Root;
let dom: JSDOM;
let clock: number;
let nextFrame: number;
let frames: Map<number, FrameRequestCallback>;
let values: number[];
let reduced: boolean;
let mediaListeners: Set<() => void>;
let originalNow: typeof performance.now;

function Counter({ target, duration = 900 }: { target: number; duration?: number }) {
  const value = useCountUp(target, duration);
  useLayoutEffect(() => { values.push(value); }, [value]);
  return <output>{value}</output>;
}

function render(target: number, duration = 900) {
  act(() => root.render(<Counter target={target} duration={duration} />));
}

function frame(timestamp: number) {
  clock = timestamp;
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((callback) => callback(timestamp)));
}

function value() {
  return Number(dom.window.document.querySelector("output")!.textContent);
}

beforeEach(() => {
  dom = new JSDOM("<!doctype html><div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  clock = 100;
  nextFrame = 0;
  frames = new Map();
  values = [];
  reduced = false;
  mediaListeners = new Set();
  Object.defineProperty(dom.window, "matchMedia", { value: () => ({
    get matches() { return reduced; },
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
  }) });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
  originalNow = performance.now;
  performance.now = () => clock;
  root = createRoot(dom.window.document.getElementById("root")!);
});

afterEach(() => {
  act(() => root.unmount());
  performance.now = originalNow;
  dom.window.close();
});

test("an early frame cannot make a non-negative income negative", () => {
  render(0);
  render(800);
  frame(99);
  assert.equal(value(), 0);
  frame(550);
  assert.equal(value(), 700);
  frame(1100);
  assert.equal(value(), 800);
  assert.ok(values.every((v) => v >= 0 && v <= 800));
  assert.equal(frames.size, 0);
});

test("rapid replay changes continue from the last displayed income", () => {
  render(0);
  render(800);
  frame(550);
  assert.equal(value(), 700);
  render(650);
  frame(550);
  assert.equal(value(), 700, "changing target must not jump back to zero");
  frame(700);
  const interrupted = value();
  assert.ok(interrupted > 650 && interrupted < 700);
  render(0);
  frame(700);
  assert.equal(value(), interrupted);
  frame(1600);
  assert.equal(value(), 0);
  assert.equal(frames.size, 0);
});

test("a cancelled frame cannot update a new animation or schedule more work", () => {
  render(0);
  render(800);
  const staleFrame = [...frames.values()][0];
  render(650);
  act(() => staleFrame(1000));
  assert.equal(value(), 0);
  assert.equal(frames.size, 1);
  frame(1000);
  assert.equal(value(), 650);
  act(() => root.unmount());
  assert.equal(frames.size, 0);
});

test("zero and negative duration show the target immediately without scheduling", () => {
  render(0);
  render(800, 0);
  assert.equal(value(), 800);
  assert.equal(frames.size, 0);
  render(650, -1);
  assert.equal(value(), 650);
  assert.equal(frames.size, 0);
});

test("reduced motion shows the current target and cancels animation", () => {
  render(0);
  render(800);
  frame(550);
  act(() => { reduced = true; mediaListeners.forEach((listener) => listener()); });
  assert.equal(value(), 800);
  assert.equal(frames.size, 0);
  render(650);
  assert.equal(value(), 650);
  act(() => { reduced = false; mediaListeners.forEach((listener) => listener()); });
  frame(550);
  assert.equal(value(), 650);
  render(0);
  frame(550);
  assert.equal(value(), 650);
});
