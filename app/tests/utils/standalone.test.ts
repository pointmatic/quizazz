// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { resolveStandalone } from "$lib/utils/standalone";
import type { QuizManifest } from "$lib/types";

function makeManifest(quizName: string): QuizManifest {
  return {
    quizName,
    schemaVersion: "1.0",
    tree: [],
    questions: [],
  };
}

describe("resolveStandalone", () => {
  const manifests: QuizManifest[] = [
    makeManifest("alpha"),
    makeManifest("beta"),
    makeManifest("gamma"),
  ];

  it("returns mode 'unset' when standalone is null", () => {
    const result = resolveStandalone(null, manifests);
    expect(result).toEqual({ mode: "unset" });
  });

  it("returns mode 'unset' when standalone is undefined", () => {
    const result = resolveStandalone(undefined, manifests);
    expect(result).toEqual({ mode: "unset" });
  });

  it("returns mode 'unset' when standalone is the empty string", () => {
    // Vite exposes unset env vars as undefined or "" depending on the setup;
    // either should be treated as 'no standalone'.
    const result = resolveStandalone("", manifests);
    expect(result).toEqual({ mode: "unset" });
  });

  it("returns mode 'matched' with the manifest when the target exists", () => {
    const result = resolveStandalone("beta", manifests);
    expect(result.mode).toBe("matched");
    if (result.mode === "matched") {
      expect(result.manifest.quizName).toBe("beta");
    }
  });

  it("returns mode 'missing' with the requested target when no manifest matches", () => {
    const result = resolveStandalone("nonexistent", manifests);
    expect(result).toEqual({ mode: "missing", target: "nonexistent" });
  });

  it("returns mode 'missing' when the manifests list is empty", () => {
    const result = resolveStandalone("alpha", []);
    expect(result).toEqual({ mode: "missing", target: "alpha" });
  });
});
