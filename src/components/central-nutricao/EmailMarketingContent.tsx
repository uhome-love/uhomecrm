import { useState } from "react";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Re-export the email marketing page content without the outer wrapper
// We lazy-load the full page and render it inline
const EmailMarketingPage = lazy(() => import("@/pages/EmailMarketingPage"));

export default function EmailMarketingContent() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <EmailMarketingPage />
    </Suspense>
  );
}
