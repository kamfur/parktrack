using parksite.Attributes;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;

namespace parksite.Models
{
    public class ReservationModel
    {
        [Display(Name= "Nazwa:")]
        [Required(ErrorMessage="Dane kontaktowe są wymagane!")]
        [StringLength(100)]
        public string Imie { get; set; }

        [Display(Name = "Email:")]
        [DataType(DataType.EmailAddress)]
        [Required(ErrorMessage = "Adres e-mail jest wymagany")]
        [StringLength(100)]
        public string Email { get; set; }

        [Display(Name = "Telefon:")]
        [DataType(DataType.PhoneNumber)]
        [Required(ErrorMessage = "Telefon kontaktowy jest wymagany")]
        public int Telefon { get; set; }

        [Display(Name = "Data przyjazdu:")]
        [DataType(DataType.Date)]
        [DateMinAttribute]
        [Required(ErrorMessage = "Proszę wprowadzić datę poprawnie")]
        [StringLength(100)]
        public string DataPrzyjazdu { get; set; }

        [Display(Name = "Godzina przyjazdu:")]
        [DataType(DataType.Time)]
        [Required(ErrorMessage = "Proszę wprowadzić godzine poprawnie GG:MM")]
        //[NightHours(23, 4)]
        [StringLength(100)]
        public string GodzinaPrzyjazdu { get; set; }

        [Display(Name = "Data wyjazdu:")]
        [DataType(DataType.Date)]
        [Required(ErrorMessage = "Proszę wprowadzić datę poprawnie")]
        [StringLength(100)]
        public string DataWyjazdu { get; set; }

        [Display(Name = "Godzina wyjazdu:")]
        [DataType(DataType.Time)]
        [Required(ErrorMessage = "Proszę wprowadzić godzine poprawnie GG:MM")]
        [StringLength(100)]
        public string GodzinaWyjazdu { get; set; }

        [Display(Name = "Nr rejestracji:")]
        [StringLength(100)]
        public string Rejestracja { get; set; }
        



    }
}