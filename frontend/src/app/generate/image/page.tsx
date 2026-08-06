import { Suspense } from "react";
import { ImageGenerator } from "./image-generator";

export default function GenerateImagePage() {
  return (
    <Suspense>
      <ImageGenerator />
    </Suspense>
  );
}
