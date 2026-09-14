import { useCallback } from "react";
import { AlertCircle, FileText } from "lucide-react";
import { useInvoicesList } from "../../hooks/useInvoicesList";
import type { InvoiceDto } from "../../types";
import { SearchBar } from "../shared/SearchBar";
import { PaginationControls } from "../shared/PaginationControls";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceCards } from "./InvoiceCards";
import { ErrorState } from "../common/ErrorState";
import { EmptyState } from "../common/EmptyState";

/**
 * Główny kontener React zarządzający widokiem listy faktur
 * Koordynuje stan wyszukiwania, sortowania i paginacji
 */
export function InvoicesListContainer() {
  const {
    invoices,
    total,
    isLoading,
    error,
    search,
    sortBy,
    sortOrder,
    pagination,
    updateSearch,
    updateSort,
    updatePagination,
    refetch,
  } = useInvoicesList();

  // Otwarcie widoku wydruku faktury
  const handleOpenInvoice = useCallback((invoice: InvoiceDto) => {
    window.location.href = `/faktury/${invoice.id}/druk`;
  }, []);

  // Akcje z menu kontekstowego
  const handleAction = useCallback(
    (action: "print" | "reservation", invoice: InvoiceDto) => {
      if (action === "print") {
        handleOpenInvoice(invoice);
      } else {
        window.location.href = `/rezerwacje/${invoice.reservation_id}`;
      }
    },
    [handleOpenInvoice]
  );

  // Obsługa błędu
  if (error && !isLoading) {
    return (
      <div className="container mx-auto py-8">
        <ErrorState
          title="Błąd ładowania faktur"
          message={error.message || "Nie udało się załadować listy faktur. Spróbuj ponownie."}
          onRetry={refetch}
        />
      </div>
    );
  }

  // Empty state (gdy brak faktur i brak wyszukiwania)
  if (!isLoading && invoices.length === 0 && !search) {
    return (
      <div className="container mx-auto py-8">
        <EmptyState
          icon={FileText}
          title="Brak faktur"
          description="Faktury wystawisz z poziomu zakończonej rezerwacji."
          actionLabel="Przejdź do rezerwacji"
          actionHref="/rezerwacje"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header z tytułem */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Faktury</h1>
        <p className="text-muted-foreground">Przeglądaj faktury wystawione do rezerwacji</p>
      </div>

      <div className="space-y-4">
        {/* SearchBar */}
        <SearchBar
          value={search}
          onChange={updateSearch}
          placeholder="Szukaj po numerze faktury lub nabywcy..."
          isLoading={isLoading}
        />

        {/* Desktop: Tabela */}
        <div className="hidden md:block">
          <InvoiceTable
            invoices={invoices}
            isLoading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={updateSort}
            onRowClick={handleOpenInvoice}
            onAction={handleAction}
          />
        </div>

        {/* Mobile: Karty */}
        <div className="md:hidden">
          <InvoiceCards
            invoices={invoices}
            isLoading={isLoading}
            onCardClick={handleOpenInvoice}
            onAction={handleAction}
          />
        </div>

        {/* Empty state z aktywnym wyszukiwaniem */}
        {!isLoading && invoices.length === 0 && search && (
          <EmptyState
            icon={AlertCircle}
            title="Brak wyników"
            description="Nie znaleziono faktur spełniających kryteria wyszukiwania."
            actionLabel="Wyczyść wyszukiwanie"
            onAction={() => updateSearch("")}
          />
        )}

        {/* Paginacja */}
        {!isLoading && invoices.length > 0 && (
          <PaginationControls
            currentPage={pagination.page}
            pageSize={pagination.limit}
            totalItems={total}
            onPageChange={(page) => updatePagination(page)}
            onPageSizeChange={(size) => updatePagination(1, size)}
            disabled={isLoading}
          />
        )}
      </div>
    </div>
  );
}
