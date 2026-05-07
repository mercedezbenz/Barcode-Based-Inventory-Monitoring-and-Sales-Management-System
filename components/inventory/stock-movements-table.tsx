"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimestamp } from "@/lib/utils"

interface StockMovementsTableProps {
  movements: any[]
}

export function StockMovementsTable({ movements }: StockMovementsTableProps) {
  if (!movements || movements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No stock movements found</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[140px]">Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Subcategory</TableHead>
            <TableHead className="text-right w-[120px]">Quantity</TableHead>
            <TableHead className="w-[160px]">When</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{m.movementType || "-"}</TableCell>
              <TableCell>{m.category || "-"}</TableCell>
              <TableCell>{m.subcategory || "-"}</TableCell>
              <TableCell className="text-right">{(m.quantity || 0).toLocaleString()}</TableCell>
              <TableCell>{formatTimestamp(m.createdAt)}</TableCell>
              <TableCell>{m.reason || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}




