"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, Edit } from "lucide-react"
import { CategoryService } from "@/services/firebase-service"
import type { Category } from "@/lib/types"

interface CategoryManagerProps {
  categories: Category[]
  onCategoriesChange: (categories: Category[]) => void
}

export function CategoryManager({ categories, onCategoriesChange }: CategoryManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newCategory, setNewCategory] = useState({ name: "", subcategories: "" })
  const [loading, setLoading] = useState(false)

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return

    setLoading(true)
    try {
      const subcategoriesArray = newCategory.subcategories
        .split(",")
        .map((sub) => sub.trim())
        .filter((sub) => sub.length > 0)

      await CategoryService.addCategory({
        name: newCategory.name.trim(),
        subcategories: subcategoriesArray,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Refresh categories
      const updatedCategories = await CategoryService.getCategories()
      onCategoriesChange(updatedCategories)

      setNewCategory({ name: "", subcategories: "" })
      setShowAddDialog(false)
    } catch (error) {
      console.error("Error adding category:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      try {
        await CategoryService.deleteCategory(id)
        const updatedCategories = await CategoryService.getCategories()
        onCategoriesChange(updatedCategories)
      } catch (error) {
        console.error("Error deleting category:", error)
      }
    }
  }

  const handleEditCategory = async () => {
    if (!editingCategory) return

    setLoading(true)
    try {
      const subcategoriesArray = newCategory.subcategories
        .split(",")
        .map((sub) => sub.trim())
        .filter((sub) => sub.length > 0)

      await CategoryService.updateCategory(editingCategory.id, {
        name: newCategory.name.trim(),
        subcategories: subcategoriesArray,
        updatedAt: new Date(),
      })

      // Refresh categories
      const updatedCategories = await CategoryService.getCategories()
      onCategoriesChange(updatedCategories)

      setEditingCategory(null)
      setNewCategory({ name: "", subcategories: "" })
    } catch (error) {
      console.error("Error updating category:", error)
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setNewCategory({
      name: category.name,
      subcategories: category.subcategories.join(", "),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Category Management</h2>
          <p className="text-muted-foreground">Manage inventory categories and subcategories</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>{category.subcategories.length} subcategories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {category.subcategories.map((subcategory) => (
                  <Badge key={subcategory} variant="secondary">
                    {subcategory}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Category Dialog */}
      <Dialog
        open={showAddDialog || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false)
            setEditingCategory(null)
            setNewCategory({ name: "", subcategories: "" })
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category name and subcategories."
                : "Create a new category with subcategories for your inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="categoryName">Category Name</Label>
              <Input
                id="categoryName"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., BEEF, CHICKEN, PORK"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategories">Subcategories</Label>
              <Input
                id="subcategories"
                value={newCategory.subcategories}
                onChange={(e) => setNewCategory({ ...newCategory, subcategories: e.target.value })}
                placeholder="e.g., shortplate trims, meat trims, for ground (comma separated)"
              />
              <p className="text-xs text-muted-foreground">Separate multiple subcategories with commas</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddDialog(false)
                setEditingCategory(null)
                setNewCategory({ name: "", subcategories: "" })
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingCategory ? handleEditCategory : handleAddCategory} disabled={loading}>
              {loading ? "Saving..." : editingCategory ? "Update" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
