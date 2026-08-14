export function BeforeAfter({
  originalUrl,
  originalLabel = "업로드한 사진",
  after,
}: {
  originalUrl: string | null;
  originalLabel?: string;
  after: React.ReactNode;
}) {
  if (!originalUrl) return <div className="w-full">{after}</div>;
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="space-y-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={originalUrl} alt={originalLabel} className="aspect-square w-full rounded-lg border border-border object-cover" />
        <figcaption className="text-center text-xs text-muted-foreground">{originalLabel}</figcaption>
      </figure>
      <div className="space-y-1.5">
        {after}
        <p className="text-center text-xs text-muted-foreground">결과</p>
      </div>
    </div>
  );
}
