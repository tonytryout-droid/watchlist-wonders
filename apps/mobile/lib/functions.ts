import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function selectResolutionCandidate(
  bookmarkId: string,
  candidate: unknown,
): Promise<void> {
  const callable = httpsCallable<
    { bookmarkId: string; action: "selected"; candidate: unknown }, 
    unknown
  >(functions, "selectResolutionCandidate");
  await callable({ bookmarkId, action: "selected", candidate });
}

export async function skipResolutionSelection(bookmarkId: string): Promise<void> {
  const callable = httpsCallable<
    { bookmarkId: string; action: "skipped" }, 
    unknown
  >(functions, "selectResolutionCandidate");
  await callable({ bookmarkId, action: "skipped" });
}
