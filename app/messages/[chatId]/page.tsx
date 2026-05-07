'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase-live';
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user, loading } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  // Hooks moved to top




  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId as string, 'messages'),
      orderBy('createdAt')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });

    return () => unsub();
  }, [chatId]);

  // ⏳ loading state
  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  // 🔒 SALES ONLY
  if (user?.role !== 'sales') {
    return <div className="p-6">Access Denied</div>;
  }

  const sendMessage = async () => {
    if (!text.trim()) return;

    await addDoc(
      collection(db, 'chats', chatId as string, 'messages'),
      {
        text,
        sender: 'sales',
        fullName: user?.email || 'Sales',
        createdAt: new Date(),
      }
    );

    setText('');
  };

  return (
    <div className="p-6 flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded max-w-[70%] ${
              m.sender === 'sales'
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-gray-200'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 border px-3 py-2 rounded"
          placeholder="Reply..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}