import { redirect } from "next/navigation";

interface QuestionRedirectPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function QuestionRedirectPage({
  searchParams,
}: QuestionRedirectPageProps) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "";
  redirect(view ? `/app?view=${encodeURIComponent(view)}` : "/app");
}
