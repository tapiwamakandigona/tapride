export default function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-3 py-2">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500">{name} is typing</span>
    </div>
  );
}
