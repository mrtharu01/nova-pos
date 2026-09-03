"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard } from "lucide-react";
import { formatMoney } from "@/lib/mock-data";
import { format } from "date-fns";

const MOCK_EXPENSES = [
  { id: "e1", title: "Monthly Rent", category: "Facilities", amount: 120000, date: new Date().toISOString(), method: "Bank Transfer" },
  { id: "e2", title: "Packaging Supplies", category: "Stock", amount: 15000, date: new Date().toISOString(), method: "Card" },
  { id: "e3", title: "Electricity Bill", category: "Utilities", amount: 25000, date: new Date().toISOString(), method: "Transfer" },
];

export default function ExpensesPage() {
  return (
    <AppLayout title="Expenses">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground text-sm mt-1">Track business expenses and operating costs.</p>
        </div>
        <Button className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" /> Add Expense
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="rounded-[24px] bg-primary text-primary-foreground border-transparent">
          <CardContent className="p-6">
            <p className="text-primary-foreground/80 font-medium text-sm">Total Expenses (This Month)</p>
            <p className="text-3xl font-bold mt-2">{formatMoney(160000)}</p>
          </CardContent>
        </Card>
      </div>

      <h3 className="font-semibold text-lg mb-4">Recent Expenses</h3>
      <div className="space-y-3">
        {MOCK_EXPENSES.map(exp => (
          <Card key={exp.id} className="rounded-[20px]">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{exp.title}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                    <span>{exp.category}</span>
                    <span>•</span>
                    <span>{format(new Date(exp.date), "MMM d")}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-destructive">{formatMoney(exp.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{exp.method}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
