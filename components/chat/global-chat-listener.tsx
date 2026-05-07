"use client";

import { useEffect, useRef } from "react";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-live";
import { useChatStore } from "@/store/chat-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// Simple debounce for sound to prevent spamming
let lastPlayed = 0;

const playNotificationSound = () => {
  const now = Date.now();
  if (now - lastPlayed < 2000) return; // 2 second debounce

  lastPlayed = now;

  try {
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.log("Autoplay blocked or playback error:", err);
    });
  } catch (err) {
    console.log("Sound error:", err);
  }
};

export function GlobalChatListener() {
  const { user } = useAuth();
  const { setChats, activeChatId } = useChatStore();
  const prevUnreadCount = useRef<number>(0);
  const isInitialLoad = useRef<boolean>(true);
  const prevChatsRef = useRef<any[]>([]);

  // Browser Autoplay Fix: Unlock audio on first interaction
  useEffect(() => {
    const unlock = () => {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0; // Silent play to unlock
      audio.play().catch(() => {});
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  useEffect(() => {
    // We only need to listen if the user is authorized to see chats
    if (!user || user.role !== "sales") return;

    const db = getFirebaseDb();
    if (!db) return;

    // Listen to all chats
    const unsub = onSnapshot(collection(db, "chats"), async (snap) => {
      const results = await Promise.all(
        snap.docs.map(async (chatDoc) => {
          const chatData = chatDoc.data();
          const userId = chatData.uid || chatData.userId;

          let userData: any = null;

          // GET USER DATA
          if (userId) {
            const userSnap = await getDoc(doc(db, "users", userId));
            if (userSnap.exists()) {
              userData = userSnap.data();
            }
          }

          return {
            id: chatDoc.id,
            uid: userId,
            archived: chatData.archived || false,
            hiddenForSales: chatData.hiddenForSales || false,
            fullName: userData?.fullName || "Unknown",
            companyName: userData?.companyName || "",
            email: userData?.email || "",
            phoneNumber: userData?.phoneNumber || "",
            lastMessage: chatData.lastMessage || "No messages yet",
            lastTime: chatData.lastTime || null,
            lastSender: chatData.lastSender || "",
            unreadCount_sales: chatData.unreadCount_sales || 0,
          };
        })
      );

      // SORT LATEST
      results.sort((a, b) => {
        const aTime = a.lastTime?.seconds || 0;
        const bTime = b.lastTime?.seconds || 0;
        return bTime - aTime;
      });

      const currentUnread = results.reduce(
        (sum, chat) => sum + (chat.unreadCount_sales || 0),
        0
      );

      // Prevent sound on initial load
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        prevUnreadCount.current = currentUnread;
        prevChatsRef.current = results;
        setChats(results);
        return;
      }

      if (currentUnread > prevUnreadCount.current) {
        // Find which chat had the new message
        const newUnreadChat = results.find(
          (r) => r.unreadCount_sales > (prevChatsRef.current.find(c => c.id === r.id)?.unreadCount_sales || 0)
        );

        if (newUnreadChat && newUnreadChat.id !== activeChatId) {
          // Play sound using the helper function
          playNotificationSound();

          // Show Toast notification
          toast.success(`New message from ${newUnreadChat.fullName}`, {
            description: newUnreadChat.lastMessage.length > 30 
              ? newUnreadChat.lastMessage.substring(0, 30) + '...' 
              : newUnreadChat.lastMessage,
            duration: 5000,
          });
        }
      }
      
      prevUnreadCount.current = currentUnread;
      prevChatsRef.current = results;
      setChats(results);
    });

    return () => unsub();
  }, [user, activeChatId, setChats]);

  return null; // This is a logic-only component
}

