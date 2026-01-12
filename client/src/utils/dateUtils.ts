export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const expiry = new Date(endDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getTimeProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now <= start) return 0;
  if (now >= end) return 100;

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return (elapsed / totalDuration) * 100;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-400';
    case 'missed':
      return 'text-red-400';
    default:
      return 'text-amber-400';
  }
}
