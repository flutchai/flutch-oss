import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { usersApi, type User } from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MobileUsers() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page],
    queryFn: () => usersApi.list({ page, limit: 15 }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <span className="text-sm text-muted-fg" data-testid="users-total">
          {data?.total ?? 0} total
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div data-testid="users-loading" className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="mobile-users-list" className="space-y-3">
          {data?.data.length === 0 && (
            <div data-testid="users-empty" className="py-12 text-center text-sm text-muted-fg">
              No users
            </div>
          )}
          {data?.data.map((user: User) => (
            <Link
              key={user.id}
              to="/m/users/$id"
              params={{ id: user.id }}
              data-testid={`user-card-${user.id}`}
            >
              <div className="bg-card rounded-lg border p-4 hover:border-primary/40 transition-colors">
                <p className="font-mono text-sm truncate text-foreground">{user.id}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {user.identities?.map(identity => (
                    <Badge
                      key={identity.platform + identity.externalId}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {identity.platform}: {identity.metadata?.username || identity.externalId}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-fg mt-2">Created: {formatDate(user.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1}
            data-testid="pagination-prev"
          >
            <ChevronLeft size={14} />
            Prev
          </Button>
          <span className="text-sm text-muted-fg" data-testid="pagination-info">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            data-testid="pagination-next"
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
