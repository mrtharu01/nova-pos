"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";


type UnknownRecord = {
  [key: string]:
    unknown;
};


function numberValue(
  value: unknown,
) {
  const number =
    Number(
      value ??
      0,
    );


  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}


function arrayValue(
  value: unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}


function objectValue(
  value: unknown,
): UnknownRecord {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      UnknownRecord;
  }


  return {};
}


export async function fetchDashboardReport({
  businessId,
  startDate,
  endDate,
}: {
  businessId: string;

  startDate: string;

  endDate: string;
}): Promise<DashboardReport> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_dashboard_report",
      {
        p_business_id:
          businessId,

        p_start_date:
          startDate,

        p_end_date:
          endDate,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const report =
    objectValue(
      data,
    );


  const summary =
    objectValue(
      report.summary,
    );


  const revenue =
    numberValue(
      summary.revenue,
    );


  const dailySales =
    arrayValue(
      report.dailySales,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          date:
            String(
              row.date ??
                "",
            ),

          revenue:
            numberValue(
              row.revenue,
            ),

          transactions:
            numberValue(
              row.transactions,
            ),

          itemsSold:
            numberValue(
              row.itemsSold,
            ),
        };
      },
    );


  const paymentBreakdown =
    arrayValue(
      report.paymentBreakdown,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          method:
            String(
              row.method ??
                "other",
            ),

          amount:
            numberValue(
              row.amount,
            ),

          transactions:
            numberValue(
              row.transactions,
            ),
        };
      },
    );


  const topProducts =
    arrayValue(
      report.topProducts,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          productId:
            typeof row.productId ===
              "string"
              ? row.productId
              : null,

          name:
            String(
              row.name ??
                "Product",
            ),

          quantity:
            numberValue(
              row.quantity,
            ),

          revenue:
            numberValue(
              row.revenue,
            ),
        };
      },
    );


  const lowStock =
    arrayValue(
      report.lowStock,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          productId:
            String(
              row.productId ??
                "",
            ),

          variantId:
            String(
              row.variantId ??
                "",
            ),

          productName:
            String(
              row.productName ??
                "Product",
            ),

          variantName:
            String(
              row.variantName ??
                "Standard",
            ),

          sku:
            String(
              row.sku ??
                "",
            ),

          stock:
            numberValue(
              row.stock,
            ),

          threshold:
            numberValue(
              row.threshold,
            ),
        };
      },
    );


  const recentSales =
    arrayValue(
      report.recentSales,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        const total =
          numberValue(
            row.total,
          );


        const refundAmount =
          numberValue(
            row.refundAmount,
          );


        return {
          id:
            String(
              row.id ??
                "",
            ),

          receiptNumber:
            String(
              row.receiptNumber ??
                "",
            ),

          createdAt:
            String(
              row.createdAt ??
                "",
            ),

          customerName:
            typeof row.customerName ===
              "string"
              ? row.customerName
              : null,

          total,

          refundAmount,

          netTotal:
            row.netTotal ===
              undefined
              ? Math.max(
                  total -
                  refundAmount,
                  0,
                )
              : numberValue(
                  row.netTotal,
                ),

          currencyCode:
            String(
              row.currencyCode ??
                "LKR",
            ),

          status:
            String(
              row.status ??
                "completed",
            ) as DashboardReport[
              "recentSales"
            ][number][
              "status"
            ],

          itemQuantityTotal:
            numberValue(
              row.itemQuantityTotal,
            ),
        };
      },
    );


  return {
    businessId:
      String(
        report.businessId ??
          businessId,
      ),

    timezone:
      String(
        report.timezone ??
          "Asia/Colombo",
      ),

    startDate:
      String(
        report.startDate ??
          startDate,
      ),

    endDate:
      String(
        report.endDate ??
          endDate,
      ),

    summary: {
      grossRevenue:
        summary.grossRevenue ===
          undefined
          ? revenue
          : numberValue(
              summary.grossRevenue,
            ),

      refundAmount:
        numberValue(
          summary.refundAmount,
        ),

      revenue,

      transactions:
        numberValue(
          summary.transactions,
        ),

      refunds:
        numberValue(
          summary.refunds,
        ),

      itemsSold:
        numberValue(
          summary.itemsSold,
        ),

      averageSale:
        numberValue(
          summary.averageSale,
        ),

      cogs:
        numberValue(
          summary.cogs,
        ),

      grossProfit:
        numberValue(
          summary.grossProfit,
        ),
    },

    dailySales,

    paymentBreakdown,

    topProducts,

    lowStock,

    recentSales,
  };
}