import type {
  BulkProductImportRow,
} from "@/lib/data/catalog-admin";


export const BULK_IMPORT_COLUMNS = [
  "product_key",
  "product_name",
  "category",
  "description",
  "variant_name",
  "sku",
  "barcode",
  "price",
  "cost",
  "stock",
  "low_stock_threshold",
  "status",
] as const;


type ImportColumn =
  typeof BULK_IMPORT_COLUMNS[number];


export type CatalogImportPreviewRow = {
  sourceRow: number;

  data:
    BulkProductImportRow;

  errors:
    string[];
};


export type CatalogImportPreview = {
  rows:
    CatalogImportPreviewRow[];

  recognizedColumns:
    ImportColumn[];

  ignoredColumns:
    string[];

  validRows: number;

  invalidRows: number;
};


const HEADER_ALIASES:
  Record<
    string,
    ImportColumn
  > = {
    product_key:
      "product_key",

    group:
      "product_key",

    group_key:
      "product_key",

    product_group:
      "product_key",

    product:
      "product_name",

    product_name:
      "product_name",

    name:
      "product_name",

    category:
      "category",

    product_category:
      "category",

    description:
      "description",

    desc:
      "description",

    variant:
      "variant_name",

    variant_name:
      "variant_name",

    size:
      "variant_name",

    sku:
      "sku",

    item_code:
      "sku",

    product_code:
      "sku",

    barcode:
      "barcode",

    gtin:
      "barcode",

    ean:
      "barcode",

    ean13:
      "barcode",

    ean_13:
      "barcode",

    upc:
      "barcode",

    price:
      "price",

    selling_price:
      "price",

    retail_price:
      "price",

    sale_price:
      "price",

    cost:
      "cost",

    cost_price:
      "cost",

    buying_price:
      "cost",

    purchase_price:
      "cost",

    stock:
      "stock",

    qty:
      "stock",

    quantity:
      "stock",

    opening_stock:
      "stock",

    initial_stock:
      "stock",

    low_stock:
      "low_stock_threshold",

    low_stock_threshold:
      "low_stock_threshold",

    reorder_level:
      "low_stock_threshold",

    status:
      "status",
  };


function normalizeHeader(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[()]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}


function cleanMoney(
  value: string,
) {
  return value
    .trim()
    .replace(
      /,/g,
      "",
    )
    .replace(
      /\bLKR\b/gi,
      "",
    )
    .replace(
      /\bRs\.?\b/gi,
      "",
    )
    .trim();
}


function parseRequiredNumber(
  value: string,
  label: string,
  errors: string[],
) {
  const cleaned =
    cleanMoney(
      value,
    );


  if (
    cleaned ===
      ""
  ) {
    errors.push(
      `${label} is required.`,
    );

    return 0;
  }


  const parsed =
    Number(
      cleaned,
    );


  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <
      0
  ) {
    errors.push(
      `${label} must be zero or greater.`,
    );

    return 0;
  }


  return parsed;
}


function parseOptionalNumber(
  value: string,
  fallback: number,
  label: string,
  errors: string[],
  integer = false,
) {
  const cleaned =
    cleanMoney(
      value,
    );


  if (
    cleaned ===
      ""
  ) {
    return fallback;
  }


  const parsed =
    Number(
      cleaned,
    );


  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <
      0 ||
    (
      integer &&
      !Number.isInteger(
        parsed,
      )
    )
  ) {
    errors.push(
      integer
        ? `${label} must be a whole number zero or greater.`
        : `${label} must be zero or greater.`,
    );

    return fallback;
  }


  return parsed;
}


