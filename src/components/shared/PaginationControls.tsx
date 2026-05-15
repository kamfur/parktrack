import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export interface PaginationControlsProps {
  /** Aktualna strona (1-based) */
  currentPage: number;
  /** Liczba wyników na stronę */
  pageSize: number;
  /** Całkowita liczba wyników */
  totalItems: number;
  /** Callback wywoływany przy zmianie strony */
  onPageChange: (page: number) => void;
  /** Callback wywoływany przy zmianie rozmiaru strony */
  onPageSizeChange: (size: number) => void;
  /** Dostępne opcje rozmiaru strony */
  pageSizeOptions?: number[];
  /** Czy kontrolki są disabled */
  disabled?: boolean;
}

/**
 * Komponent kontrolek paginacji z nawigacją i selektorem rozmiaru strony
 */
export function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  disabled = false,
}: PaginationControlsProps) {
  // Oblicz całkowitą liczbę stron
  const totalPages = Math.ceil(totalItems / pageSize);

  // Oblicz zakres wyświetlanych wyników
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generuj numery stron do wyświetlenia
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maksymalna liczba widocznych numerów stron

    if (totalPages <= maxVisible) {
      // Jeśli mało stron, pokaż wszystkie
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Zawsze pokaż pierwszą stronę
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Pokaż strony wokół aktualnej
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Zawsze pokaż ostatnią stronę
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // Handlers
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      onPageChange(page);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newSize = parseInt(value, 10);
    onPageSizeChange(newSize);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Informacja o wynikach i selektor rozmiaru strony */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Pokazano <span className="font-medium">{startItem}</span>-<span className="font-medium">{endItem}</span> z{" "}
          <span className="font-medium">{totalItems}</span>
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-sm text-muted-foreground">
            Wierszy:
          </label>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={disabled}>
            <SelectTrigger id="page-size" className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Nawigacja stron */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={disabled || currentPage === 1}
            aria-label="Poprzednia strona"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Poprzednia</span>
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isActive = pageNum === currentPage;

              return (
                <Button
                  key={pageNum}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageClick(pageNum)}
                  disabled={disabled || isActive}
                  className="min-w-[32px]"
                  aria-label={`Strona ${pageNum}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={disabled || currentPage === totalPages}
            aria-label="Następna strona"
          >
            <span className="hidden sm:inline">Następna</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
