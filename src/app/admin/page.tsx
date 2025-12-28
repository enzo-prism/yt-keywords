import { Activity, Flame } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiUsageSummary } from "@/lib/api-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE_ENDPOINT_LABELS: Record<string, string> = {
  search: "search.list",
  videos: "videos.list",
  channels: "channels.list",
  playlistItems: "playlistItems.list",
  unknown: "other",
};

const KEYWORDTOOL_ENDPOINT_LABELS: Record<string, string> = {
  suggestions: "suggestions",
  trends: "trends",
  volume: "volume",
};

function formatNumber(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

function formatTime(value: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatEndpoint(providerId: string, endpoint: string) {
  if (providerId === "youtube") {
    return YOUTUBE_ENDPOINT_LABELS[endpoint] ?? endpoint;
  }
  return KEYWORDTOOL_ENDPOINT_LABELS[endpoint] ?? endpoint;
}

export default async function AdminPage() {
  const summary = await getApiUsageSummary();
  const resetAt = new Date(summary.windowEnd);
  const missingLimits = summary.providers.filter(
    (provider) => provider.limit === null
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-16 h-72 w-72 rounded-full bg-heat/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-heat-2/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,130,80,0.12),_transparent_55%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-heat text-heat-foreground shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Admin overview
              </p>
              <p className="text-xs text-muted-foreground">
                API usage and quota headroom for today
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-heat/30 bg-background/80 text-xs uppercase tracking-[0.2em] text-heat"
            >
              {summary.dayKey} UTC window
            </Badge>
            <Badge variant="secondary" className="gap-1 border-transparent">
              <Flame className="h-3.5 w-3.5" />
              Resets at {resetAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
              UTC
            </Badge>
          </div>
        </header>

        {missingLimits.length > 0 ? (
          <Alert>
            <AlertTitle>Quota limits not configured</AlertTitle>
            <AlertDescription>
              Set {missingLimits.map((provider) =>
                provider.id === "youtube"
                  ? "YOUTUBE_DAILY_QUOTA"
                  : "KEYWORDTOOL_DAILY_LIMIT"
              ).join(" and ")} to calculate remaining headroom.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          {summary.providers.map((provider) => {
            const limitConfigured = provider.limit !== null;
            return (
              <Card
                key={provider.id}
                className="border-border/60 bg-background/80 shadow-sm backdrop-blur"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {provider.label}
                      </CardTitle>
                      <CardDescription>
                        {provider.unitLabel} used today
                      </CardDescription>
                    </div>
                    <Badge
                      variant={limitConfigured ? "secondary" : "outline"}
                      className={
                        limitConfigured
                          ? "border-transparent bg-heat/15 text-heat"
                          : "border-muted text-muted-foreground"
                      }
                    >
                      {limitConfigured ? "Limit set" : "No limit set"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-3xl font-semibold text-foreground">
                        {formatNumber(provider.used)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {provider.unitLabel}
                      </span>
                      {limitConfigured ? (
                        <span className="text-sm text-muted-foreground">
                          of {formatNumber(provider.limit)} {provider.unitLabel}
                        </span>
                      ) : null}
                    </div>
                    <Progress value={provider.percent ?? 0} />
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Remaining:{" "}
                        {limitConfigured
                          ? `${formatNumber(provider.remaining)} ${
                              provider.unitLabel
                            }`
                          : "—"}
                      </span>
                      <span>Requests: {formatNumber(provider.requests)}</span>
                      <span>Updated: {formatTime(provider.lastUpdated)}</span>
                      <span>Usage: {formatPercent(provider.percent)}</span>
                    </div>
                  </div>
                  {provider.note ? (
                    <p className="text-xs text-muted-foreground">
                      {provider.note}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {summary.providers.map((provider) => (
            <Card
              key={`${provider.id}-breakdown`}
              className="border-border/60 bg-background/80 shadow-sm backdrop-blur"
            >
              <CardHeader>
                <CardTitle className="text-base">
                  {provider.label} breakdown
                </CardTitle>
                <CardDescription>
                  Requests by endpoint for the current window
                </CardDescription>
              </CardHeader>
              <CardContent>
                {provider.endpoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No API usage recorded yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        {provider.id === "youtube" ? (
                          <TableHead className="text-right">
                            Quota units
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.endpoints.map((endpoint) => (
                        <TableRow key={endpoint.name}>
                          <TableCell className="font-medium">
                            {formatEndpoint(provider.id, endpoint.name)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(endpoint.requests)}
                          </TableCell>
                          {provider.id === "youtube" ? (
                            <TableCell className="text-right">
                              {formatNumber(endpoint.units)}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
