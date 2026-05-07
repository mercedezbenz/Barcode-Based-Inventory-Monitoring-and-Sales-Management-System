"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MapPin } from "lucide-react"
import type { CustomerTransaction } from "@/lib/types"
import { formatTimestamp } from "@/lib/utils"

interface PendingTransactionsTableProps {
  transactions: CustomerTransaction[]
}

export function PendingTransactionsTable({ transactions }: PendingTransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No pending transactions found</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Barcode</TableHead>
          <TableHead className="text-center">Quantity</TableHead>
          <TableHead>Transaction Date</TableHead>
          <TableHead className="text-center">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="font-medium whitespace-normal break-words min-w-[150px]">{transaction.customerName}</TableCell>
            <TableCell>{transaction.customerAddress}</TableCell>
            <TableCell>{transaction.productName}</TableCell>
            <TableCell className="font-mono text-sm">{transaction.productBarcode}</TableCell>
            <TableCell className="text-center">
              <Badge variant="outline">{transaction.quantity}</Badge>
            </TableCell>
            <TableCell>{formatTimestamp(transaction.transactionDate)}</TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-2">
                <a
                  href={`https://sinotrackpro.com/#/login?account=${encodeURIComponent(
                    process.env.NEXT_PUBLIC_SINOTRACK_ACCOUNT || "",
                  )}&password=${encodeURIComponent(process.env.NEXT_PUBLIC_SINOTRACK_PASSWORD || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline">Track Delivery</Button>
                </a>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
