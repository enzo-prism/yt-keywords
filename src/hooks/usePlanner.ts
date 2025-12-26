import { useEffect, useMemo, useState } from "react";

import type { OpportunityResult, TopicPlanItem } from "@/lib/types";

const STORAGE_KEY = "gapscope.topicPlanner";

function loadPlannerItems(): TopicPlanItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TopicPlanItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlannerItems(items: TopicPlanItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function usePlanner() {
  const [items, setItems] = useState<TopicPlanItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(loadPlannerItems());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    savePlannerItems(items);
  }, [items, loaded]);

  const savedKeywordSet = useMemo(() => {
    return new Set(items.map((item) => item.keyword.toLowerCase()));
  }, [items]);

  const addFromOpportunity = (opportunity: OpportunityResult) => {
    if (savedKeywordSet.has(opportunity.keyword.toLowerCase())) return;
    const now = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const newItem: TopicPlanItem = {
      id,
      keyword: opportunity.keyword,
      clusterLabel: opportunity.clusterLabel,
      volume: opportunity.volume,
      scores: opportunity.scores,
      recommendedTitle: undefined,
      recommendedTags: opportunity.relatedKeywords.slice(0, 12),
      notes: "",
      status: "Idea",
      createdAt: now,
      updatedAt: now,
    };
    setItems((current) => [newItem, ...current]);
  };

  const updateItem = (id: string, patch: Partial<TopicPlanItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const clearItems = () => {
    setItems([]);
  };

  return {
    items,
    setItems,
    savedKeywordSet,
    addFromOpportunity,
    updateItem,
    removeItem,
    clearItems,
    loaded,
  };
}