export function buildCatalogImportPreview(
  matrix: string[][],
): CatalogImportPreview {
  const nonEmptyRows =
    matrix.filter(
      (
        row,
      ) =>
        row.some(
          (
            value,
          ) =>
            value.trim() !==
              "",
        ),
    );


  if (
    nonEmptyRows.length ===
      0
  ) {
    return {
      rows:
        [],

      recognizedColumns:
        [],

      ignoredColumns:
        [],

      validRows:
        0,

      invalidRows:
        0,
    };
  }


  const headerRow =
    nonEmptyRows[0];


  const mappedColumns =
    new Map<
      number,
      ImportColumn
    >();


  const recognized =
    new Set<
      ImportColumn
    >();


  const ignored:
    string[] = [];


  headerRow.forEach(
    (
      rawHeader,
      index,
    ) => {
      const normalized =
        normalizeHeader(
          rawHeader,
        );


      const mapped =
        HEADER_ALIASES[
          normalized
        ];


      if (
        mapped &&
        !recognized.has(
          mapped,
        )
      ) {
        mappedColumns.set(
          index,
          mapped,
        );

        recognized.add(
          mapped,
        );
      } else if (
        rawHeader.trim()
      ) {
        ignored.push(
          rawHeader.trim(),
        );
      }
    },
  );


  const previewRows:
    CatalogImportPreviewRow[] =
      [];


  const seenSkus =
    new Map<
      string,
      number
    >();


  const seenBarcodes =
    new Map<
      string,
      number
    >();


  for (
    let rowIndex = 1;
    rowIndex <
      nonEmptyRows.length;
    rowIndex +=
      1
  ) {
    const source =
      nonEmptyRows[
        rowIndex
      ];


    const values:
      Partial<
        Record<
          ImportColumn,
          string
        >
      > = {};


    for (
      const [
        index,
        column,
      ]
      of mappedColumns
    ) {
      values[
        column
      ] =
        source[
          index
        ]?.trim() ??
        "";
    }


    const errors:
      string[] = [];


    const productName =
      values.product_name
        ?.trim() ??
      "";


    if (
      productName.length <
        2
    ) {
      errors.push(
        "Product name is required.",
      );
    }


    const barcode =
      values.barcode
        ?.trim() ??
      "";


    let sku =
      values.sku
        ?.trim()
        .toUpperCase() ??
      "";


    if (
      !sku &&
      barcode
    ) {
      sku =
        `BC-${barcode}`
          .toUpperCase();
    }


    if (
      !sku
    ) {
      errors.push(
        "Provide a SKU or barcode.",
      );
    }


    const price =
      parseRequiredNumber(
        values.price ??
        "",
        "Price",
        errors,
      );


    const cost =
      parseOptionalNumber(
        values.cost ??
        "",
        0,
        "Cost",
        errors,
      );


    const stock =
      parseOptionalNumber(
        values.stock ??
        "",
        0,
        "Stock",
        errors,
        true,
      );


    const lowStockThreshold =
      parseOptionalNumber(
        values.low_stock_threshold ??
        "",
        5,
        "Low stock threshold",
        errors,
        true,
      );


    const rawStatus =
      (
        values.status ??
        "active"
      )
        .trim()
        .toLowerCase();


    const status =
      rawStatus ===
        ""
        ? "active"
        : rawStatus;


    if (
      status !==
        "active" &&
      status !==
        "draft"
    ) {
      errors.push(
        "Status must be Active or Draft.",
      );
    }


    if (
      sku
    ) {
      const key =
        sku.toLowerCase();


      const existingRow =
        seenSkus.get(
          key,
        );


      if (
        existingRow
      ) {
        errors.push(
          `SKU duplicates row ${existingRow}.`,
        );
      } else {
        seenSkus.set(
          key,
          rowIndex +
            1,
        );
      }
    }


    if (
      barcode
    ) {
      const existingRow =
        seenBarcodes.get(
          barcode,
        );


      if (
        existingRow
      ) {
        errors.push(
          `Barcode duplicates row ${existingRow}.`,
        );
      } else {
        seenBarcodes.set(
          barcode,
          rowIndex +
            1,
        );
      }
    }


    previewRows.push({
      sourceRow:
        rowIndex +
        1,

      data: {
        product_key:
          values.product_key
            ?.trim() ||
          undefined,

        product_name:
          productName,

        category:
          values.category
            ?.trim() ||
          undefined,

        description:
          values.description
            ?.trim() ||
          undefined,

        variant_name:
          values.variant_name
            ?.trim() ||
          "Standard",

        sku,

        barcode:
          barcode ||
          undefined,

        price,

        cost,

        stock,

        low_stock_threshold:
          lowStockThreshold,

        status:
          status ===
            "draft"
            ? "draft"
            : "active",
      },

      errors,
    });
  }


  return {
    rows:
      previewRows,

    recognizedColumns:
      Array.from(
        recognized,
      ),

    ignoredColumns:
      ignored,

    validRows:
      previewRows.filter(
        (
          row,
        ) =>
          row.errors.length ===
            0,
      ).length,

    invalidRows:
      previewRows.filter(
        (
          row,
        ) =>
          row.errors.length >
            0,
      ).length,
  };
}


export function buildCatalogCsvTemplate() {
  const rows = [
    [
      ...BULK_IMPORT_COLUMNS,
    ],

    [
      "",
      "Sample Cola 500ml",
      "Beverages",
      "",
      "Standard",
      "",
      "4791234567890",
      "250",
      "190",
      "24",
      "5",
      "active",
    ],

    [
      "MILK",
      "Fresh Milk",
      "Dairy",
      "Grouped example: same product_key creates variants",
      "500ml",
      "MILK-500",
      "",
      "220",
      "175",
      "12",
      "4",
      "active",
    ],

    [
      "MILK",
      "Fresh Milk",
      "Dairy",
      "Grouped example: same product_key creates variants",
      "1L",
      "MILK-1L",
      "",
      "390",
      "310",
      "8",
      "3",
      "active",
    ],
  ];


  return rows
    .map(
      (
        row,
      ) =>
        row
          .map(
            (
              value,
            ) =>
              `"${String(
                value,
              ).replaceAll(
                '"',
                '""',
              )}"`,
          )
          .join(
            ",",
          ),
    )
    .join(
      "\r\n",
    );
}



export function buildCatalogCsvFromImportRows(
  rows:
    BulkProductImportRow[],
) {
  const values = [
    [
      ...BULK_IMPORT_COLUMNS,
    ],

    ...rows.map(
      (
        row,
      ) => [
        row.product_key ??
          "",

        row.product_name,

        row.category ??
          "",

        row.description ??
          "",

        row.variant_name ??
          "Standard",

        row.sku ??
          "",

        row.barcode ??
          "",

        String(
          row.price ??
          0,
        ),

        String(
          row.cost ??
          0,
        ),

        String(
          row.stock ??
          0,
        ),

        String(
          row.low_stock_threshold ??
          5,
        ),

        row.status ??
          "active",
      ],
    ),
  ];


  return values
    .map(
      (
        row,
      ) =>
        row
          .map(
            (
              value,
            ) =>
              `"${String(
                value,
              ).replaceAll(
                '"',
                '""',
              )}"`,
          )
          .join(
            ",",
          ),
    )
    .join(
      "\r\n",
    );
}
