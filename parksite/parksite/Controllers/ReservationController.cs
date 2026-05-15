using System;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using parksite.Helpers;
using parksite.Models;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;
using System.Net.Http;
using RestSharp;
using Method = RestSharp.Method;

namespace parksite.Controllers
{
    public class ReservationController : Controller
    {
        // GET: Reservation
        public ActionResult Index()
        {
            return View();
        }

        // GET: Reservation/Details/5
        public ActionResult Details(int id)
        {
            return View();
        }

        // GET: Reservation/Create
        public ActionResult Create()
        {
            return View();
        }

        // POST: Reservation/Create
        [HttpPost]

        public JsonResult Contact(ReservationModel collection)
        {
            string retValue = "Dziękujemy za rezerwację miejsca parkingowego. Na podany adres e-mail zostało wysłane potwierdzenie rezerwacji";
            if (!ModelState.IsValid)
            {
                var x = ModelState.Values.Where(i => i.Errors.Count > 0).Select(e => e.Errors.Select(z => z.ErrorMessage));
                var res = JsonConvert.SerializeObject(new { Message = "invalid", Model = x }, Formatting.Indented,
                            new JsonSerializerSettings
                            {
                                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
                            });
                return Json(res);
            }
            else
            {
                SendMailToClient(collection, collection.Email);
                SendMailToParking(collection);
                _ = Task.Run(() => SendNewMail(collection));
                _ = Task.Run(() => SendNewSMS(collection));

            }
            string data = JsonConvert.SerializeObject(new { Message = "valid", Model = retValue }, Formatting.Indented,
                            new JsonSerializerSettings
                            {
                                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
                            });
            return Json(data);
        }
        private void SendMailToClient(ReservationModel collection, string mailTo)
        {
            MailSenderAsync(collection, collection.Email);
        }

        private void SendMailToParking(ReservationModel collection)
        {
            MailSenderAsync(collection, "info@parking-oaza.pl", "info@parking-oaza.pl");
        }

        private void MailSenderAsync(ReservationModel collection, string mailTo, string? from = null)
        {
            using (var client = new SmtpClient
            {
                Host = "ssl0.ovh.net",
                Port = 587,
                EnableSsl = true,
                Credentials = new System.Net.NetworkCredential("info@parking-oaza.pl", "Nerowaty1935"),
                DeliveryMethod = SmtpDeliveryMethod.Network,

            })
            {
                var mail = new MailMessage();
                mail.To.Add(mailTo); // Update your email address
                mail.From = new MailAddress(!string.IsNullOrEmpty(from) ? from : "info@parking-oaza.pl", "Parking OAZA");
                mail.Subject = String.Format("Rezerwacja miejsca parkingowego");
                mail.Body = CreateEmailBody(collection);
                mail.IsBodyHtml = true;
                Object state = mail;
                try
                {
                    client.Send(mail);

                }
                catch (Exception)
                {

                    throw;
                }
            }
        }

        private string CreateEmailBody(ReservationModel model)

        {
            string body = string.Empty;
            using (StreamReader reader = new StreamReader(Path.Combine("wwwroot", "mailTemplate.html")))

            {

                body = reader.ReadToEnd();
            }
            body = body.Replace("{{Imie}}", model.Imie);
            body = body.Replace("{{DataPrzyjazdu}}", model.DataPrzyjazdu);
            body = body.Replace("{{GodzinaPrzyjazdu}}", model.GodzinaPrzyjazdu);
            body = body.Replace("{{DataWyjazdu}}", model.DataWyjazdu);
            body = body.Replace("{{GodzinaWyjazdu}}", model.GodzinaWyjazdu);
            body = body.Replace("{{Rejestracja}}", model.Rejestracja);
            body = body.Replace("{{Phone}}", model.Telefon.ToString());

            return body;

        }


        private async void SendNewMail(ReservationModel model)
        {

            try
            {
                var client = new HttpClient();
                var request = new HttpRequestMessage(HttpMethod.Post, "https://qdrmn2.api.infobip.com/email/3/send");
                request.Headers.Add("Authorization", "App 02771e4c0221091e42162d18440fe99e-f3eb49a1-7dc9-4947-a6cf-b09877165b3e");
                request.Headers.Add("Accept", "application/json");
                var emailBody = CreateEmailBody(model);
                var content = new MultipartFormDataContent();
                content.Add(new StringContent("info@parking-oaza.pl"), "from");
                content.Add(new StringContent("Rezerwacja miejsca parkingowego ze strony"), "subject");
                content.Add(new StringContent("{\"to\":\"info@parking-oaza.pl\",\"placeholders\":{\"firstName\":\"Rezerwacja\"}}"), "to");
                content.Add(new StringContent(emailBody), "html");
                request.Content = content;
                var response = await client.SendAsync(request);
                response.EnsureSuccessStatusCode();
                Console.WriteLine(await response.Content.ReadAsStringAsync());
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
            }




        }

        private async void SendNewSMS(ReservationModel model)
        {
            try
            {
                var options = new RestClientOptions("https://api.infobip.com")
                {
                    MaxTimeout = -1,
                };
                var client = new RestClient(options);
                var request = new RestRequest("/sms/2/text/advanced", Method.Post);
                request.AddHeader("Authorization", "App 02771e4c0221091e42162d18440fe99e-f3eb49a1-7dc9-4947-a6cf-b09877165b3e");
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("Accept", "application/json");
                var bodyObject = new
                {
                    messages = new[]
                {
                new
                {
                    destinations = new[]
                    {
                        new { to = "48505462262" }
                    },
                    from = "48539585407",
                    text = SmsHelper.GenerateSms(model)
                }
            }
                };
                string body = JsonConvert.SerializeObject(bodyObject);
                request.AddStringBody(body, DataFormat.Json);
                RestResponse response = await client.ExecuteAsync(request);
                Console.WriteLine(response.Content);
            }
            catch(Exception ex) {
                Console.WriteLine(ex);
            }



        }

    }
}
