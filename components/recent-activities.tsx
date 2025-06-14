import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const activities = [
  {
    id: 1,
    user: {
      name: "Alex Johnson",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "AJ",
    },
    batteryId: "BAT-2023-089",
    action: "Completed maintenance",
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    user: {
      name: "Sarah Miller",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "SM",
    },
    batteryId: "BAT-2023-124",
    action: "Replaced cells",
    timestamp: "4 hours ago",
  },
  {
    id: 3,
    user: {
      name: "Robert Chen",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "RC",
    },
    batteryId: "BAT-2023-056",
    action: "Performed diagnostics",
    timestamp: "Yesterday",
  },
  {
    id: 4,
    user: {
      name: "Maria Garcia",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "MG",
    },
    batteryId: "BAT-2023-201",
    action: "Updated firmware",
    timestamp: "Yesterday",
  },
  {
    id: 5,
    user: {
      name: "John Doe",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "JD",
    },
    batteryId: "BAT-2023-145",
    action: "Flagged for replacement",
    timestamp: "2 days ago",
  },
]

export function RecentActivities() {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center gap-4">
          <Avatar className="h-8 w-8">
            <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
            <AvatarFallback>{activity.user.initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">
              {activity.user.name} <span className="text-muted-foreground">on</span> {activity.batteryId}
            </p>
            <p className="text-sm text-muted-foreground">
              {activity.action} • {activity.timestamp}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
