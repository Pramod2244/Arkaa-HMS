"use client";

import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BillingTableProps {
  data: any[];
}

export function BillingTable({ data }: BillingTableProps) {
  const columns = [
    { 
      key: "departmentName", 
      header: "Department" 
    },
    { 
      key: "invoiceCount", 
      header: "Invoices" 
    },
    { 
      key: "revenue", 
      header: "Revenue",
      render: (val: any) => `₹${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departmental Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data} />
      </CardContent>
    </Card>
  );
}
