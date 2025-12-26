"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Pencil, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { TopicPlanItem } from "@/lib/types";

type PlannerTabProps = {
  items: TopicPlanItem[];
  setItems: (items: TopicPlanItem[]) => void;
  updateItem: (id: string, patch: Partial<TopicPlanItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
};

const STATUS_OPTIONS: TopicPlanItem["status"][] = [
  "Idea",
  "Script",
  "Record",
  "Edit",
  "Publish",
  "Done",
];

const opportunityBadgeClass = (score: number) => {
  if (score >= 70) return "bg-emerald-100 text-emerald-900";
  if (score >= 45) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-900";
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function toCsv(items: TopicPlanItem[]) {
  const headers = [
    "id",
    "keyword",
    "clusterLabel",
    "volume",
    "status",
    "notes",
    "recommendedTitle",
    "recommendedTags",
    "scores",
    "createdAt",
    "updatedAt",
  ];

  const escape = (value: string) => {
    if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
      return `"${value.replace(/\"/g, "\"\"")}"`;
    }
    return value;
  };

  const rows = items.map((item) => [
    item.id,
    item.keyword,
    item.clusterLabel ?? "",
    String(item.volume),
    item.status,
    item.notes ?? "",
    item.recommendedTitle ?? "",
    (item.recommendedTags ?? []).join("|"),
    JSON.stringify(item.scores),
    item.createdAt,
    item.updatedAt,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  return csv;
}

function parseCsv(text: string): TopicPlanItem[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");

  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === "\"") {
        const next = line[i + 1];
        if (inQuotes && next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  };

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    let scores: TopicPlanItem["scores"] = {
      searchVolumeScore: 0,
      competitionScore: 0,
      optimizationStrengthScore: 0,
      freshnessScore: 0,
      trendScore: null,
      difficulty: 0,
      opportunityScore: 0,
      weightedOpportunityScore: null,
    };
    if (record.scores) {
      try {
        scores = JSON.parse(record.scores) as TopicPlanItem["scores"];
      } catch {
        scores = {
          searchVolumeScore: 0,
          competitionScore: 0,
          optimizationStrengthScore: 0,
          freshnessScore: 0,
          trendScore: null,
          difficulty: 0,
          opportunityScore: 0,
          weightedOpportunityScore: null,
        };
      }
    }

    const id =
      record.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`);

    return {
      id,
      keyword: record.keyword,
      clusterLabel: record.clusterLabel || undefined,
      volume: Number(record.volume || 0),
      status: (record.status as TopicPlanItem["status"]) || "Idea",
      notes: record.notes || "",
      recommendedTitle: record.recommendedTitle || undefined,
      recommendedTags: record.recommendedTags
        ? record.recommendedTags.split("|").filter(Boolean)
        : [],
      scores,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
    } as TopicPlanItem;
  });
}

export function PlannerTab({
  items,
  setItems,
  updateItem,
  removeItem,
  clearItems,
}: PlannerTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<TopicPlanItem | null>(null);
  const [editDraft, setEditDraft] = useState<TopicPlanItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return item.keyword.toLowerCase().includes(query);
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const handleExport = () => {
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hotcontent-planner.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length > 0) {
      setItems(parsed);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Planner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-4 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ideas"
                className="md:max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:max-w-xs">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmClear(true)}
              >
                Clear planner
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Hot Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No hot ideas saved yet.
                  </TableCell>
                </TableRow>
              )}
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    {item.keyword}
                  </TableCell>
                  <TableCell>{Math.round(item.volume)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={opportunityBadgeClass(
                          item.scores.opportunityScore
                        )}
                      >
                        {item.scores.opportunityScore}
                      </Badge>
                      {item.scores.weightedOpportunityScore !== null && (
                        <Badge
                          variant="secondary"
                          className={opportunityBadgeClass(
                            item.scores.weightedOpportunityScore
                          )}
                        >
                          W {item.scores.weightedOpportunityScore}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingItem(item);
                          setEditDraft(item);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setEditDraft(null);
          }
        }}
      >
        {editDraft && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit planner item</DialogTitle>
              <DialogDescription>
                Update notes, status, and metadata for this idea.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Select
                  value={editDraft.status}
                  onValueChange={(value) =>
                    setEditDraft({ ...editDraft, status: value as TopicPlanItem["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Recommended title
                </label>
                <Input
                  value={editDraft.recommendedTitle ?? ""}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, recommendedTitle: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Recommended tags
                </label>
                <Input
                  value={(editDraft.recommendedTags ?? []).join(", ")}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      recommendedTags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={editDraft.notes}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, notes: event.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingItem(null);
                  setEditDraft(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editDraft) {
                    updateItem(editDraft.id, editDraft);
                  }
                  setEditingItem(null);
                  setEditDraft(null);
                }}
              >
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear planner</DialogTitle>
            <DialogDescription>
              This removes all saved opportunities from local storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearItems();
                setConfirmClear(false);
              }}
            >
              Clear planner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
