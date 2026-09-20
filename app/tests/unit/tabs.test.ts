import { describe, expect, it } from "vitest";
import {
  closeTab,
  fixTab,
  keepTabs,
  noTabs,
  openTab,
  parseTabs,
  tabAt,
  tabBeside,
  type TabsState,
} from "@/lib/tabs";

function tabs(ids: string[], previewId: string | null = null): TabsState {
  return { ids, previewId };
}

describe("openTab", () => {
  it("opens the first diagram as a preview tab", () => {
    expect(openTab(noTabs, "a")).toEqual(tabs(["a"], "a"));
  });

  it("replaces the preview tab in place, so the fixed tabs keep their order", () => {
    const state = tabs(["a", "b", "c"], "b");

    expect(openTab(state, "d")).toEqual(tabs(["a", "d", "c"], "d"));
  });

  it("appends when no tab is a preview", () => {
    expect(openTab(tabs(["a", "b"]), "c")).toEqual(tabs(["a", "b", "c"], "c"));
  });

  it("leaves an open tab exactly as it is, preview or fixed", () => {
    const fixed = tabs(["a", "b"], "b");

    expect(openTab(fixed, "a")).toBe(fixed);
    expect(openTab(fixed, "b")).toBe(fixed);
  });
});

describe("fixTab", () => {
  it("keeps the preview tab, without moving it", () => {
    expect(fixTab(tabs(["a", "b", "c"], "b"), "b")).toEqual(tabs(["a", "b", "c"]));
  });

  it("leaves a tab that is already fixed alone", () => {
    const state = tabs(["a", "b"], "b");

    expect(fixTab(state, "a")).toBe(state);
  });

  it("opens a diagram that has no tab as a fixed one", () => {
    expect(fixTab(tabs(["a"]), "b")).toEqual(tabs(["a", "b"]));
  });
});

describe("closeTab", () => {
  it("moves to the tab on the right when the active one closes", () => {
    const change = closeTab(tabs(["a", "b", "c"]), "b", "b");

    expect(change.state).toEqual(tabs(["a", "c"]));
    expect(change.next).toBe("c");
  });

  it("falls back to the left when the active tab was the last one", () => {
    expect(closeTab(tabs(["a", "b"]), "b", "b").next).toBe("a");
  });

  it("leaves the active diagram open when another tab closes", () => {
    const change = closeTab(tabs(["a", "b"], "a"), "a", "b");

    expect(change.state).toEqual(tabs(["b"]));
    expect(change.next).toBe("b");
  });

  it("answers nothing when the last tab closes", () => {
    expect(closeTab(tabs(["a"], "a"), "a", "a")).toEqual({ state: noTabs, next: null });
  });

  it("ignores a tab that is not open", () => {
    const state = tabs(["a"], "a");

    expect(closeTab(state, "b", "a").state).toBe(state);
  });
});

describe("keepTabs", () => {
  it("closes the tabs of diagrams the list no longer has", () => {
    const change = keepTabs(tabs(["a", "b", "c"], "c"), ["a", "c"], "a");

    expect(change.state).toEqual(tabs(["a", "c"], "c"));
    expect(change.next).toBe("a");
  });

  it("moves on when the active diagram is the one that is gone", () => {
    expect(keepTabs(tabs(["a", "b", "c"]), ["a", "c"], "b").next).toBe("c");
  });

  it("answers nothing when a folder took every open diagram", () => {
    const change = keepTabs(tabs(["a", "b"]), [], "a");

    expect(change.state).toEqual(noTabs);
    expect(change.next).toBeNull();
  });

  it("forgets a preview tab that is gone", () => {
    expect(keepTabs(tabs(["a", "b"], "b"), ["a"], "a").state).toEqual(tabs(["a"]));
  });

  it("changes nothing while every tab is still alive", () => {
    const state = tabs(["a", "b"], "b");
    const change = keepTabs(state, ["a", "b", "c"], "a");

    expect(change.state).toBe(state);
    expect(change.next).toBe("a");
  });
});

describe("parseTabs", () => {
  it("reads back what it was given", () => {
    const state = tabs(["a", "b"], "b");

    expect(parseTabs(JSON.stringify(state))).toEqual(state);
  });

  it("falls back to no tabs on anything it cannot trust", () => {
    expect(parseTabs(null)).toBe(noTabs);
    expect(parseTabs("{")).toBe(noTabs);
    expect(parseTabs('"a"')).toBe(noTabs);
    expect(parseTabs('{"ids":[1,2]}')).toBe(noTabs);
  });

  it("drops a preview id that is not one of the tabs, and repeated tabs", () => {
    expect(parseTabs('{"ids":["a","a","b"],"previewId":"c"}')).toEqual(tabs(["a", "b"]));
  });
});

describe("tabAt and tabBeside", () => {
  it("jumps by position and answers nothing past the last tab", () => {
    expect(tabAt(tabs(["a", "b"]), 1)).toBe("b");
    expect(tabAt(tabs(["a", "b"]), 4)).toBeNull();
  });

  it("cycles around both ends", () => {
    const state = tabs(["a", "b", "c"]);

    expect(tabBeside(state, "c", 1)).toBe("a");
    expect(tabBeside(state, "a", -1)).toBe("c");
  });

  it("has nothing to cycle to with no tabs", () => {
    expect(tabBeside(noTabs, null, 1)).toBeNull();
  });
});
