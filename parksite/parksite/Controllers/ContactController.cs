using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Mail;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using parksite.Models;

namespace parksite.Controllers
{
    public class ContactController : Controller
    {
        [HttpPost]
        public ActionResult Contact(ContactModel c)
        {
            string retValue = "There was an error submitting the form, please try again later.";
            if (!ModelState.IsValid)
            {
                return Content(retValue);
            }

            if (ModelState.IsValid)
            {
                //Update your SMTP server credentials
                using (var client = new SmtpClient
                {
                    Host = "smtp.gmail.com",
                    Port = 587,
                    EnableSsl = true,
                    Credentials = new System.Net.NetworkCredential("mail", "pass"),
                    DeliveryMethod = SmtpDeliveryMethod.Network,

                })
                {
                    var mail = new MailMessage();
                    mail.To.Add("info@parking-oaza.pl"); // Update your email address
                    mail.From = new MailAddress(c.Email, c.Name);
                    mail.Subject = String.Format("Kontakt ze strony: " + c.Topic);
                    //mail.Sender = c.Email;

                    var message = new StringBuilder();
                    message.Append("Imie i Nazwisko: " + c.Name);
                    message.Append(Environment.NewLine);
                    message.Append("Email: " + c.Email);
                    message.Append(Environment.NewLine);
                    message.Append("Temat: " + c.Topic);
                    message.Append(Environment.NewLine);
                    message.Append("Treść wiadomości: \n" + c.Comment);
                    mail.Body = message.ToString();
                    mail.IsBodyHtml = false;
                    Object state = mail;
                    try
                    {
                        //Task.Factory.StartNew( () =>  );
                        client.Send(mail);

                        retValue = "Wiadomość została wysłana. Skontaktujemy się z Tobą najszybciej jak to bedzie możliwe.";
                    }
                    catch (Exception)
                    {

                        throw;
                    }
                }
            }
            return Content(retValue);
        }
    }
}
