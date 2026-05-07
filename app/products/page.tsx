"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore"
import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"

type Product = {
  id: string
  name: string
  type: string
  category?: string
  imageUrl?: string
  price?: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
const [selectedCategory, setSelectedCategory] = useState("")
const [selectedType, setSelectedType] = useState("")
const categories = Array.from(
  new Set(products.map((p) => p.category).filter(Boolean))
)

const types = Array.from(
  new Set(
    products
      .filter((p) => p.category === selectedCategory)
      .map((p) => p.type)
  )
)


  // 🔄 FETCH PRODUCTS
  useEffect(() => {
    const fetchProducts = async () => {
      const db = getFirestore()
      const snapshot = await getDocs(collection(db, "products"))

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]

      setProducts(data)
      setLoading(false)
    }

    fetchProducts()
  }, [])

  // 💾 SAVE PRICE TO FIRESTORE
  const handleSavePrice = async (id: string) => {
    try {
      const db = getFirestore()
      const newPrice = Number(editingPrices[id])

      if (isNaN(newPrice)) {
        alert("Invalid price")
        return
      }

      await updateDoc(doc(db, "products", id), {
        price: newPrice,
      })

      // update UI instantly
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, price: newPrice } : p
        )
      )

      // clear input
      setEditingPrices((prev) => ({
        ...prev,
        [id]: "",
      }))

      alert("✅ Price updated!")
    } catch (error) {
      console.error("Error updating price:", error)
    }
  }
const filteredProducts = products.filter((p) => {
  const matchesSearch = p.name
    ?.toLowerCase()
    .includes(search.toLowerCase())

  const matchesCategory = selectedCategory
    ? p.category === selectedCategory
    : true

  const matchesType = selectedType
    ? p.type === selectedType
    : true

  return matchesSearch && matchesCategory && matchesType
})
  return (
    <ProtectedRoute allowedRoles={["sales"]}>
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">

        {/* HEADER */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Products</h1>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4">

          {loading && (
            <div className="text-center text-gray-400">
              Loading products...
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="text-center text-gray-400">
              No products found
            </div>
          )}
          <div className="flex flex-wrap gap-3 p-4">

  {/* SEARCH */}
  <input
    type="text"
    placeholder="Search product..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2787b4]"
  />

  {/* CATEGORY FILTER */}
  <select
    value={selectedCategory}
    onChange={(e) => {
      setSelectedCategory(e.target.value)
      setSelectedType("") // reset type
    }}
    className="border rounded-lg px-3 py-2"
  >
    <option value="">All Category</option>
    {categories.map((cat) => (
      <option key={cat} value={cat}>
        {cat}
      </option>
    ))}
  </select>

  {/* TYPE FILTER (dependent) */}
  <select
    value={selectedType}
    onChange={(e) => setSelectedType(e.target.value)}
    disabled={!selectedCategory}
    className="border rounded-lg px-3 py-2 disabled:opacity-50"
  >
    <option value="">All Type</option>
    {types.map((type) => (
      <option key={type} value={type}>
        {type}
      </option>
    ))}
  </select>
</div>

          {/* PRODUCT LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((p) => {
              const hasPrice =
                p.price !== undefined && p.price !== null

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-white border rounded-xl p-4 shadow-sm"
                >
                  {/* LEFT SIDE */}
                  <div className="flex items-center gap-4">

                    {/* IMAGE */}
                    <div className="w-14 h-14 bg-gray-200 rounded-md overflow-hidden">
                      <Image
                        src={p.imageUrl || "/placeholder.png"}
                        className="w-full h-full object-cover"
                        alt={p.name}
                        width={100}
                        height={100}
                      />
                    </div>

                    {/* INFO */}
                    <div>
                      <p className="font-medium">
                        Product Name:{" "}
                        <span className="font-normal">
                          {p.name}
                        </span>
                      </p>

                      <p className="text-sm text-gray-500">
                        Category: {p.category || "N/A"}
                      </p>

                      <p className="text-sm text-gray-500">
                        Type: {p.type}
                      </p>

                      <p className="text-sm text-gray-500">
                        Price:{" "}
                        {hasPrice
                          ? `₱ ${p.price?.toLocaleString()}`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT SIDE */}
                  <div className="flex items-center gap-3">

                    {/* LABEL */}
                    <span className="text-sm text-gray-600">
                      {hasPrice ? "Edit Price" : "Set Price"}
                    </span>

                    {/* INPUT */}
                    <input
  type="number"
  placeholder="Enter price"
  value={editingPrices[p.id] || ""}
  onChange={(e) =>
    setEditingPrices((prev) => ({
      ...prev,
      [p.id]: e.target.value,
    }))
  }
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handleSavePrice(p.id)
    }
  }}
  className="w-32 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#2787b4]"
/>

                    {/* SAVE BUTTON */}
                    <button
                      onClick={() => handleSavePrice(p.id)}
                      className="bg-[#2787b4] text-white px-5 py-2 rounded-lg hover:opacity-90 transition"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
    </ProtectedRoute>
  )
}