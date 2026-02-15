import { redirect } from "next/navigation";

export default function WatchesPage() {
  redirect("/recruiter/agents?view=watches");
}
