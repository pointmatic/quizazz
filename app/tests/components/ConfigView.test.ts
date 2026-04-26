// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import ConfigView from "$lib/components/ConfigView.svelte";
import type { Question } from "$lib/types";

function makeQuestions(
  n: number,
  tagsFor?: (i: number) => string[],
): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    question: `Question ${i + 1}?`,
    tags: tagsFor?.(i) ?? [],
    topicId: "topic1",
    subtopic: null,
    answers: [
      { text: `A${i}`, explanation: "", category: "correct" as const },
      { text: `B${i}`, explanation: "", category: "incorrect" as const },
      { text: `C${i}`, explanation: "", category: "incorrect" as const },
      { text: `D${i}`, explanation: "", category: "incorrect" as const },
      { text: `E${i}`, explanation: "", category: "ridiculous" as const },
    ],
  }));
}

describe("ConfigView", () => {
  afterEach(() => cleanup());

  it("caps the initial question count at 10 when the pool is large", async () => {
    const { getByLabelText } = render(ConfigView, {
      props: { questions: makeQuestions(50), allTags: [], onStart: vi.fn() },
    });
    await tick();
    const slider = getByLabelText("Number of questions") as HTMLInputElement;
    expect(slider.value).toBe("10");
  });

  it("uses the pool size as the initial question count when smaller than the cap", async () => {
    const { getByLabelText } = render(ConfigView, {
      props: { questions: makeQuestions(5), allTags: [], onStart: vi.fn() },
    });
    await tick();
    const slider = getByLabelText("Number of questions") as HTMLInputElement;
    expect(slider.value).toBe("5");
  });

  it("clamps question count when a tag filter narrows the pool", async () => {
    const allTags = ["easy", "hard"];
    const questions = makeQuestions(20, (i) => (i < 3 ? ["easy"] : ["hard"]));
    const { getByLabelText, getByText } = render(ConfigView, {
      props: { questions, allTags, onStart: vi.fn() },
    });
    await tick();
    const slider = getByLabelText("Number of questions") as HTMLInputElement;
    expect(slider.value).toBe("10");
    await fireEvent.click(getByText("easy"));
    await tick();
    expect(slider.value).toBe("3");
  });

  it("disables Start and shows the no-match message when a tag filter eliminates all questions", async () => {
    const allTags = ["present", "absent"];
    const questions = makeQuestions(5, () => ["present"]);
    const { getByText } = render(ConfigView, {
      props: { questions, allTags, onStart: vi.fn() },
    });
    await tick();
    await fireEvent.click(getByText("absent"));
    await tick();
    const startBtn = getByText(
      "No questions match selected tags",
    ) as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
  });

  it("invokes onStart with the current questionCount, answerCount, and selectedTags", async () => {
    const onStart = vi.fn();
    const { getByText } = render(ConfigView, {
      props: { questions: makeQuestions(7), allTags: [], onStart },
    });
    await tick();
    await fireEvent.click(getByText("Start Quiz"));
    expect(onStart).toHaveBeenCalledWith(7, 4, []);
  });
});
