import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function DatabaseFixBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 relative" role="alert">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <strong className="font-bold">Database Setup Required: </strong>
            <span className="block sm:inline">
              Cart functionality is disabled. Please run the SQL fix in FIX_DATABASE.md
            </span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
