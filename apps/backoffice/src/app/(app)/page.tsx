import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@metrobet/ui';

const STATS = ['Active players', 'Bets today', 'GGR today', 'Open tickets'];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
