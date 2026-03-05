import { signIn } from "@/auth";
import LanguageTrendChart from "./components/LanguageTrendChart";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="mb-8 text-2xl font-bold">技研チャート 仮ログイン画面</h1>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded bg-gray-800 px-6 py-3 font-semibold text-white hover:bg-gray-700"
        >
          GitHubでログイン
        </button>
      </form>
      <div>
        <LanguageTrendChart></LanguageTrendChart>
      </div>
    </div>
  );
}
