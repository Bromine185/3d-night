/** Shared section shell: anchor, numbered label, generous air, hairline top. */
export function Section({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-16 first:border-t-0">
      <div className="mb-10 flex items-baseline justify-between gap-6">
        <div>
          <div className="label-caps mb-2">
            {index} · {title}
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
