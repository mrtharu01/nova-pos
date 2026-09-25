export type ParsedSpreadsheet = {
  fileName: string;

  rows: string[][];
};


function trimTrailingEmpty(
  row: string[],
) {
  const next =
    [...row];


  while (
    next.length > 0 &&
    next[
      next.length - 1
    ] === ""
  ) {
    next.pop();
  }


  return next;
}


function parseDelimitedText(
  text: string,
) {
  const normalized =
    text.replace(
      /^\uFEFF/,
      "",
    );


  const firstLine =
    normalized
      .split(
        /\r?\n/,
        1,
      )[0] ??
    "";


  const candidates = [
    ",",
    "\t",
    ";",
  ];


  const delimiter =
    candidates
      .map(
        (
          candidate,
        ) => ({
          candidate,

          count:
            firstLine.split(
              candidate,
            ).length,
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.count -
          a.count,
      )[0]?.candidate ??
    ",";


  const rows:
    string[][] = [];


  let row:
    string[] = [];


  let field =
    "";


  let quoted =
    false;


  for (
    let index = 0;
    index <
    normalized.length;
    index += 1
  ) {
    const character =
      normalized[
        index
      ];


    if (
      quoted
    ) {
      if (
        character ===
        '"'
      ) {
        if (
          normalized[
            index + 1
          ] ===
          '"'
        ) {
          field +=
            '"';

          index +=
            1;
        } else {
          quoted =
            false;
        }
      } else {
        field +=
          character;
      }


      continue;
    }


    if (
      character ===
        '"'
    ) {
      quoted =
        true;

      continue;
    }


    if (
      character ===
        delimiter
    ) {
      row.push(
        field,
      );

      field =
        "";

      continue;
    }


    if (
      character ===
        "\n"
    ) {
      row.push(
        field.replace(
          /\r$/,
          "",
        ),
      );


      rows.push(
        trimTrailingEmpty(
          row,
        ),
      );


      row =
        [];

      field =
        "";

      continue;
    }


    field +=
      character;
  }


  row.push(
    field.replace(
      /\r$/,
      "",
    ),
  );


  const finalRow =
    trimTrailingEmpty(
      row,
    );


  if (
    finalRow.some(
      (
        value,
      ) =>
        value !==
          "",
    )
  ) {
    rows.push(
      finalRow,
    );
  }


  return rows;
}


type ZipEntry = {
  compressionMethod:
    number;

  compressedSize:
    number;

  localHeaderOffset:
    number;
};


function readUint16(
  view:
    DataView,

  offset:
    number,
) {
  return view.getUint16(
    offset,
    true,
  );
}


function readUint32(
  view:
    DataView,

  offset:
    number,
) {
  return view.getUint32(
    offset,
    true,
  );
}


function findEndOfCentralDirectory(
  view:
    DataView,
) {
  const minimum =
    Math.max(
      0,
      view.byteLength -
        65557,
    );


  for (
    let offset =
      view.byteLength -
      22;

    offset >=
      minimum;

    offset -=
      1
  ) {
    if (
      readUint32(
        view,
        offset,
      ) ===
        0x06054b50
    ) {
      return offset;
    }
  }


  throw new Error(
    "This Excel file is not a supported XLSX workbook.",
  );
}


function parseZipEntries(
  buffer:
    ArrayBuffer,
) {
  const view =
    new DataView(
      buffer,
    );


  const bytes =
    new Uint8Array(
      buffer,
    );


  const decoder =
    new TextDecoder(
      "utf-8",
    );


  const endOffset =
    findEndOfCentralDirectory(
      view,
    );


  const entryCount =
    readUint16(
      view,
      endOffset +
        10,
    );


  let offset =
    readUint32(
      view,
      endOffset +
        16,
    );


  const entries =
    new Map<
      string,
      ZipEntry
    >();


  for (
    let index = 0;
    index <
      entryCount;
    index +=
      1
  ) {
    if (
      readUint32(
        view,
        offset,
      ) !==
        0x02014b50
    ) {
      throw new Error(
        "The XLSX central directory is invalid.",
      );
    }


    const compressionMethod =
      readUint16(
        view,
        offset +
          10,
      );


    const compressedSize =
      readUint32(
        view,
        offset +
          20,
      );


    const fileNameLength =
      readUint16(
        view,
        offset +
          28,
      );


    const extraLength =
      readUint16(
        view,
        offset +
          30,
      );


    const commentLength =
      readUint16(
        view,
        offset +
          32,
      );


    const localHeaderOffset =
      readUint32(
        view,
        offset +
          42,
      );


    const fileName =
      decoder.decode(
        bytes.slice(
          offset +
            46,
          offset +
            46 +
            fileNameLength,
        ),
      );


    entries.set(
      fileName,
      {
        compressionMethod,
        compressedSize,
        localHeaderOffset,
      },
    );


    offset +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;
  }


  return {
    entries,
    view,
    bytes,
  };
}


async function extractZipText(
  buffer:
    ArrayBuffer,

  path:
    string,
) {
  const {
    entries,
    view,
    bytes,
  } =
    parseZipEntries(
      buffer,
    );


  const entry =
    entries.get(
      path,
    );


  if (
    !entry
  ) {
    return null;
  }


  const localOffset =
    entry.localHeaderOffset;


  if (
    readUint32(
      view,
      localOffset,
    ) !==
      0x04034b50
  ) {
    throw new Error(
      "The XLSX local file header is invalid.",
    );
  }


  const fileNameLength =
    readUint16(
      view,
      localOffset +
        26,
    );


  const extraLength =
    readUint16(
      view,
      localOffset +
        28,
    );


  const dataOffset =
    localOffset +
    30 +
    fileNameLength +
    extraLength;


  const compressed =
    bytes.slice(
      dataOffset,
      dataOffset +
        entry.compressedSize,
    );


  let output:
    Uint8Array;


  if (
    entry.compressionMethod ===
      0
  ) {
    output =
      compressed;
  } else if (
    entry.compressionMethod ===
      8
  ) {
    if (
      typeof DecompressionStream ===
        "undefined"
    ) {
      throw new Error(
        "This browser cannot read XLSX files. Save the sheet as CSV and import it instead.",
      );
    }


    const stream =
      new Blob([
        compressed,
      ])
        .stream()
        .pipeThrough(
          new DecompressionStream(
            "deflate-raw" as never,
          ),
        );


    output =
      new Uint8Array(
        await new Response(
          stream,
        ).arrayBuffer(),
      );
  } else {
    throw new Error(
      "This XLSX file uses an unsupported compression method.",
    );
  }


  return new TextDecoder(
    "utf-8",
  ).decode(
    output,
  );
}


function xmlDocument(
  value: string,
) {
  const document =
    new DOMParser()
      .parseFromString(
        value,
        "application/xml",
      );


  if (
    document.getElementsByTagName(
      "parsererror",
    ).length >
      0
  ) {
    throw new Error(
      "NOVA could not read this Excel worksheet.",
    );
  }


  return document;
}


function readSharedStrings(
  xml:
    string | null,
) {
  if (
    !xml
  ) {
    return [] as string[];
  }


  const document =
    xmlDocument(
      xml,
    );


  return Array.from(
    document.getElementsByTagName(
      "si",
    ),
  ).map(
    (
      item,
    ) =>
      Array.from(
        item.getElementsByTagName(
          "t",
        ),
      )
        .map(
          (
            textNode,
          ) =>
            textNode.textContent ??
            "",
        )
        .join(
          "",
        ),
  );
}


function columnIndexFromReference(
  reference:
    string,
) {
  const letters =
    /^[A-Z]+/i.exec(
      reference,
    )?.[0]
      .toUpperCase() ??
    "";


  let result =
    0;


  for (
    const character
    of letters
  ) {
    result =
      result *
        26 +
      (
        character.charCodeAt(
          0,
        ) -
        64
      );
  }


  return Math.max(
    0,
    result -
      1,
  );
}


function parseWorksheet(
  xml:
    string,

  sharedStrings:
    string[],
) {
  const document =
    xmlDocument(
      xml,
    );


  const rows:
    string[][] = [];


  for (
    const rowNode
    of Array.from(
      document.getElementsByTagName(
        "row",
      ),
    )
  ) {
    const row:
      string[] = [];


    for (
      const cell
      of Array.from(
        rowNode.getElementsByTagName(
          "c",
        ),
      )
    ) {
      const reference =
        cell.getAttribute(
          "r",
        ) ??
        "";


      const columnIndex =
        columnIndexFromReference(
          reference,
        );


      const type =
        cell.getAttribute(
          "t",
        ) ??
        "";


      const valueNode =
        cell.getElementsByTagName(
          "v",
        )[0];


      let value =
        "";


      if (
        type ===
          "inlineStr"
      ) {
        value =
          Array.from(
            cell.getElementsByTagName(
              "t",
            ),
          )
            .map(
              (
                textNode,
              ) =>
                textNode.textContent ??
                "",
            )
            .join(
              "",
            );
      } else {
        const raw =
          valueNode?.textContent ??
          "";


        if (
          type ===
            "s"
        ) {
          const sharedIndex =
            Number(
              raw,
            );


          value =
            Number.isInteger(
              sharedIndex,
            )
              ? sharedStrings[
                  sharedIndex
                ] ??
                ""
              : "";
        } else if (
          type ===
            "b"
        ) {
          value =
            raw ===
              "1"
              ? "TRUE"
              : "FALSE";
        } else {
          value =
            raw;
        }
      }


      while (
        row.length <
          columnIndex
      ) {
        row.push(
          "",
        );
      }


      row[
        columnIndex
      ] =
        value;
    }


    rows.push(
      trimTrailingEmpty(
        row,
      ),
    );
  }


  return rows.filter(
    (
      row,
    ) =>
      row.some(
        (
          value,
        ) =>
          value !==
            "",
      ),
  );
}


async function parseXlsx(
  file:
    File,
) {
  const buffer =
    await file.arrayBuffer();


  const {
    entries,
  } =
    parseZipEntries(
      buffer,
    );


  const worksheetPath =
    Array.from(
      entries.keys(),
    )
      .filter(
        (
          path,
        ) =>
          /^xl\/worksheets\/sheet\d+\.xml$/i.test(
            path,
          ),
      )
      .sort(
        (
          a,
          b,
        ) => {
          const aNumber =
            Number(
              /sheet(\d+)/i.exec(
                a,
              )?.[1] ??
              0,
            );


          const bNumber =
            Number(
              /sheet(\d+)/i.exec(
                b,
              )?.[1] ??
              0,
            );


          return (
            aNumber -
            bNumber
          );
        },
      )[0];


  if (
    !worksheetPath
  ) {
    throw new Error(
      "No worksheet was found in this XLSX file.",
    );
  }


  const [
    worksheetXml,
    sharedStringsXml,
  ] =
    await Promise.all([
      extractZipText(
        buffer,
        worksheetPath,
      ),

      extractZipText(
        buffer,
        "xl/sharedStrings.xml",
      ),
    ]);


  if (
    !worksheetXml
  ) {
    throw new Error(
      "NOVA could not open the first worksheet.",
    );
  }


  return parseWorksheet(
    worksheetXml,
    readSharedStrings(
      sharedStringsXml,
    ),
  );
}


export async function parseSpreadsheetFile(
  file:
    File,
): Promise<ParsedSpreadsheet> {
  const lowerName =
    file.name
      .toLowerCase();


  if (
    lowerName.endsWith(
      ".csv",
    ) ||
    lowerName.endsWith(
      ".tsv",
    )
  ) {
    return {
      fileName:
        file.name,

      rows:
        parseDelimitedText(
          await file.text(),
        ),
    };
  }


  if (
    lowerName.endsWith(
      ".xlsx",
    )
  ) {
    return {
      fileName:
        file.name,

      rows:
        await parseXlsx(
          file,
        ),
    };
  }


  if (
    lowerName.endsWith(
      ".xls",
    )
  ) {
    throw new Error(
      "Legacy .xls files are not supported. Open the file in Excel and save it as .xlsx or .csv.",
    );
  }


  throw new Error(
    "Choose a CSV, TSV, or XLSX file.",
  );
}
