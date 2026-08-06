function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />;
}

export function PreserveChangeChips({ preserve, change }: { preserve?: string; change?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {preserve && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/12 px-2.5 py-1 text-xs font-mono text-teal-600 dark:text-teal-400">
          <Dot />
          보존 · {preserve}
        </span>
      )}
      {change && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-mono text-primary">
          <Dot />
          생성 · {change}
        </span>
      )}
    </div>
  );
}
