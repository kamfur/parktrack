using parksite.Models;

namespace parksite.Helpers
{
    public static class SmsHelper
    {
        public static string GenerateSms(ReservationModel reservation) =>
            $"Rezerwacja potwierdzona: {reservation.Imie}, przyjazd: {reservation.DataPrzyjazdu} o {reservation.GodzinaPrzyjazdu}, wyjazd: {reservation.DataWyjazdu} o {reservation.GodzinaWyjazdu}. Kontakt: {reservation.Telefon}.";
    }
}
