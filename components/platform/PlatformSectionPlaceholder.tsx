import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


export function PlatformSectionPlaceholder({
  eyebrow,
  title,
  description,
  next,
}: {
  eyebrow:
    string;

  title:
    string;

  description:
    string;

  next:
    string;
}) {
  return (
    <div className="space-y-6">

      <div>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>


        <h1 className="mt-1 text-2xl font-bold">
          {title}
        </h1>


        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>

      </div>


      <Card>

        <CardHeader>

          <CardTitle>
            Control surface prepared
          </CardTitle>

        </CardHeader>


        <CardContent>

          <div className="rounded-[18px] border border-dashed bg-muted/10 p-6">

            <p className="text-sm font-semibold">
              {next}
            </p>


            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This route is already protected by the hidden portal key and platform-admin role checks. The operational controls will be connected in the next implementation step.
            </p>

          </div>

        </CardContent>

      </Card>

    </div>
  );
}
