"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExploreTab } from "@/components/explore-tab";
import { PlannerTab } from "@/components/planner-tab";
import { usePlanner } from "@/hooks/usePlanner";

export default function Home() {
  const planner = usePlanner();
  const [activeTab, setActiveTab] = useState("discover");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-16 h-72 w-72 rounded-full bg-heat/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-heat-2/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,130,80,0.12),_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-12">
        <header className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-heat text-heat-foreground shadow-sm">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  hotcontent.app
                </p>
                <p className="text-xs text-muted-foreground">
                  Find what's about to blow up. Publish first.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="border-transparent bg-heat/15 text-heat"
              >
                No sign-in required
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <Badge
              variant="outline"
              className="w-fit border-heat/30 bg-background/80 text-xs uppercase tracking-[0.2em] text-heat"
            >
              HotContent for YouTube
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Publish what's about to blow up.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                HotContent finds rising YouTube searches, weak or outdated results,
                and SEO-ready titles so you post before the wave peaks.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setActiveTab("discover")}>
                Find hot ideas
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setActiveTab("planner")}
              >
                Open planner
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="planner">Planner</TabsTrigger>
          </TabsList>
          <TabsContent value="discover">
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
