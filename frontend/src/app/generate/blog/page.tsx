import { Suspense } from "react";
import { BlogGenerator } from "./blog-generator";

export default function GenerateBlogPage() {
  return (
    <Suspense>
      <BlogGenerator />
    </Suspense>
  );
}
