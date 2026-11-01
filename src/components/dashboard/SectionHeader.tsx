export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="rounded-lg p-3 mt-8" style={{ backgroundColor: "#0D4F4F" }}>
      <h2 className="text-sm font-bold text-white tracking-wide uppercase whitespace-pre-line">{title}</h2>
    </div>
  );
}
