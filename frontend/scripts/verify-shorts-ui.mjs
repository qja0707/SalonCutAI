import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CAPTION_CONTEXT_LENGTH,
  buildCaptionPrompt,
} from "../src/app/generate/shorts/shared.ts";

test("100자 주제와 가장 긴 분위기를 API 제한 안에서 조합한다", () => {
  const prompt = buildCaptionPrompt("가".repeat(100), "예약 유도");

  assert.equal(prompt.length, MAX_CAPTION_CONTEXT_LENGTH);
  assert.equal(prompt.endsWith("\n분위기: 예약 유도"), true);
});

test("분위기만 선택해도 접미사만 보낸다", () => {
  assert.equal(buildCaptionPrompt("", "전문"), "분위기: 전문");
});
