import test from "node:test";
import assert from "node:assert/strict";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";

function fakeContainer() {
  return {
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    }
  };
}

function listenerHarness() {
  const listeners = new Set();
  return {
    add(listener) {
      assert.equal(listeners.has(listener), false, "duplicate listener registration");
      listeners.add(listener);
    },
    remove(listener) {
      listeners.delete(listener);
    },
    get active() {
      return listeners.size;
    }
  };
}

test("TS-058 boundary keys are stable and include view, project and identity", () => {
  const key = reactBoundaryKey({ view: "subject", subjectId: "p1", identity: "local" });
  assert.equal(key, "subject|p1|local");
  assert.equal(key, reactBoundaryKey({ view: "subject", subjectId: "p1", identity: "local" }));
  assert.notEqual(key, reactBoundaryKey({ view: "subject", subjectId: "p2", identity: "local" }));
  assert.notEqual(key, reactBoundaryKey({ view: "overview", identity: "local" }));
  assert.notEqual(key, reactBoundaryKey({ view: "subject", subjectId: "p1", identity: "synced:db:digest" }));
  assert.throws(() => reactBoundaryKey({}));
});

test("TS-058 mount is idempotent for the same key and container", () => {
  const boundary = createReactBoundary();
  const container = fakeContainer();
  const harness = listenerHarness();
  const listener = () => {};
  let unmounts = 0;
  const first = boundary.mount({
    key: "subject|p1|local",
    container,
    unmount() {
      unmounts += 1;
      harness.remove(listener);
    }
  });
  harness.add(listener);
  assert.equal(first.status, "mounted");
  assert.equal(boundary.activeCount(), 1);
  assert.equal(boundary.owner().key, "subject|p1|local");

  const second = boundary.mount({
    key: "subject|p1|local",
    container,
    unmount() { unmounts += 1; }
  });
  assert.equal(second.status, "reused");
  assert.equal(boundary.activeCount(), 1);
  assert.equal(harness.active, 1);
  assert.equal(unmounts, 0);

  assert.equal(second.release("navigation"), true);
  assert.equal(unmounts, 1);
  assert.equal(harness.active, 0);
  assert.equal(boundary.owner(), null);
  assert.equal(boundary.activeCount(), 0);
});

test("TS-058 a second owner is refused until the first root is released", () => {
  const boundary = createReactBoundary();
  const container = fakeContainer();
  const other = fakeContainer();
  let unmounts = 0;
  boundary.mount({ key: "subject|p1|local", container, unmount: () => { unmounts += 1; } });
  const differentKey = boundary.mount({
    key: "subject|p2|local",
    container: other,
    unmount() { throw new Error("second owner must not mount"); }
  });
  assert.equal(differentKey.status, "refused");
  assert.equal(differentKey.reason, "boundary-busy");
  assert.equal(boundary.owner().key, "subject|p1|local");
  assert.equal(boundary.activeCount(), 1);

  const sameKeyOtherContainer = boundary.mount({
    key: "subject|p1|local",
    container: other,
    unmount() { throw new Error("second container must not mount"); }
  });
  assert.equal(sameKeyOtherContainer.status, "refused");
  assert.equal(unmounts, 0);

  boundary.unmount("route-change");
  assert.equal(unmounts, 1);
  const next = boundary.mount({ key: "subject|p2|local", container: other, unmount() {} });
  assert.equal(next.status, "mounted");
  assert.equal(boundary.activeCount(), 1);
});

test("TS-058 vanilla writes are refused while a root owns the container", () => {
  const boundary = createReactBoundary();
  const container = fakeContainer();
  boundary.mount({ key: "subject|p1|local", container, unmount() {} });
  assert.equal(boundary.owns(container), true);
  assert.equal(boundary.canWriteVanilla(container), false);
  if (boundary.canWriteVanilla(container)) container.replaceChildren("vanilla");
  assert.deepEqual(container.children, []);

  const other = fakeContainer();
  assert.equal(boundary.canWriteVanilla(other), true);

  boundary.unmount("return-to-vanilla");
  assert.equal(boundary.canWriteVanilla(container), true);
  container.replaceChildren("vanilla");
  assert.deepEqual(container.children, ["vanilla"]);
});

test("TS-058 invalidation unmounts once and records the transition reason", () => {
  const boundary = createReactBoundary();
  const container = fakeContainer();
  const calls = [];
  const handle = boundary.mount({
    key: "subject|p1|local",
    container,
    unmount(payload) { calls.push(payload); }
  });
  assert.equal(boundary.invalidate("route-change"), true);
  assert.equal(boundary.invalidate("identity-change"), false);
  assert.equal(handle.release("late-release"), false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { reason: "route-change", invalidated: true });
  assert.deepEqual(boundary.lastInvalidation(), { reason: "route-change", generation: 1 });
  assert.equal(boundary.owner(), null);
  assert.equal(boundary.activeCount(), 0);
  assert.equal(boundary.canWriteVanilla(container), true);
});

test("TS-058 repeated navigation and refresh cycles never accumulate owners or listeners", () => {
  const boundary = createReactBoundary();
  const container = fakeContainer();
  const harness = listenerHarness();
  let mounts = 0;
  let unmounts = 0;

  for (let cycle = 0; cycle < 12; cycle += 1) {
    const key = "subject|p" + cycle + "|local";
    const listener = () => {};
    const mounted = boundary.mount({
      key,
      container,
      unmount() {
        unmounts += 1;
        harness.remove(listener);
      }
    });
    assert.equal(mounted.status, "mounted");
    mounts += 1;
    harness.add(listener);
    assert.equal(boundary.activeCount(), 1);
    assert.equal(harness.active, 1);

    const reused = boundary.mount({ key, container, unmount() { throw new Error("reused mount must not replace callback"); } });
    assert.equal(reused.status, "reused");
    assert.equal(harness.active, 1);

    if (cycle % 2 === 0) {
      boundary.invalidate("refresh-navigation");
    } else {
      boundary.unmount("refresh-navigation");
    }
    assert.equal(harness.active, 0);
    assert.equal(boundary.activeCount(), 0);
    assert.equal(container.children.length, 0);
  }

  assert.equal(mounts, 12);
  assert.equal(unmounts, 12);
});

test("TS-058 mount rejects an incomplete contract", () => {
  const boundary = createReactBoundary();
  assert.throws(() => boundary.mount({ key: "", container: fakeContainer(), unmount() {} }));
  assert.throws(() => boundary.mount({ key: "subject|p1|local", container: null, unmount() {} }));
  assert.throws(() => boundary.mount({ key: "subject|p1|local", container: fakeContainer() }));
});
