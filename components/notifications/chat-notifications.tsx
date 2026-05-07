"use client"

import { MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { useChatStore } from "@/store/chat-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"

export function ChatNotifications({ userRole }: { userRole?: string | null }) {
  const router = useRouter()
  const { chats, totalUnreadSales, setActiveChatId } = useChatStore()

  // Only sales role should see customer chat notifications
  if (userRole !== "sales") {
    return null
  }

  // Get unread chats, sorted by latest
  // Only sales sees "unreadCount_sales"
  const unreadChats = userRole === "sales" 
    ? chats
        .filter((chat) => chat.unreadCount_sales > 0)
        .sort((a, b) => {
          const aTime = a.lastTime?.seconds || 0
          const bTime = b.lastTime?.seconds || 0
          return bTime - aTime
        })
        .slice(0, 5)
    : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
        >
          <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          {userRole === "sales" && totalUnreadSales > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900">
              {totalUnreadSales > 99 ? "99+" : totalUnreadSales}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[320px] p-0 rounded-xl shadow-lg border border-gray-100 dark:border-border bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-top-2"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-sm">Messages</h3>
          </div>
          {userRole === "sales" && totalUnreadSales > 0 && (
            <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {totalUnreadSales} New
            </span>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {unreadChats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No new messages
            </div>
          ) : (
            unreadChats.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  router.push('/messages')
                }}
                className="flex flex-col items-start px-4 py-3 cursor-pointer hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-gray-800 dark:focus:bg-gray-800 rounded-none border-b border-gray-50 dark:border-gray-800/50 last:border-0"
              >
                <div className="flex justify-between w-full mb-1">
                  <span className="font-semibold text-sm truncate pr-2">
                    {chat.fullName}
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {chat.lastTime?.seconds
                      ? formatDistanceToNow(chat.lastTime.seconds * 1000, { addSuffix: true })
                      : "Just now"}
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">
                  {chat.lastMessage}
                </span>
                <span className="inline-flex mt-1 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {chat.unreadCount_sales} unread
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        <DropdownMenuSeparator className="m-0" />
        
        <div className="p-2">
          <button
            onClick={() => router.push('/messages')}
            className="w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Open Messages
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
