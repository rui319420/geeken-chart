import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";
import SurveyWidget from "@/components/SurveyWidget";

export default async function SurveyPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <SurveyWidget />
        </main>
      </div>
    </div>
  );
}
