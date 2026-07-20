import { httpsCallable } from "firebase/functions";
import { fbFunctions } from "@/lib/firebase";
import type { CaptureShareRequest, CaptureShareResult } from "@watchmarks/shared/capture";

export async function captureShare(input: CaptureShareRequest): Promise<CaptureShareResult> {
  const callable = httpsCallable<CaptureShareRequest, CaptureShareResult>(fbFunctions, "captureShare");
  const result = await callable(input);
  return result.data;
}
