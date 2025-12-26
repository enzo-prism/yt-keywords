"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { buildDescriptionTemplate, buildRecommendedAngles, buildSuggestedTags, buildTitleTemplates } from "@/lib/seo";
import type { OpportunityResult } from "@/lib/types";

type ConstantsResponse = {
  countries: Array<{ code: string; label: string }>;
  languages: Array<{ code: string; label: string }>;
  suggestionModes: Array<{ value: string; label: string }>;
  trendsEnabled: boolean;
};

type ScoreResponse = {
  seed: string;
  generatedAt: string;
  results: OpportunityResult[];
  meta?: {
    totalSuggestions: number;
    filteredCount: number;
    analyzedCount: number;
    clustered: boolean;
  };
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreBadge(value: number, label: string) {
  return (
    <Badge variant="secondary" className="rounded-full text-xs">
      {label} {value}
    </Badge>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 40 - ((value - min) / range) * 32 - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 40" className="h-10 w-28">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-zinc-500"
      />
    </svg>
  );
}

const defaultConstants: ConstantsResponse = {
  countries: [{ code: "US", label: "United States" }],
  languages: [{ code: "en", label: "English" }],
  suggestionModes: [
    { value: "suggestions", label: "Autocomplete suggestions" },
    { value: "questions", label: "Questions" },
    { value: "prepositions", label: "Prepositions" },
    { value: "trends", label: "Google Trends suggestions" },
  ],
  trendsEnabled: false,
};

type ExploreTabProps = {
  savedKeywords: Set<string>;
  onSave: (opportunity: OpportunityResult) => void;
};

export function ExploreTab({ savedKeywords, onSave }: ExploreTabProps) {
  const [seed, setSeed] = useState("");
  const [maxKeywords, setMaxKeywords] = useState(25);
  const [videosPerKeyword, setVideosPerKeyword] = useState(30);
  const [country, setCountry] = useState("US");
  const [language, setLanguage] = useState("en");
  const [suggestionMode, setSuggestionMode] = useState("suggestions");
  const [minVolume, setMinVolume] = useState(0);
  const [includeTerms, setIncludeTerms] = useState("");
  const [excludeTerms, setExcludeTerms] = useState("");
  const [hideNoise, setHideNoise] = useState(true);
  const [cluster, setCluster] = useState(true);
  const [showWeighted, setShowWeighted] = useState(false);
  const [channel, setChannel] = useState("");
  const [constants, setConstants] = useState<ConstantsResponse>(defaultConstants);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<OpportunityResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const results = data?.results ?? [];
  const hasResults = results.length > 0;

  const displayResults = useMemo(() => {
    const scoreOf = (item: OpportunityResult) =>
      showWeighted && item.scores.weightedOpportunityScore !== null
        ? item.scores.weightedOpportunityScore
        : item.scores.opportunityScore;
    return [...results].sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [results, showWeighted]);

  const selectedSeo = useMemo(() => {
    if (!selected) return null;
    return {
      angles: buildRecommendedAngles(selected.keyword, selected.topVideos),
      titleTemplates: buildTitleTemplates(selected.keyword),
      descriptionTemplate: buildDescriptionTemplate(
        selected.keyword,
        selected.relatedKeywords
      ),
      suggestedTags: buildSuggestedTags(
        selected.keyword,
        selected.relatedKeywords
      ),
    };
  }, [selected]);

  const fetchConstants = async () => {
    try {
      const response = await fetch("/api/constants");
      if (!response.ok) return;
      const payload = (await response.json()) as ConstantsResponse;
      setConstants(payload);
    } catch {
      // Keep defaults.
    }
  };

  useEffect(() => {
    fetchConstants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          maxKeywords,
          videosPerKeyword,
          country,
          language,
          suggestionMode,
          minVolume,
          include: includeTerms,
          exclude: excludeTerms,
          hideNoise,
          cluster,
          channel: channel.trim() || undefined,
          showWeighted,
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

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setCopiedKey(null);
    }
  };

  const coverageBadgeClass = (label: OpportunityResult["labels"]["coverage"]) => {
    if (label === "Strong") return "bg-emerald-100 text-emerald-900";
    if (label === "Medium") return "bg-amber-100 text-amber-900";
    return "bg-rose-100 text-rose-900";
  };

  const freshnessBadgeClass = (label: OpportunityResult["labels"]["freshness"]) => {
    if (label === "Fresh") return "bg-emerald-100 text-emerald-900";
    if (label === "Aging") return "bg-orange-100 text-orange-900";
    return "bg-zinc-200 text-zinc-900";
  };

  const fitBadgeClass = (label: "Strong" | "Medium" | "Weak") => {
    if (label === "Strong") return "bg-emerald-100 text-emerald-900";
    if (label === "Medium") return "bg-amber-100 text-amber-900";
    return "bg-zinc-200 text-zinc-900";
  };

  return (
    <div className="space-y-10">
      <Card className="border-black/5 bg-white/80 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Keyword gap scan</CardTitle>
          <CardDescription>
            Analyze high-intent keywords and surface gaps that are underserved or aging.
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
                    value={maxKeywords}
                    onChange={(event) =>
                      setMaxKeywords(
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
                  value={[maxKeywords]}
                  onValueChange={(value) => setMaxKeywords(value[0])}
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
                    value={videosPerKeyword}
                    onChange={(event) =>
                      setVideosPerKeyword(
                        clamp(Number(event.target.value), 10, 50)
                      )
                    }
                    className="w-20 text-right"
                  />
                </div>
                <Slider
                  min={10}
                  max={50}
                  step={1}
                  value={[videosPerKeyword]}
                  onValueChange={(value) => setVideosPerKeyword(value[0])}
                />
              </div>
            </div>

            <Accordion type="single" collapsible defaultValue="advanced">
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced filters</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Country
                      </label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {constants.countries.map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Language
                      </label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {constants.languages.map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Suggestion mode
                      </label>
                      <Select
                        value={suggestionMode}
                        onValueChange={setSuggestionMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {constants.suggestionModes.map((mode) => (
                            <SelectItem
                              key={mode.value}
                              value={mode.value}
                              disabled={mode.value === "trends" && !constants.trendsEnabled}
                            >
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {suggestionMode === "trends" && !constants.trendsEnabled && (
                        <p className="text-xs text-amber-600">
                          Google Trends suggestions are disabled on this environment.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Minimum volume
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={minVolume}
                        onChange={(event) =>
                          setMinVolume(
                            Number.isFinite(Number(event.target.value))
                              ? Math.max(0, Number(event.target.value))
                              : 0
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Include terms
                      </label>
                      <Input
                        value={includeTerms}
                        onChange={(event) => setIncludeTerms(event.target.value)}
                        placeholder="comma-separated"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">
                        Exclude terms
                      </label>
                      <Input
                        value={excludeTerms}
                        onChange={(event) => setExcludeTerms(event.target.value)}
                        placeholder="comma-separated"
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-700">
                            Hide low-signal autocomplete noise
                          </p>
                          <p className="text-xs text-zinc-500">
                            Filters single-letter variants around the seed.
                          </p>
                        </div>
                        <Switch checked={hideNoise} onCheckedChange={setHideNoise} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-700">
                            Cluster similar keywords
                          </p>
                          <p className="text-xs text-zinc-500">
                            Collapse variants into a single opportunity.
                          </p>
                        </div>
                        <Switch checked={cluster} onCheckedChange={setCluster} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-700">
                            Show weighted score
                          </p>
                          <p className="text-xs text-zinc-500">
                            Adjust opportunity by your channel profile.
                          </p>
                        </div>
                        <Switch
                          checked={showWeighted}
                          onCheckedChange={setShowWeighted}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700">
                          My channel (optional)
                        </label>
                        <Input
                          value={channel}
                          onChange={(event) => setChannel(event.target.value)}
                          placeholder="@yourhandle or channel URL"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
                <div key={`skeleton-row-${index}`} className="grid grid-cols-6 gap-4">
                  <Skeleton className="h-8" />
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
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Best answer age</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayResults.map((item) => (
                    <TableRow
                      key={item.keyword}
                      className="cursor-pointer transition hover:bg-muted/40"
                      onClick={() => handleOpenDrawer(item)}
                    >
                      <TableCell className="font-medium text-zinc-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.keyword}</span>
                          {item.clusterSize && item.clusterSize > 1 && (
                            <Badge variant="secondary">
                              {item.clusterSize} variants
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(item.volume)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={item.scores.opportunityScore}
                            className="h-2 w-24"
                          />
                          <span className="text-sm font-semibold">
                            {item.scores.opportunityScore}
                          </span>
                          {showWeighted && item.scores.weightedOpportunityScore !== null && (
                            <Badge variant="outline">
                              Weighted {item.scores.weightedOpportunityScore}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {scoreBadge(item.scores.searchVolumeScore, "Vol")}
                          {scoreBadge(item.scores.competitionScore, "Comp")}
                          {scoreBadge(item.scores.optimizationStrengthScore, "Opt")}
                          {scoreBadge(item.scores.freshnessScore, "Fresh")}
                          {item.scores.trendScore !== null &&
                            scoreBadge(item.scores.trendScore, "Trend")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.scores.difficulty}</span>
                          <Badge variant="secondary">{item.labels.difficulty}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {Math.round(item.bestAnswerAgeDays)}d
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "border-transparent",
                              freshnessBadgeClass(item.labels.freshness)
                            )}
                          >
                            {item.labels.freshness}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenDrawer(item);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSave(item);
                            }}
                            disabled={savedKeywords.has(item.keyword.toLowerCase())}
                          >
                            {savedKeywords.has(item.keyword.toLowerCase()) ? "Saved" : "Save"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-white/95">
          <div className="mx-auto w-full max-w-5xl">
            <DrawerHeader>
              <DrawerTitle className="text-2xl">
                {selected?.keyword || "Keyword details"}
              </DrawerTitle>
              <DrawerDescription>
                {selected
                  ? `Opportunity ${selected.scores.opportunityScore} · Volume ${formatNumber(
                      selected.volume
                    )}${
                      selected.scores.weightedOpportunityScore !== null && showWeighted
                        ? ` · Weighted ${selected.scores.weightedOpportunityScore}`
                        : ""
                    }`
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
              <div className="space-y-8 px-4 pb-12">
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
                      <CardDescription>Competition</CardDescription>
                      <CardTitle className="text-2xl">
                        {selected.scores.competitionScore}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Optimization</CardDescription>
                      <CardTitle className="text-2xl">
                        {selected.scores.optimizationStrengthScore}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardDescription>Freshness</CardDescription>
                      <CardTitle className="text-2xl">
                        {selected.scores.freshnessScore}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card className="border-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Score analysis</CardTitle>
                    <CardDescription>
                      How the opportunity score is built.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Search volume</span>
                        <span>{selected.scores.searchVolumeScore}/100</span>
                      </div>
                      <Progress value={selected.scores.searchVolumeScore} className="h-2" />
                      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
                        {selected.explanations.searchVolume.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Competition (ease)</span>
                        <span>{selected.scores.competitionScore}/100</span>
                      </div>
                      <Progress value={selected.scores.competitionScore} className="h-2" />
                      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
                        {selected.explanations.competition.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Optimization strength</span>
                        <span>{selected.scores.optimizationStrengthScore}/100</span>
                      </div>
                      <Progress value={selected.scores.optimizationStrengthScore} className="h-2" />
                      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
                        {selected.explanations.optimization.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Freshness</span>
                        <span>{selected.scores.freshnessScore}/100</span>
                      </div>
                      <Progress value={selected.scores.freshnessScore} className="h-2" />
                      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
                        {selected.explanations.freshness.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    {selected.scores.trendScore !== null && selected.explanations.trend && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>Trend momentum</span>
                          <span>{selected.scores.trendScore}/100</span>
                        </div>
                        {selected.monthlyVolumes && selected.monthlyVolumes.length >= 6 && (
                          <Sparkline values={selected.monthlyVolumes} />
                        )}
                        <Progress value={selected.scores.trendScore} className="h-2" />
                        <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
                          {selected.explanations.trend.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">SERP weakness summary</CardTitle>
                    <CardDescription>
                      Signals that suggest a content gap.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                      {selected.explanations.serpWeakness.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      Top competing videos
                    </h3>
                    <p className="text-sm text-zinc-600">
                      The current YouTube results for this keyword.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {selected.topVideos.slice(0, 10).map((video) => (
                      <Card key={video.id} className="border-black/5">
                        <CardContent className="flex flex-col gap-4 p-4 md:flex-row">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="h-28 w-full rounded-md object-cover md:w-48"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-base font-semibold text-zinc-900 hover:underline"
                              >
                                {video.title}
                              </a>
                              <Badge
                                className={cn(
                                  "border-transparent",
                                  fitBadgeClass(video.fitLabel)
                                )}
                              >
                                {video.fitLabel} fit
                              </Badge>
                            </div>
                            <p className="text-sm text-zinc-600">
                              {video.channelTitle} ·{" "}
                              {new Date(video.publishedAt).toLocaleDateString()}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                              <Badge variant="outline">
                                {formatNumber(video.viewCount)} views
                              </Badge>
                              <Badge variant="outline">
                                {Math.round(video.viewsPerDay)} views/day
                              </Badge>
                              <Badge variant="outline">
                                {formatNumber(video.channelSubscriberCount)} subs
                              </Badge>
                              {video.likeCount > 0 && (
                                <Badge variant="outline">
                                  {formatNumber(video.likeCount)} likes
                                </Badge>
                              )}
                              {video.commentCount > 0 && (
                                <Badge variant="outline">
                                  {formatNumber(video.commentCount)} comments
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              Fit {Math.round(video.fit * 100)}% · {video.durationSeconds}s
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {selectedSeo && (
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardTitle className="text-lg">Recommended angles</CardTitle>
                      <CardDescription>
                        Fresh ways to stand out based on what is missing in the SERP.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                        {selectedSeo.angles.map((angle) => (
                          <li key={angle}>{angle}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedSeo && (
                  <Card className="border-black/5">
                    <CardHeader>
                      <CardTitle className="text-lg">SEO Studio</CardTitle>
                      <CardDescription>
                        Actionable metadata recommendations you can copy instantly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-zinc-900">
                          Checklist
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                          <li>Put the exact keyword in the first 60 characters.</li>
                          <li>Use the exact keyword in the first 200 characters.</li>
                          <li>Include 3–5 close variants in the description.</li>
                          <li>Add relevant tags without stuffing.</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-zinc-900">
                          Title templates
                        </h4>
                        <div className="space-y-2">
                          {selectedSeo.titleTemplates.map((title, index) => (
                            <div
                              key={`${title}-${index}`}
                              className="flex flex-col gap-2 rounded-md border border-black/10 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
                            >
                              <span className="text-sm text-zinc-800">{title}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(`title-${index}`, title)}
                              >
                                {copiedKey === `title-${index}` ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-zinc-900">
                          Description starter
                        </h4>
                        <div className="rounded-md border border-black/10 bg-white p-3 text-sm text-zinc-700">
                          <pre className="whitespace-pre-wrap font-sans">
                            {selectedSeo.descriptionTemplate}
                          </pre>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopy("description", selectedSeo.descriptionTemplate)
                          }
                        >
                          {copiedKey === "description" ? (
                            <>
                              <Check className="mr-2 h-4 w-4" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" /> Copy description
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-zinc-900">
                            Suggested tags
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCopy(
                                "tags",
                                selectedSeo.suggestedTags.join(", ")
                              )
                            }
                          >
                            {copiedKey === "tags" ? (
                              <>
                                <Check className="mr-2 h-4 w-4" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-4 w-4" /> Copy all tags
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedSeo.suggestedTags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
