"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  CustomerDetail,
  CustomerSummary,
  SaveCustomerInput,
} from "@/lib/domain/customers";


type UnknownRecord = {
  [key: string]:
    unknown;
};


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


function arrayValue(
  value: unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}


function numberValue(
  value: unknown,
) {
  const result =
    Number(
      value ??
      0,
    );


  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}


function nullableString(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value
    : null;
}


export async function listCustomers({
  businessId,
  search = "",
}: {
  businessId: string;

  search?: string;
}): Promise<CustomerSummary[]> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_customers",
      {
        p_business_id:
          businessId,

        p_search:
          search,

        p_limit:
          200,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return arrayValue(
    data,
  ).map(
    (value) => {
      const row =
        objectValue(
          value,
        );


      return {
        id:
          String(
            row.id ??
              "",
          ),

        name:
          String(
            row.name ??
              "Customer",
          ),

        phone:
          String(
            row.phone ??
              "",
          ),

        email:
          nullableString(
            row.email,
          ),

        defaultDiscountPercent:
          numberValue(
            row.defaultDiscountPercent,
          ),

        notes:
          String(
            row.notes ??
              "",
          ),

        isActive:
          row.isActive !==
          false,

        loyaltyPoints:
          numberValue(
            row.loyaltyPoints,
          ),

        lifetimeSpend:
          numberValue(
            row.lifetimeSpend,
          ),

        visits:
          numberValue(
            row.visits,
          ),

        lastPurchaseAt:
          nullableString(
            row.lastPurchaseAt,
          ),

        createdAt:
          String(
            row.createdAt ??
              "",
          ),
      };
    },
  );
}


export async function saveCustomer(
  input:
    SaveCustomerInput,
) {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_customer",
      {
        p_business_id:
          input.businessId,

        p_customer_id:
          input.customerId ??
          null,

        p_name:
          input.name,

        p_phone:
          input.phone,

        p_email:
          input.email?.trim() ||
          null,

        p_default_discount_percent:
          input.defaultDiscountPercent ??
          0,

        p_notes:
          input.notes ??
          "",

        p_is_active:
          input.isActive ??
          true,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return String(
    data,
  );
}


export async function fetchCustomerDetail({
  businessId,
  customerId,
}: {
  businessId: string;

  customerId: string;
}): Promise<CustomerDetail> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_customer_detail",
      {
        p_business_id:
          businessId,

        p_customer_id:
          customerId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const root =
    objectValue(
      data,
    );


  const customer =
    objectValue(
      root.customer,
    );


  const sales =
    arrayValue(
      root.sales,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
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

          status:
            String(
              row.status ??
                "completed",
            ) as CustomerDetail[
              "sales"
            ][number]["status"],

          originalTotal:
            numberValue(
              row.originalTotal,
            ),

          netTotal:
            numberValue(
              row.netTotal,
            ),

          currencyCode:
            String(
              row.currencyCode ??
                "LKR",
            ),
        };
      },
    );


  const loyaltyTransactions =
    arrayValue(
      root.loyaltyTransactions,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          id:
            String(
              row.id ??
                "",
            ),

          type:
            String(
              row.type ??
                "manual_adjustment",
            ) as CustomerDetail[
              "loyaltyTransactions"
            ][number]["type"],

          pointsDelta:
            numberValue(
              row.pointsDelta,
            ),

          monetaryValue:
            numberValue(
              row.monetaryValue,
            ),

          description:
            String(
              row.description ??
                "",
            ),

          saleId:
            nullableString(
              row.saleId,
            ),

          refundId:
            nullableString(
              row.refundId,
            ),

          createdAt:
            String(
              row.createdAt ??
                "",
            ),
        };
      },
    );


  return {
    customer: {
      id:
        String(
          customer.id ??
            "",
        ),

      name:
        String(
          customer.name ??
            "Customer",
        ),

      phone:
        String(
          customer.phone ??
            "",
        ),

      email:
        nullableString(
          customer.email,
        ),

      defaultDiscountPercent:
        numberValue(
          customer.defaultDiscountPercent,
        ),

      notes:
        String(
          customer.notes ??
            "",
        ),

      isActive:
        customer.isActive !==
        false,

      createdAt:
        String(
          customer.createdAt ??
            "",
        ),

      updatedAt:
        String(
          customer.updatedAt ??
            "",
        ),
    },

    loyaltyPoints:
      numberValue(
        root.loyaltyPoints,
      ),

    lifetimeSpend:
      numberValue(
        root.lifetimeSpend,
      ),

    visits:
      numberValue(
        root.visits,
      ),

    sales,

    loyaltyTransactions,
  };
}


export async function lookupCustomerByPhone({
  businessId,
  phone,
}: {
  businessId: string;

  phone: string;
}): Promise<CustomerDetail | null> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "lookup_customer_by_phone",
      {
        p_business_id:
          businessId,

        p_phone:
          phone,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  if (!data) {
    return null;
  }


  const root =
    objectValue(
      data,
    );


  const customer =
    objectValue(
      root.customer,
    );


  return fetchCustomerDetail({
    businessId,

    customerId:
      String(
        customer.id ??
          "",
      ),
  });
}


export async function adjustCustomerLoyalty({
  businessId,
  customerId,
  pointsDelta,
  reason,
}: {
  businessId: string;

  customerId: string;

  pointsDelta: number;

  reason: string;
}) {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "adjust_customer_loyalty",
      {
        p_business_id:
          businessId,

        p_customer_id:
          customerId,

        p_points_delta:
          pointsDelta,

        p_reason:
          reason,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return numberValue(
    data,
  );
}