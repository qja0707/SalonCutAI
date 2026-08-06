import { Suspense } from "react";
import { CaptionGenerator } from "./caption-generator";

export default function GenerateCaptionPage() {
  return (
    <Suspense>
      <CaptionGenerator />
    </Suspense>
  );
}
