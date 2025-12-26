import { NextResponse } from "next/server";

import { getEnvStatus } from "@/lib/env";

export const runtime = "nodejs";

const countries = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "BR", label: "Brazil" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
];

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
];

const suggestionModes = [
  { value: "suggestions", label: "Autocomplete suggestions" },
  { value: "questions", label: "Questions" },
  { value: "prepositions", label: "Prepositions" },
  { value: "trends", label: "Google Trends suggestions" },
];

export async function GET() {
  const status = getEnvStatus();

  return NextResponse.json({
    countries,
    languages,
    suggestionModes,
    trendsEnabled: status.trendsEnabled,
  });
}
