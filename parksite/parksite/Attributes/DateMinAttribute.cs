using System;
using System.ComponentModel.DataAnnotations;
using System.Globalization;

namespace parksite.Attributes
{


    public sealed class DateMinAttribute : ValidationAttribute
    {
        protected override ValidationResult IsValid(object value, ValidationContext validationContext)
        {
            return Convert.ToDateTime(value) >= DateTime.Today.AddHours(28).Date
                ? ValidationResult.Success
                : new ValidationResult("Brak miejsc w wyznaczonym terminie");
        }
    }


    [AttributeUsage(AttributeTargets.Property | AttributeTargets.Field, AllowMultiple = false)]
    public sealed class NightHoursAttribute : ValidationAttribute
    {
        private readonly TimeSpan _nightStartTime;
        private readonly TimeSpan _nightEndTime;

        public NightHoursAttribute(int nightStartHour, int nightEndHour)
        {
            _nightStartTime = new TimeSpan(nightStartHour, 0, 0);
            _nightEndTime = new TimeSpan(nightEndHour, 0, 0);
        }

        protected override ValidationResult IsValid(object value, ValidationContext validationContext)
        {;
            var currentTime = TimeSpan.Parse(value.ToString());
            if (_nightStartTime <= _nightEndTime)
            {
                return !(currentTime >= _nightStartTime && currentTime <= _nightEndTime) ? ValidationResult.Success : new ValidationResult("Brak miejsc w wyznaczonej godzinie");
            }
            else
            {
                return !(currentTime >= _nightStartTime || currentTime <= _nightEndTime) ? ValidationResult.Success : new ValidationResult("Brak miejsc w wyznaczonej godzinie");
            }
        }


   
    }
}
