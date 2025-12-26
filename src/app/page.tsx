"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExploreTab } from "@/components/explore-tab";
import { PlannerTab } from "@/components/planner-tab";
import { usePlanner } from "@/hooks/usePlanner";

export default function Home() {
  const planner = usePlanner();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f7f5ef] via-white to-[#f0f4f1]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-16">
        <header className="flex flex-col gap-6">
          <Badge
            variant="outline"
            className="w-fit border-black/10 bg-white/70 text-xs uppercase tracking-[0.2em]"
          >
            YouTube Keyword Gaps
          </Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Spot high-demand keywords where YouTube is falling short.
            </h1>
            <p className="max-w-2xl text-lg text-zinc-600">
              Discover keyword gaps, plan content, and ship SEO-optimized titles faster.
            </p>
          </div>
        </header>

        <Tabs defaultValue="explore" className="w-full">
          <TabsList>
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="planner">Topic Planner</TabsTrigger>
          </TabsList>
          <TabsContent value="explore">
            <ExploreTab
              savedKeywords={planner.savedKeywordSet}
              onSave={planner.addFromOpportunity}
            />
          </TabsContent>
          <TabsContent value="planner">
            <PlannerTab
              items={planner.items}
              setItems={planner.setItems}
              updateItem={planner.updateItem}
              removeItem={planner.removeItem}
              clearItems={planner.clearItems}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
