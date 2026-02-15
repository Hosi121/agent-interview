import { redirect } from "next/navigation";

export default function InterestsPage() {
  redirect("/recruiter/agents?view=interests");
}
