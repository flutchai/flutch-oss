import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { usersApi, type User } from "@/api/users";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function UsersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page],
    queryFn: () => usersApi.list({ page, limit: 20 }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold" data-testid="users-heading">Users</h1>
        <p className="text-sm text-muted-fg mt-0.5" data-testid="users-total">{data?.total ?? 0} users</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-fg" data-testid="users-loading">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Identities</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((user: User) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-mono text-xs text-muted-fg" data-testid="user-id">
                      {user.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.identities?.map(i => (
                          <Badge
                            key={i.platform + i.externalId}
                            variant="secondary"
                            className="text-[10px] gap-1"
                            data-testid="identity-badge"
                          >
                            {i.platform}: {i.externalId}
                            {i.metadata?.username ? ` (@${i.metadata.username})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-fg">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link to="/users/$id" params={{ id: user.id }}>
                        <Button size="sm" variant="ghost" data-testid="user-open">
                          Open →
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-fg py-12" data-testid="users-empty">
                      No users
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-fg" data-testid="pagination-info">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
