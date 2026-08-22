export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}
