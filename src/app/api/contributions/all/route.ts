import { NextResponse } from "next/server";
import { getAggregatedContributions } from "@/services/contributionService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : null;

    const aggregatedData = await getAggregatedContributions(year);

    return NextResponse.json(aggregatedData);
  } catch (error) {
    console.error("Failed to fetch all contributions:", error);
    // エラーメッセージが "GitHub token not configured" の場合は500エラーとして扱う
    if (error instanceof Error && error.message === "GitHub token not configured") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
