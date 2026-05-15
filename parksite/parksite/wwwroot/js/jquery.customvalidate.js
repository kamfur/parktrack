$(function () {
    $.validator.addMethod("isdateafter", function(value, element, params) {
        var parts = element.name.split(".");
        var prefix = "";
        for (var i = 0; i < parts.length - 1; i++) {
            prefix = parts[i] + ".";
        }

        var startdatevalue = $('input[name="' + prefix + params.propertytested + '"]').val();

        if (!value || !startdatevalue) return true;    

        var allowequal = params.allowequaldates.toLowerCase() === "true";
        return allowequal ? Date.parse(startdatevalue) <= Date.parse(value) :
            Date.parse(startdatevalue) < Date.parse(value);
    });
    $.validator.unobtrusive.adapters.add('isdateafter', 
        ['propertytested', 'allowequaldates'], 
        function (options) {
            options.rules['isdateafter'] = options.params;
            options.messages['isdateafter'] = options.message;
        });
});