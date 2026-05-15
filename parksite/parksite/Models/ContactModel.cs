using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;

namespace parksite.Models
{
    public class ContactModel
    {
        [Display(Name= "Twoje imie i nazwisko:")]
        [Required(ErrorMessage="Dane kontaktowe są wymagane!")]
        [StringLength(100)]
        public string Name { get; set; }

        [Display(Name = "Email:")]
        [DataType(DataType.EmailAddress)]
        [Required(ErrorMessage = "Proszę wprowadzić adres e-mail poprawnie")]
        [StringLength(100)]
        public string Email { get; set; }

        [Display(Name = "Temat:")]
        [StringLength(100)]
        public string Topic { get; set; }

        [Display(Name = "Wiadomość:")]
        [Required(ErrorMessage = "Proszę wprowadzić treść wiadomości")]
        public string Comment { get; set; }
    }
}