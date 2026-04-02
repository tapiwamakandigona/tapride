interface AlertErrorProps {
  message: string;
  className?: string;
}

export default function AlertError({ message, className = '' }: AlertErrorProps) {
  if (!message) return null;
  return (
    <div className={`bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 ${className}`}>
      <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>
    </div>
  );
}
