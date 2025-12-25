"use client";

import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { OpportunityResult } from "@/lib/types";

type ScoreResponse = {
  seed: string;
  generatedAt: string;
  results: OpportunityResult[];
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function Home() {
  const [seed, setSeed] = useState("");
  const [limitKeywords, setLimitKeywords] = useState(25);
  const [maxVideos, setMaxVideos] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<OpportunityResult | null>(null);

  const results = data?.results ?? [];

  const hasResults = results.length > 0;

  const handleAnalyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!seed.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSelected(null);

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seed: seed.trim(),
          limitKeywords,
          maxVideos,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Request failed.");
      }

      const payload = (await response.json()) as ScoreResponse;
      setData(payload);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (item: OpportunityResult) => {
    setSelected(item);
    setDrawerOpen(true);
  };

  const coverageBadgeClass = (label: OpportunityResult["coverageLabel"]) => {
    if (label === "Strong") return "bg-emerald-100 text-emerald-900";
    if (label === "Medium") return "bg-amber-100 text-amber-900";
    return "bg-rose-100 text-rose-900";
  };

  const freshnessBadgeClass = (label: OpportunityResult["freshnessLabel"]) => {
    if (label === "Fresh") return "bg-emerald-100 text-emerald-900";
    if (label === "Aging") return "bg-orange-100 text-orange-900";
    return "bg-zinc-200 text-zinc-900";
  };

  const fitBadgeClass = (label: "Perfect" | "Close" | "Off") => {
    if (label === "Perfect") return "bg-emerald-100 text-emerald-900";
    if (label === "Close") return "bg-amber-100 text-amber-900";
    return "bg-zinc-200 text-zinc-900";
  };

  const drawerVideos = useMemo(() => selected?.topVideos.slice(0, 10) ?? [], [
    selected,
  ]);

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
              Enter a seed keyword and discover opportunities where demand is
              high, coverage is weak, and top videos are aging.
            </p>
          </div>
        </header>

        <Card className="border-black/5 bg-white/80 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Keyword gap scan</CardTitle>
            <CardDescription>
              Pull keyword ideas from KeywordTool.io and score YouTube results in
              seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={handleAnalyze}>
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium text-zinc-700">
                    Seed keyword
                  </label>
                  <Input
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                    placeholder="how to grow on youtube"
                    className="h-12 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 px-6"
                  disabled={loading || seed.trim().length < 2}
                >
                  {loading ? "Scanning..." : "Find gaps"}
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700">
                      Keywords to analyze
                    </span>
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={limitKeywords}
                      onChange={(event) =>
                        setLimitKeywords(
                          clamp(Number(event.target.value), 5, 50)
                        )
                      }
                      className="w-20 text-right"
                    />
                  </div>
                  <Slider
                    min={5}
                    max={50}
                    step={1}
                    value={[limitKeywords]}
                    onValueChange={(value) => setLimitKeywords(value[0])}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700">
                      Videos per keyword
                    </span>
                    <Input
                      type="number"
                      min={10}
                      max={50}
                      value={maxVideos}
                      onChange={(event) =>
                        setMaxVideos(clamp(Number(event.target.value), 10, 50))
                      }
                      className="w-20 text-right"
                    />
                  </div>
                  <Slider
                    min={10}
                    max={50}
                    step={1}
                    value={[maxVideos]}
                    onValueChange={(value) => setMaxVideos(value[0])}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">
                Opportunity results
              </h2>
              <p className="text-sm text-zinc-600">
                Ranked by gap score (0-100).
              </p>
            </div>
            {data?.generatedAt && (
              <span className="text-xs text-zinc-500">
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && !hasResults && (
            <Alert>
              <AlertTitle>No results yet</AlertTitle>
              <AlertDescription>
                Enter a seed keyword to see ranked opportunities.
              </AlertDescription>
            </Alert>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`skeleton-row-${index}`}
                    className="grid grid-cols-5 gap-4"
                  >
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!loading && hasResults && (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Best answer age</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item) => (
                      <TableRow
                        key={item.keyword}
                        className="cursor-pointer transition hover:bg-muted/40"
                        onClick={() => handleOpenDrawer(item)}
                      >
                        <TableCell className="font-medium text-zinc-900">
                          {item.keyword}
                        </TableCell>
                        <TableCell>{formatNumber(item.volume)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress value={item.score} className="h-2 w-24" />
                            <span className="text-sm font-semibold">
                              {item.score}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "border-transparent",
                              coverageBadgeClass(item.coverageLabel)
                            )}
                          >
                            {item.coverageLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {Math.round(item.bestGoodFitAgeDays)}d
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "border-transparent",
                                freshnessBadgeClass(item.freshnessLabel)
                              )}
                            >
                              {item.freshnessLabel}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenDrawer(item);
                            }}
                          >
                            View gap
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-white/95">
          <div className="mx-auto w-full max-w-4xl">
            <DrawerHeader>
              <DrawerTitle className="text-2xl">
                {selected?.keyword || "Keyword details"}
              </DrawerTitle>
              <DrawerDescription>
                {selected
                  ? `Gap score ${selected.score} - Volume ${formatNumber(
                      selected.volume
                    )}`
                  : "Pick a keyword to inspect the opportunity details."}
              </DrawerDescription>
            </DrawerHeader>

            {!selected && (
              <div className="px-4 pb-10">
                <Card>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={`drawer-skel-${index}`} className="h-6" />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {selected && (
              <div className="space-y-6 px-4 pb-10">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Volume</CardDescription>
                      <CardTitle className="text-2xl">
                        {formatNumber(selected.volume)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Avg top fit</CardDescription>
                      <CardTitle className="text-2xl">
                        {Math.round(selected.avgTopFit * 100)}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Weak fit rate</CardDescription>
                      <CardTitle className="text-2xl">
                        {Math.round(selected.weakFitRate * 100)}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Best answer age</CardDescription>
                      <CardTitle className="text-2xl">
                        {Math.round(selected.bestGoodFitAgeDays)}d
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card className="border-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Why this is a gap
                    </CardTitle>
                    <CardDescription>
                      Signals that suggest an opportunity for new content.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                      {selected.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      Top competing videos
                    </h3>
                    <p className="text-sm text-zinc-600">
                      The current YouTube results for this keyword.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {drawerVideos.map((video) => (
                      <Card key={video.id} className="border-black/5">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base font-semibold text-zinc-900 hover:underline"
                            >
                              {video.title}
                            </a>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className={cn(
                                  "border-transparent",
                                  fitBadgeClass(video.fitLabel)
                                )}
                              >
                                {video.fitLabel} fit
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "border-transparent",
                                  freshnessBadgeClass(
                                    video.ageDays < 90
                                      ? "Fresh"
                                      : video.ageDays < 365
                                      ? "Aging"
                                      : "Stale"
                                  )
                                )}
                              >
                                {video.ageDays}d
                              </Badge>
                              <Badge variant="outline">
                                {formatNumber(video.viewCount)} views
                              </Badge>
                            </div>
                          </div>
                          <CardDescription>
                            Published {new Date(video.publishedAt).toLocaleDateString()} - Fit {Math.round(video.fit * 100)}%
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
