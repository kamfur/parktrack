import React, { useState } from "react";
import { Mail, Phone, Car, Copy, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { PersonalInfoCardProps } from "@/types";

/**
 * Karta wyświetlająca dane osobowe klienta.
 * Umożliwia kliknięcie w email/telefon oraz kopiowanie numeru rejestracyjnego.
 */
export function PersonalInfoCard({ email, phone, licensePlate }: PersonalInfoCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const formatPhone = (phoneNumber: string | null): string => {
    if (!phoneNumber) return "Brak danych";
    // Format: XXX XXX XXX
    const cleaned = phoneNumber.replace(/\s/g, "");
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phoneNumber;
  };

  const formatLicensePlate = (plate: string | null): string => {
    if (!plate) return "Brak danych";
    // Format: XX 12345 or XXX 1234
    const cleaned = plate.replace(/\s/g, "").toUpperCase();
    if (cleaned.length >= 5) {
      const firstPart = cleaned.slice(0, cleaned.length - 4);
      const secondPart = cleaned.slice(cleaned.length - 4);
      return `${firstPart} ${secondPart}`;
    }
    return plate.toUpperCase();
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Numer rejestracyjny skopiowany do schowka");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Nie udało się skopiować numeru");
    }
  };

  const formattedPhone = formatPhone(phone);
  const formattedPlate = formatLicensePlate(licensePlate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dane osobowe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email */}
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          {email ? (
            <a href={`mailto:${email}`} className="text-primary hover:underline">
              {email}
            </a>
          ) : (
            <span className="text-muted-foreground">Brak danych</span>
          )}
        </div>

        {/* Phone */}
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-muted-foreground" />
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
              {formattedPhone}
            </a>
          ) : (
            <span className="text-muted-foreground">Brak danych</span>
          )}
        </div>

        {/* License Plate */}
        <div className="flex items-center gap-3">
          <Car className="h-5 w-5 text-muted-foreground" />
          {licensePlate ? (
            <div className="flex items-center gap-2">
              <span className="font-mono">{formattedPlate}</span>
              <button
                onClick={() => copyToClipboard(licensePlate, "licensePlate")}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Kopiuj numer rejestracyjny"
              >
                {copiedField === "licensePlate" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-muted-foreground">Brak danych</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
