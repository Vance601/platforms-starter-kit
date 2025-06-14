import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface InventoryHistoryProps {
  itemId: string
}

export function InventoryHistory({ itemId }: InventoryHistoryProps) {
  // In a real app, you would fetch the transaction history based on the itemId
  const transactions = [
    {
      id: "TRX-001",
      date: "2023-04-01",
      type: "usage",
      quantity: 5,
      user: "John Doe",
      reference: "TASK-1234",
      notes: "Used for battery replacement in Building A",
    },
    {
      id: "TRX-002",
      date: "2023-03-28",
      type: "usage",
      quantity: 8,
      user: "Sarah Miller",
      reference: "TASK-1235",
      notes: "Used for new battery assembly",
    },
    {
      id: "TRX-003",
      date: "2023-03-15",
      type: "restock",
      quantity: 100,
      user: "Robert Chen",
      reference: "PO-4567",
      notes: "Regular monthly restock",
    },
    {
      id: "TRX-004",
      date: "2023-03-10",
      type: "usage",
      quantity: 12,
      user: "Maria Garcia",
      reference: "TASK-1230",
      notes: "Used for emergency replacement",
    },
    {
      id: "TRX-005",
      date: "2023-03-05",
      type: "usage",
      quantity: 7,
      user: "John Doe",
      reference: "TASK-1228",
      notes: "Used for routine maintenance",
    },
    {
      id: "TRX-006",
      date: "2023-02-20",
      type: "adjustment",
      quantity: -3,
      user: "Robert Chen",
      reference: "INV-CHECK-02",
      notes: "Inventory count adjustment",
    },
    {
      id: "TRX-007",
      date: "2023-02-15",
      type: "usage",
      quantity: 10,
      user: "Sarah Miller",
      reference: "TASK-1220",
      notes: "Used for battery pack assembly",
    },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Transaction ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{transaction.date}</TableCell>
            <TableCell className="font-medium">{transaction.id}</TableCell>
            <TableCell>
              <Badge
                variant={
                  transaction.type === "usage" ? "outline" : transaction.type === "restock" ? "default" : "secondary"
                }
              >
                {transaction.type === "usage" ? "Usage" : transaction.type === "restock" ? "Restock" : "Adjustment"}
              </Badge>
            </TableCell>
            <TableCell
              className={
                transaction.type === "usage" || transaction.quantity < 0 ? "text-destructive" : "text-green-600"
              }
            >
              {transaction.type === "usage" || transaction.quantity < 0 ? "-" : "+"}
              {Math.abs(transaction.quantity)}
            </TableCell>
            <TableCell>{transaction.user}</TableCell>
            <TableCell>{transaction.reference}</TableCell>
            <TableCell className="max-w-[200px] truncate">{transaction.notes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
