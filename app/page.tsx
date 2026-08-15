import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-24">
      <header className="flex flex-col gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          overnight research desk
        </span>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          3d-night
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          Every surface answers two questions at once: what happened last night,
          and what that means in context. The dashboard and the{" "}
          <span className="font-mono">/explore</span> terrain are on their way.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <Button disabled>Dashboard</Button>
        <Button variant="outline" disabled>
          Explore
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          scaffold · step 1
        </span>
      </div>
    </main>
  );
}
