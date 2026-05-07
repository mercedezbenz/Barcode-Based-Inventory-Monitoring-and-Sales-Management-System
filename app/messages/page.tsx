'use client';

import {
  MoreVertical,
  X,
  Send,
  Info,
  Search,
  ImagePlus
} from "lucide-react";
import { Archive, RotateCcw, Trash2 } from "lucide-react"
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  setDoc,
  limit,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
} from "firebase/firestore";
import axios from 'axios';
import { useRouter } from 'next/navigation';

import { useChatStore } from '@/store/chat-store';

import { MainLayout } from '@/components/layout/main-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useEffect, useState, useRef } from 'react';
import { getFirebaseDb } from '@/lib/firebase-live';
import { useAuth } from '@/hooks/use-auth';
export default function MessagesPage() {
  const { user, loading } = useAuth();
  

  const { chats, activeChatId, setActiveChatId, markAsRead } = useChatStore();
  const selectedChat = chats.find(c => c.id === activeChatId) || null;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showInfo, setShowInfo] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

const [previewImages, setPreviewImages] =
  useState<string[]>([]);

const [previewIndex, setPreviewIndex] =
  useState(0);

const [showViewer, setShowViewer] =
  useState(false);

const [selectedImages, setSelectedImages] =
  useState<File[]>([]);

const [imagePreviews, setImagePreviews] =
  useState<string[]>([]);

