type NovaEmailDetail = {
  label: string;
  value: string;
};

type NovaEmailTemplateProps = {
  eyebrow?: string;
  title: string;
  message: string;

  details?: NovaEmailDetail[];

  ctaLabel?: string;
  ctaUrl?: string;

  footer?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function novaEmailTemplate({
  eyebrow = "NOVA POS",
  title,
  message,
  details = [],
  ctaLabel,
  ctaUrl,
  footer = "NOVA POS · POINT OF SALE SYSTEM",
}: NovaEmailTemplateProps) {
  const detailsHtml =
    details.length > 0
      ? `
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            margin-top: 28px;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            overflow: hidden;
          "
        >
          ${details
            .map(
              (detail, index) => `
                <tr>
                  <td
                    style="
                      padding: 16px 18px;
                      ${
                        index !== details.length - 1
                          ? "border-bottom: 1px solid #e5e7eb;"
                          : ""
                      }
                    "
                  >
                    <div
                      style="
                        font-size: 10px;
                        line-height: 1.4;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        color: #6b7280;
                        font-weight: 700;
                        margin-bottom: 5px;
                      "
                    >
                      ${escapeHtml(detail.label)}
                    </div>

                    <div
                      style="
                        font-size: 15px;
                        line-height: 1.5;
                        color: #111827;
                        font-weight: 600;
                      "
                    >
                      ${escapeHtml(detail.value)}
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </table>
      `
      : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <table
          role="presentation"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="margin-top: 30px;"
        >
          <tr>
            <td
              bgcolor="#4F46E5"
              style="
                border-radius: 12px;
              "
            >
              <a
                href="${escapeHtml(ctaUrl)}"
                style="
                  display: inline-block;
                  padding: 14px 22px;
                  font-size: 12px;
                  font-family: Arial, Helvetica, sans-serif;
                  font-weight: 700;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  text-decoration: none;
                  color: #ffffff;
                  border-radius: 12px;
                "
              >
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>
      `
      : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <title>${escapeHtml(title)}</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color: #f4f4f5;"
    >
      <tr>
        <td
          align="center"
          style="padding: 40px 16px;"
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 600px;
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 24px;
              overflow: hidden;
            "
          >
            <!-- BRAND HEADER -->
            <tr>
              <td
                style="
                  padding: 28px 32px;
                  border-bottom: 1px solid #e5e7eb;
                "
              >
                <div
                  style="
                    font-size: 18px;
                    line-height: 1;
                    font-weight: 800;
                    letter-spacing: -0.03em;
                    color: #111827;
                  "
                >
                  NOVA
                </div>

                <div
                  style="
                    margin-top: 5px;
                    font-size: 9px;
                    line-height: 1;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    color: #71717a;
                    text-transform: uppercase;
                  "
                >
                  Point of Sale
                </div>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td
                style="
                  padding: 38px 32px 34px;
                "
              >
                <div
                  style="
                    font-size: 10px;
                    line-height: 1.4;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: #4F46E5;
                    margin-bottom: 12px;
                  "
                >
                  ${escapeHtml(eyebrow)}
                </div>

                <h1
                  style="
                    margin: 0;
                    font-size: 28px;
                    line-height: 1.15;
                    letter-spacing: -0.035em;
                    color: #111827;
                    text-transform: uppercase;
                  "
                >
                  ${escapeHtml(title)}
                </h1>

                <p
                  style="
                    margin: 18px 0 0;
                    font-size: 15px;
                    line-height: 1.75;
                    color: #52525b;
                  "
                >
                  ${escapeHtml(message)}
                </p>

                ${detailsHtml}

                ${ctaHtml}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td
                style="
                  padding: 24px 32px;
                  background-color: #fafafa;
                  border-top: 1px solid #e5e7eb;
                "
              >
                <div
                  style="
                    font-size: 9px;
                    line-height: 1.5;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: #a1a1aa;
                  "
                >
                  ${escapeHtml(footer)}
                </div>

                <div
                  style="
                    margin-top: 7px;
                    font-size: 11px;
                    line-height: 1.6;
                    color: #a1a1aa;
                  "
                >
                  This is an automated transactional email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}