import { appIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

export function GET() {
  return appIcon(512);
}