const [uploading, setUploading] =
  useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // 🔍 SEARCH FILTER
  const filteredChats = chats
  .filter(chat => !chat.hiddenForSales) // 🔴 hide deleted chats
  .filter(chat => showArchived ? chat.archived : !chat.archived)
  .filter((chat) => {
    const name = chat.fullName?.toLowerCase() || '';
    const company = chat.companyName?.toLowerCase() || '';
    const keyword = search.toLowerCase();
    return name.includes(keyword) || company.includes(keyword);
  });



  // 💬 LOAD MESSAGES
  useEffect(() => {
    if (!selectedChat) return;

    const db = getFirebaseDb();
    if (!db) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
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
  }, [selectedChat]);
  useEffect(() => {

  if (!showViewer) return;

  const handleKeyDown = (e: KeyboardEvent) => {

    if (e.key === 'ArrowRight') {
      setPreviewIndex((prev) =>
        prev < previewImages.length - 1
          ? prev + 1
          : prev
      );
    }

    if (e.key === 'ArrowLeft') {
      setPreviewIndex((prev) =>
        prev > 0
          ? prev - 1
          : prev
      );
    }

    if (e.key === 'Escape') {
      setShowViewer(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener(
      'keydown',
      handleKeyDown
    );
  };

}, [showViewer, previewImages.length]);
  const handleImageUpload = async () => {
  if (!selectedChat || selectedImages.length === 0) return;

  try {
    setUploading(true);

    const db = getFirebaseDb();
    if (!db) return;

    for (const file of selectedImages) {

      const data = new FormData();

      data.append('file', file);

      data.append(
        'upload_preset',
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
      );

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        data
      );

      const imageUrl = res.data.secure_url;

      await addDoc(
        collection(db, 'chats', selectedChat.id, 'messages'),
        {
          sender: 'sales',
          image: imageUrl,
          createdAt: new Date(),
        }
      );
    }

    await updateDoc(doc(db, 'chats', selectedChat.id), {
      lastMessage: '__IMAGE__',
      lastTime: new Date(),
      lastSender: 'sales',
    });

    setSelectedImages([]);
    setImagePreviews([]);

  } catch (err) {
    console.error(err);
  } finally {
    setUploading(false);
  }
};
  

  // ✉️ SEND MESSAGE
  const sendMessage = async () => {
  if (!text.trim() || !selectedChat) return;

  const db = getFirebaseDb();
  if (!db) return;

  // ✏️ EDIT MODE
  if (editingId) {
    await updateDoc(
      doc(db, 'chats', selectedChat.id, 'messages', editingId),
      { text }
    );
    setEditingId(null);
    setText('');
    return;
  }

  // 📨 SEND
  await addDoc(
    collection(db, 'chats', selectedChat.id, 'messages'),
    {
      text,
      sender: 'sales',
      createdAt: new Date(),
    }
  );

  // Update chat metadata
  await updateDoc(doc(db, 'chats', selectedChat.id), {
    lastMessage: text,
    lastTime: new Date(),
    lastSender: 'sales',
    unreadCount_customer: increment(1)
  });

  setText('');
};

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <ProtectedRoute allowedRoles={["sales"]}>
    <MainLayout>
  <div className="flex h-[calc(100vh-120px)] overflow-hidden">
    {/* LEFT PANEL */}
    <div className="w-[320px] border-r border-gray-200 dark:border-gray-700 
                bg-white dark:bg-[#101213] overflow-y-auto">
      {/* SEARCH */}
      <div className="p-4 border-b">

  <div className="flex justify-between items-center mb-2">
    <div className="font-bold text-lg">
      {showArchived ? 'Archived chats' : 'Chats'}
    </div>

    {!showArchived && (
      <button
        onClick={() => setShowArchived(true)}
        className="text-sm text-gray-500 hover:text-black"
      >
        Archived
      </button>
    )}
  </div>

  {/* 🔙 BACK BUTTON */}
  {showArchived && (
    <button
      onClick={() => setShowArchived(false)}
      className="text-sm text-blue-500 mb-2"
    >
      ← Back to chats
    </button>
  )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-full 
                       bg-gray-100 dark:bg-gray-800
                       text-sm text-black dark:text-white"
          />
        </div>
      </div>

      {/* CHAT LIST */}
{filteredChats.map((chat) => (
  <div
    key={chat.id}
    className={`group mx-2 my-1 rounded-lg flex items-center gap-3 p-3 cursor-pointer 
      hover:bg-gray-100 dark:hover:bg-gray-800
      ${
        selectedChat?.id === chat.id
          ? 'bg-gray-200 dark:bg-gray-700'
          : ''
      }`}
  >
    {/* CLICK AREA */}
    <div
      onClick={() => {
        setActiveChatId(chat.id);
        markAsRead(chat.id);
      }}
      className="flex flex-1 gap-3 items-center"
    >
      <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white shrink-0">
        {chat.fullName?.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${chat.unreadCount_sales > 0 && chat.id !== activeChatId ? 'text-blue-600 dark:text-blue-400' : ''}`}>
          {chat.fullName}
        </div>
        <div className={`text-xs truncate ${chat.unreadCount_sales > 0 && chat.id !== activeChatId ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
          {chat.lastMessage === '__ORDER__'
  ? ' New Order'
  : chat.lastMessage === '__IMAGE__'
    ? ' Photo'
    : chat.lastMessage}
        </div>
      </div>
      
      {/* UNREAD BADGE */}
      {chat.unreadCount_sales > 0 && chat.id !== activeChatId && (
        <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full h-5 min-w-[20px] flex items-center justify-center shrink-0">
          {chat.unreadCount_sales}
        </div>
      )}
    </div>

    {/* ⋮ BUTTON (HOVER ONLY) */}
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpenId(menuOpenId === chat.id ? null : chat.id)
        }}
        className="opacity-0 group-hover:opacity-100 transition 
                   text-gray-400"
      >
        <MoreVertical size={18} />
      </button>

      {menuOpenId === chat.id && (
  <div className="absolute right-0 mt-2 w-44 
                  bg-white dark:bg-[#101213] 
                  border border-gray-200 dark:border-gray-700 
                  rounded shadow z-50">

    {/* 🔁 ARCHIVE / RESTORE */}
    <button
      onClick={async () => {
        const db = getFirebaseDb()
        if (!db) return

        await updateDoc(doc(db, 'chats', chat.id), {
          archived: !chat.archived
        })

        setMenuOpenId(null)
      }}
      className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm 
                 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {chat.archived ? (
        <>
          <RotateCcw className="w-4 h-4" />
          Restore chat
        </>
      ) : (
        <>
          <Archive className="w-4 h-4" />
          Archive chat
        </>
      )}
    </button>

    {/* ❌ DELETE */}
    <button
      onClick={async () => {
  const db = getFirebaseDb()
  if (!db) return

  if (confirm("Delete this chat?")) {

    // 🔴 DELETE ALL MESSAGES
    const msgsSnap = await getDocs(
      collection(db, 'chats', chat.id, 'messages')
    )

    for (const m of msgsSnap.docs) {
      await deleteDoc(m.ref)
    }

    // 🔴 HIDE FROM SALES
    await updateDoc(doc(db, 'chats', chat.id), {
      hiddenForSales: true,
      lastMessage: '',
      updatedAt: new Date()
    })

    // 🔴 RESET UI
    if (selectedChat?.id === chat.id) {
      setActiveChatId(null)
      setMessages([])
    }
  }

  setMenuOpenId(null)
}}
      
      className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm 
                 hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
    >
      <Trash2 className="w-4 h-4" />
      Delete chat
    </button>

  </div>
)}
    </div>
  </div>
))}
    </div>

    {/* RIGHT PANEL */}
    <div className={`flex flex-col min-h-0
  flex-1 relative h-full`}>

      {!selectedChat ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          Select a chat
        </div>
      ) : (
        <>
          {/* HEADER */}
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-3">
  {/* PROFILE CIRCLE */}
  <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm font-bold">
    {selectedChat.fullName?.charAt(0)}
  </div>

  {/* FULL NAME ONLY */}
  <div className="font-semibold">
    {selectedChat.fullName}
  </div>
</div>

           <button
  onClick={() => setShowInfo(!showInfo)}
  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
>
  {showInfo ? (
    // ✅ FILLED ICON
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-9 h-9 text-[#2787b4]"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a1.25 1.25 0 110 2.5A1.25 1.25 0 0112 7zm1.25 10h-2.5v-6h2.5v6z" />
    </svg>
  ) : (
    // 🟢 OUTLINE ICON
    <Info className="w-9 h-9 text-gray-500" />
  )}
</button>
          </div>

          {/* ✅ SCROLLABLE MESSAGES ONLY */}
          <div
  className={`flex-1 overflow-y-auto min-h-0 p-4 space-y-3 ${
    editingId ? 'pointer-events-none opacity-60' : ''
  }`}
>
            {messages.map((m, i) => {
  const currentTime = m.createdAt?.seconds
    ? m.createdAt.seconds * 1000
    : 0;
  const isEditable =
    Date.now() - currentTime <= 15 * 60 * 1000;

  const prevTime =
    i > 0 && messages[i - 1].createdAt?.seconds
      ? messages[i - 1].createdAt.seconds * 1000
      : null;

  const showTimestamp =
    !prevTime || currentTime - prevTime > 5 * 60 * 1000; // 5 mins

  return (
    <div key={m.id}>
      
      {/* ⏰ TIMESTAMP (only if needed) */}
      {showTimestamp && (
        <div className="text-center text-xs text-gray-400 my-2">
  {new Date(currentTime).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}
</div>
      )}

      {/* 💬 MESSAGE */}
      <div
  className={`group flex ${
    m.sender === 'sales' ? 'justify-end' : 'justify-start'
  }`}
>
  {/* 👉 3 DOT BUTTON (ONLY SALES) */}
  {m.sender === 'sales' && (
    <div className="relative flex items-center mr-1">
      <button
        onClick={() =>
          setMenuOpenId(menuOpenId === m.id ? null : m.id)
        }
        className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-gray-700"
      >
        <MoreVertical size={18} />
      </button>

      {/* 🔽 DROPDOWN */}
      {menuOpenId === m.id && (
        <div className="absolute right-0 top-6 bg-white dark:bg-gray-800 border rounded shadow text-sm z-10">
          
          {isEditable && (
  <button
    onClick={() => {
      setEditingId(m.id);
      setText(m.text);
      setMenuOpenId(null);
    }}
    className="block px-4 py-2 hover:bg-gray-100 w-full text-left"
  >
    Edit
  </button>
)}

          <button
            onClick={async () => {
              const db = getFirebaseDb();
              if (!db) return;

              await deleteDoc(
                doc(db, 'chats', selectedChat.id, 'messages', m.id)
              );

              setMenuOpenId(null);
            }}
            className="block px-4 py-2 hover:bg-red-100 text-red-600 w-full text-left"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )}

  {/* 💬 MESSAGE BUBBLE */}
  <div
  onClick={() => {
    if (m.orderId) {
      router.push(`/orders/details/?id=${m.orderId}`);
    }
  }}
  className={`max-w-[70%] ${
  m.orderId
    ? 'cursor-pointer hover:scale-[1.01] transition'
    : ''
} text-sm ${
  m.image || m.orderItems
    ? ''
    : 'px-3 py-2 rounded-2xl'
} ${
  m.image || m.orderItems
    ? ''
    : m.sender === 'sales'
      ? 'bg-[#2787b4] text-white'
      : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
}`}
>
    {m.orderItems ? (

  <div className="space-y-3 bg-[#2787b4] text-white rounded-3xl p-4 shadow-lg">

    <div className="flex items-center justify-between">
      <p className="font-semibold text-sm">
         New Order
      </p>

      <span className="text-[11px] opacity-70">
        Tap to view
      </span>
    </div>

    <div className="space-y-2">
      {m.orderItems.map((item: any, idx: number) => (

        <div
          key={idx}
          className="flex items-center gap-3 bg-[#4c9dc4] rounded-2xl p-3 border border-white/40"
        >

          <img
            src={item.image}
            alt={item.name}
            className="w-16 h-16 rounded-xl object-cover bg-white"
          />

          <div className="flex-1 min-w-0">

            <p className="text-sm font-medium truncate">
              {item.name}
            </p>

            <p className="text-xs opacity-80">
              Qty: {item.quantity} kg
            </p>

            <p className="text-xs opacity-80">
              ₱{item.price} / kg
            </p>

          </div>

          <div className="text-sm font-semibold whitespace-nowrap">
            ₱{item.price * item.quantity}
          </div>

        </div>

      ))}
    </div>

    <div className="border-t border-white/20 pt-2 flex items-center justify-between">

      <span className="text-sm opacity-80">
        Total
      </span>

      <span className="font-bold text-base">
        ₱{m.orderTotal}
      </span>

    </div>

  </div>

) : m.image ? (

  <img
    src={m.image}
    alt="attachment"
    onClick={() => {

  const allImages = messages
    .filter((msg) => msg.image)
    .map((msg) => msg.image);

  const clickedIndex =
    allImages.indexOf(m.image);

  setPreviewImages(allImages);

  setPreviewIndex(clickedIndex);

  setShowViewer(true);
}}
    className="max-w-[220px] rounded-2xl object-cover shadow cursor-pointer hover:opacity-95"
  />

) : (
  m.text
)}
  </div>
</div>

    </div>
  );
})}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 
                bg-white dark:bg-[#101213]">

  {/* 🔥 IMAGE PREVIEW */}
  {imagePreviews.length > 0 && (
    <div className="flex gap-2 overflow-x-auto overflow-y-visible px-3 pt-3 pb-2">

      {imagePreviews.map((src, index) => (

        <div
          key={index}
          className="relative overflow-visible shrink-0"
        >

          <img
            src={src}
            className="w-16 h-16 rounded-lg object-cover"
          />

          <button
            onClick={() => {

              setSelectedImages((prev) =>
                prev.filter((_, i) => i !== index)
              );

              setImagePreviews((prev) =>
                prev.filter((_, i) => i !== index)
              );
            }}
            className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-black text-white rounded-full w-5 h-5 text-xs flex items-center justify-center z-10"
          >
            ✕
          </button>

        </div>

      ))}

    </div>
  )}

  {/* INPUT AREA */}
  <div className="p-3 flex items-center gap-2">
  
  {/* ❌ CANCEL BUTTON (ONLY WHEN EDITING) */}
  {editingId && (
    <button
      onClick={() => {
        setEditingId(null);
        setText('');
      }}
      className="text-gray-400 hover:text-red-500 transition"
    >
      <X className="w-6 h-6" />
    </button>
  )}

  {/* INPUT */}
  <label
  className={`cursor-pointer p-2 ${
    uploading
      ? 'opacity-50 pointer-events-none'
      : 'text-gray-400 hover:text-[#2787b4]'
  }`}
>

  <ImagePlus size={22} />

  <input
  type="file"
  accept="image/*"
  multiple
  className="hidden"
  onChange={(e) => {

    const files = Array.from(
      e.target.files || []
    );

    if (!files.length) return;

    setSelectedImages((prev) => [
      ...prev,
      ...files
    ]);

    const previews = files.map((file) =>
      URL.createObjectURL(file)
    );

    setImagePreviews((prev) => [
      ...prev,
      ...previews
    ]);
  }}
/>
</label>
  <input
  value={text}
  onChange={(e) => setText(e.target.value)}
  onKeyDown={async (e) => {

  if (e.key === 'Enter') {

    e.preventDefault();

    if (selectedImages.length > 0) {
      await handleImageUpload();
    }

    if (text.trim()) {
      await sendMessage();
    }
  }
}}
  className="flex-1 border border-gray-300 dark:border-gray-700 
             px-3 py-2 rounded 
             bg-white dark:bg-[#101213] 
             text-black dark:text-white 
             placeholder-gray-400"
  placeholder="Message..."
/>

  {/* SEND ICON */}
  <button
  disabled={
    !text.trim() &&
    selectedImages.length === 0
  }
  onClick={async () => {

  if (selectedImages.length > 0) {
    await handleImageUpload();
  }

  if (text.trim()) {
    await sendMessage();
  }
}}
  className={`transition flex items-center justify-center ${
  text.trim() || selectedImages.length > 0
    ? 'text-[#2787b4] hover:opacity-80'
    : 'text-gray-300 cursor-not-allowed'
}`}
>
  {editingId ? (
    // ✅ CHECK ICON
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z" />
    </svg>
  ) : (
    // 📤 SEND ICON
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-10 h-10 rotate-45"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M3 12l18-9-9 18-2-7-7-2z" />
    </svg>
  )}
</button>
</div>
</div>
        </>
      )}
    </div>

{/* SIDE PANEL */}
{showInfo && selectedChat && (
  <div className="w-[320px] border-l border-gray-200 dark:border-gray-700
                bg-white dark:bg-[#101213] 
                p-4 overflow-y-auto relative">
    {/* HEADER + SEARCH ICON */}
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-semibold text-lg">Details</h2>

    </div>

    {/* PROFILE */}
    <div className="flex flex-col items-center text-center mb-6">
      <div className="w-20 h-20 rounded-full bg-gray-400 flex items-center justify-center text-white text-2xl font-bold mb-3">
        {selectedChat.fullName?.charAt(0)}
      </div>

      <div className="text-lg font-semibold">
  {selectedChat.fullName}
</div>

{/* 🔍 SEARCH ICON SA ILALIM NG NAME */}
<button
  onClick={() => setShowSearch(true)}
  className="mt-2 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
>
  <Search className="w-5 h-5 text-gray-500" />
</button>
    </div>

    {/* DETAILS LIST */}
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-400">Full Name</div>
        <div className="font-medium">{selectedChat.fullName}</div>
      </div>

      <div>
        <div className="text-xs text-gray-400">Company</div>
        <div className="font-medium">{selectedChat.companyName}</div>
      </div>

      <div>
        <div className="text-xs text-gray-400">Email</div>
        <div className="font-medium break-all">{selectedChat.email}</div>
      </div>

      <div>
        <div className="text-xs text-gray-400">Phone</div>
        <div className="font-medium">{selectedChat.phoneNumber}</div>
      </div>
    </div>

    {/* 🔍 SEARCH OVERLAY */}
    {showSearch && (
      <div className="absolute inset-0 z-50 bg-white dark:bg-[#101213] flex flex-col">

        {/* HEADER */}
        <div className="flex items-center gap-3 p-4 border-b">
          <button onClick={() => setShowSearch(false)}>
            <X className="w-5 h-5" />
          </button>
          <span className="font-semibold">Search</span>
        </div>

        {/* INPUT */}
        <div className="p-3">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search messages..."
              className="bg-transparent outline-none flex-1 text-sm"
            />
            {searchText && (
              <button onClick={() => setSearchText('')}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* RESULTS */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {searchText.trim() !== "" && messages
  .filter((m) =>
    m.text?.toLowerCase().includes(searchText.toLowerCase())
  )
  .map((m) => (
              <div
                key={m.id}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
              >
                {m.orderItems ? (

  <div className="space-y-3">

    {/* HEADER */}
    <div className="flex items-center justify-between">
      <p className="font-bold text-base">
        New Order Placed
      </p>

      <span className="text-[11px] bg-white/20 px-2 py-1 rounded-full">
        Tap to view
      </span>
    </div>

    {/* ITEMS */}
    <div className="space-y-3">

      {m.orderItems.map((item: any, idx: number) => (

        <div
          key={idx}
          className="border border-white/60 rounded-2xl p-3 flex gap-3"
        >

          {/* IMAGE */}
          <img
            src={item.image}
            alt={item.name}
            className="w-20 h-20 rounded-lg object-cover bg-white"
          />

          {/* INFO */}
          <div className="flex-1">

            <p className="font-bold leading-tight">
              {item.name}
            </p>

            <p className="text-sm opacity-90">
              Qty: {item.quantity} kg
            </p>

            <p className="text-sm opacity-90">
              ₱ {item.price}
            </p>

            <p className="font-bold text-sm mt-1">
              Subtotal: ₱ {item.price * item.quantity}
            </p>

          </div>

        </div>

      ))}

    </div>

    {/* TOTAL */}
    <div className="border-t border-white/50 pt-3">

      <p className="font-bold text-xl">
        Total: ₱ {m.orderTotal}
      </p>

    </div>

  </div>

) : m.image ? (

  <img
    src={m.image}
    alt="attachment"
    onClick={() => {

  const allImages = messages
    .filter((msg) => msg.image)
    .map((msg) => msg.image);

  const clickedIndex =
    allImages.indexOf(m.image);

  setPreviewImages(allImages);

  setPreviewIndex(clickedIndex);

  setShowViewer(true);
}}
    className="max-w-[220px] rounded-2xl object-cover shadow cursor-pointer hover:opacity-95"
  />

) : (
  m.text
)}
              </div>
            ))}
        </div>
      </div>
    )}
  </div>
)}

  </div>
{showViewer && (
  <div className="fixed inset-0 z-[999] bg-black/90 flex flex-col">

    {/* TOP */}
    <div className="flex justify-end p-4">

      <button
        className="text-white text-3xl"
        onClick={() => setShowViewer(false)}
      >
        ✕
      </button>

    </div>

    {/* IMAGE */}
    <div className="flex-1 flex items-center justify-center relative px-6">

      {previewIndex > 0 && (
        <button
          onClick={() =>
            setPreviewIndex((prev) => prev - 1)
          }
          className="absolute left-4 text-white text-5xl"
        >
          ‹
        </button>
      )}

      <img
        src={previewImages[previewIndex]}
        alt="preview"
        className="max-h-[75vh] max-w-full object-contain rounded-xl"
      />

      {previewIndex < previewImages.length - 1 && (
        <button
          onClick={() =>
            setPreviewIndex((prev) => prev + 1)
          }
          className="absolute right-4 text-white text-5xl"
        >
          ›
        </button>
      )}

    </div>

    {/* THUMBNAILS */}
    <div className="flex gap-2 overflow-x-auto p-4 justify-center">

      {previewImages.map((img, index) => (

        <img
          key={index}
          src={img}
          onClick={() => setPreviewIndex(index)}
          className={`w-16 h-16 object-cover rounded cursor-pointer border-2 transition ${
            previewIndex === index
              ? 'border-white'
              : 'border-transparent opacity-60'
          }`}
        />

      ))}

    </div>

  </div>
)}
 
</MainLayout>
    </ProtectedRoute>
  );
}
  