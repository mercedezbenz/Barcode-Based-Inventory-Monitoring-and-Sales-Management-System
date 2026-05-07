import { create } from 'zustand';
import { getFirebaseDb } from '@/lib/firebase-live';
import { collection, onSnapshot, query, orderBy, getDoc, doc, updateDoc, increment } from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  createdAt: any;
}

export interface ChatData {
  id: string;
  uid: string;
  archived: boolean;
  hiddenForSales: boolean;
  fullName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  lastMessage: string;
  lastTime: any;
  lastSender: string;
  unreadCount_sales: number;
}

interface ChatStore {
  chats: ChatData[];
  setChats: (chats: ChatData[]) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  markAsRead: (chatId: string) => Promise<void>;
  totalUnreadSales: number;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  setChats: (chats) => {
    // Calculate total unread
    const totalUnreadSales = chats.reduce((sum, chat) => sum + (chat.unreadCount_sales || 0), 0);
    set({ chats, totalUnreadSales });
  },
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),
  markAsRead: async (chatId) => {
    const db = getFirebaseDb();
    if (!db) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        unreadCount_sales: 0
      });
    } catch (e) {
      console.error("Error marking chat as read", e);
    }
  },
  totalUnreadSales: 0,
}));
