import {
  SaleDetailsClient,
} from "@/components/sales/SaleDetailsClient";


type SalesDetailsPageProps = {
  searchParams:
    Promise<{
      sale?:
        | string
        | string[];
    }>;
};


export default async function SalesDetailsPage({
  searchParams,
}: SalesDetailsPageProps) {
  const params =
    await searchParams;


  const saleId =
    typeof params.sale ===
    "string"
      ? params.sale
      : "";


  return (
    <SaleDetailsClient
      saleId={
        saleId
      }
    />
  );
}