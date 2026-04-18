import { useXP } from "@/contexts/XPContext"

export function XPNotification() {
  const { notifications } = useXP()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-300"
        >
          {n.emoji && <span>{n.emoji}</span>}
          {n.text}
        </div>
      ))}
    </div>
  )
}
