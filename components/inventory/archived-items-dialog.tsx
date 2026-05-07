"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InventoryService } from "@/services/firebase-service"
import { InventoryItem } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Archive, RotateCcw, Loader2, SearchX } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ArchivedItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchivedItemsDialog({ open, onOpenChange }: ArchivedItemsDialogProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return

    setLoading(true)
    const unsubscribe = InventoryService.subscribeToArchivedItems(
      (archivedItems) => {
        setItems(archivedItems)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching archived items:", error)
        setLoading(false)
        toast({
          title: "Error",
          description: "Failed to load archived items.",
          variant: "destructive",
        })
      }
    )

    return () => unsubscribe()
  }, [open, toast])

  const handleRestore = async (id: string, name: string) => {
    setRestoreLoading(id)
    try {
      await InventoryService.updateItem(id, {
        isArchived: false,
        // archivedAt: null // Optional: clear archivedAt
      })
      toast({
        title: "✅ Item Restored",
        description: `"${name}" has been restored to active inventory.`,
      })
    } catch (error: any) {
      console.error("Error restoring item:", error)
      toast({
        title: "❌ Failed to Restore",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setRestoreLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            Archived Inventory
          </DialogTitle>
          <DialogDescription>
            View and restore previously archived inventory items.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading archived items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <SearchX className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-lg font-semibold">No Archived Items</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Items you archive from the main inventory will appear here.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-left font-medium">Barcode</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {item.name || (item as any).productName || "Unnamed Item"}
                        </div>
                        {(item as any).productType && (
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {(item as any).productType}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {item.barcode}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          onClick={() => handleRestore(item.id, item.name || (item as any).productName)}
                          disabled={restoreLoading === item.id}
                        >
                          {restoreLoading === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
